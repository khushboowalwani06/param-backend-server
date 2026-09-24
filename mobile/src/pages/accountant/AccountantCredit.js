import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Modal, Image, Alert, ScrollView } from 'react-native';
import { sheetsService } from '../../services/sheetsService';
import { useAuth } from '../../context/AuthContext';
import { useRealtime } from '../../hooks/useRealtime';
import { FileText, CheckCircle, Pencil, X, CreditCard } from 'lucide-react-native';
import { StatusBadge } from '../../components/StatusBadge';
import { Pagination } from '../../components/Pagination';
import { ExportButton } from '../../components/ExportButton';
import { DateRangeFilter } from '../../components/DateRangeFilter';
import { LocationFilter } from '../../components/LocationFilter';
import { SearchFilter } from '../../components/SearchFilter';
import { useLanguage } from '../../context/LanguageContext';

export default function AccountantCredit() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  // View Receipt Modal
  const [viewReceiptUrl, setViewReceiptUrl] = useState(null);
  const [receiptRotation, setReceiptRotation] = useState(0);

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [location, setLocation] = useState('');

  // Edit Amount Modal
  const [editingOrder, setEditingOrder] = useState(null);
  const [editAmount, setEditAmount] = useState('');

  const [refreshKey, setRefreshKey] = useState(0);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useRealtime(['profiles', 'customers', 'orders', 'accounts'], () => setRefreshKey(k => k + 1));

  const fetchOrders = async () => {
    try {
      const data = await sheetsService.getOrders(user);
      const creditOrders = data.filter(o => 
        o.ApprovalStatus === 'Payment Pending' || 
        o.ApprovalStatus === 'Payment Sent' || 
        o.ApprovalStatus === 'Overdue' ||
        o.ApprovalStatus === 'Closed'
      );
      
      const ordersWithAccounts = await Promise.all(creditOrders.map(async (o) => {
        const acc = await sheetsService.getAccountsData(user, o.OrdID);
        return { ...o, ...acc };
      }));
      
      ordersWithAccounts.sort((a, b) => new Date(a.PaymentDueDate || 0) - new Date(b.PaymentDueDate || 0));
      setOrders(ordersWithAccounts);
      setCurrentPage(1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [user, refreshKey]);

  const handleVerifyPayment = async (ordId) => {
    if (isSubmittingRef.current) return;
    
    Alert.alert(
      "Verify Payment",
      "Are you sure you want to verify this payment and close the order?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Verify",
          onPress: async () => {
            isSubmittingRef.current = true;
            setIsSubmitting(true);
            try {
              await sheetsService.updateOrderStatus(user, ordId, 'Closed');
              await fetchOrders();
              Alert.alert('Success', 'Payment verified successfully.');
            } catch (err) {
              Alert.alert('Error', err.message);
            } finally {
              isSubmittingRef.current = false;
              setIsSubmitting(false);
            }
          }
        }
      ]
    );
  };

  const handleSaveEdit = async () => {
    if (!editAmount || isSubmittingRef.current || !editingOrder) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      await sheetsService.updateOrderStatus(user, editingOrder, 'Payment Pending', {
        invoiceAmount: Number(editAmount)
      });
      setEditingOrder(null);
      await fetchOrders();
      Alert.alert('Success', 'Invoice amount updated.');
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };
  const uniqueLocations = [...new Set(orders.map(o => o.City || o.Location).filter(Boolean))];

  const filteredOrders = orders.filter(o => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = o.OrdID?.toLowerCase().includes(term) ||
      o.Company?.toLowerCase().includes(term) ||
      o.Name?.toLowerCase().includes(term);

    let matchesLocation = true;
    if (location) {
      matchesLocation = (o.City || o.Location) === location;
    }

    let matchesDate = true;
    if (dateRange.startDate && dateRange.endDate) {
      const orderDate = new Date(o.PaymentDueDate || o.OrderTimestamp);
      const start = new Date(dateRange.startDate);
      const end = new Date(dateRange.endDate);
      end.setHours(23, 59, 59, 999);
      matchesDate = orderDate >= start && orderDate <= end;
    }

    return matchesSearch && matchesLocation && matchesDate;
  });

  const totalOutstanding = orders.filter(o => o.ApprovalStatus === 'Payment Pending' || o.ApprovalStatus === 'Overdue').reduce((sum, o) => sum + (Number(o.FinalInvoicedAmount) || Number(o.EstimateAmt) || 0), 0);
  const awaitingVerificationCount = orders.filter(o => o.ApprovalStatus === 'Payment Sent').length;

  const getDueDateTag = (item) => {
    if (item.ApprovalStatus === 'Closed') return null;
    if (!item.PaymentDueDate) return null;
    
    const due = new Date(item.PaymentDueDate);
    const today = new Date();
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return <Text style={styles.overdueTag}>{Math.abs(diffDays)} days overdue</Text>;
    } else {
      return <Text style={styles.pendingTag}>{diffDays} days left</Text>;
    }
  };
  const renderItem = ({ item }) => {
    const isPaymentSent = item.ApprovalStatus === 'Payment Sent';
    const isPaymentPending = item.ApprovalStatus === 'Payment Pending' || item.ApprovalStatus === 'Overdue';
    const amount = item.FinalInvoicedAmount || item.EstimateAmt || 0;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.orderId} numberOfLines={1}>{item.OrdID}</Text>
            <Text style={styles.customerName} numberOfLines={1}>{item.Company || item.Name}</Text>
          </View>
          <StatusBadge status={item.ApprovalStatus} />
        </View>

        <View style={styles.cardBody}>
          <View style={styles.row}>
            <Text style={styles.label}>{t('Product:')}</Text>
            <Text style={styles.value}>{item.Product}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t('Due Date:')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.value}>{item.PaymentDueDate ? new Date(item.PaymentDueDate).toLocaleDateString() : 'N/A'}</Text>
              {getDueDateTag(item)}
            </View>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t('Invoice Amount:')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.amountValue}>₹{parseFloat(amount).toLocaleString()}</Text>
              {(isPaymentPending || isPaymentSent) && (
                <TouchableOpacity onPress={() => {
                  setEditingOrder(item.OrdID);
                  setEditAmount(String(amount));
                }}>
                  <Pencil size={14} color="#3B82F6" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        <View style={styles.cardFooter}>
          {item.payment_receipt ? (
            <TouchableOpacity 
              style={styles.actionBtnOutline}
              onPress={() => setViewReceiptUrl(item.payment_receipt)}
            >
              <FileText size={16} color="#3B82F6" />
              <Text style={styles.actionBtnOutlineText}>{t('View Receipt')}</Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}

          {isPaymentSent && (
            <TouchableOpacity 
              style={styles.actionBtnPrimary}
              onPress={() => handleVerifyPayment(item.OrdID)}
              disabled={isSubmitting}
            >
              <CheckCircle size={16} color="white" />
              <Text style={styles.actionBtnText}>{t('Verify & Close')}</Text>
            </TouchableOpacity>
          )}

          {isPaymentPending && (
            <TouchableOpacity 
              style={styles.actionBtnPrimary}
              onPress={() => handleVerifyPayment(item.OrdID)}
              disabled={isSubmitting}
            >
              <CheckCircle size={16} color="white" />
              <Text style={styles.actionBtnText}>{t('Confirm')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('Credit Cycles')}</Text>
        <Text style={styles.subtitle}>{t('Tracking overdue and pending payments.')}</Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>{t('Total Outstanding')}</Text>
          <Text style={styles.statValueOutstanding}>₹{totalOutstanding.toLocaleString()}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>{t('Awaiting Verification')}</Text>
          <Text style={styles.statValueWarning}>{awaitingVerificationCount}</Text>
        </View>
      </View>

      <View style={styles.filtersContainer}>
        <SearchFilter 
          value={searchTerm} 
          onChange={setSearchTerm} 
          placeholder="Search by Order ID or Customer" 
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <DateRangeFilter 
            startDate={dateRange.startDate} 
            endDate={dateRange.endDate} 
            onDateChange={setDateRange} 
            onClear={() => setDateRange({ startDate: '', endDate: '' })} 
          />
          <LocationFilter 
            value={location} 
            onChange={setLocation} 
            locations={uniqueLocations} 
          />
          <ExportButton data={filteredOrders} filename="Active_Credit" sheetName="Credit" />
        </ScrollView>
      </View>

      <FlatList
        data={paginatedOrders}
        keyExtractor={item => item.OrdID}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>{t('No active credit records found.')}</Text>}
      />

      {totalPages > 1 && (
        <View style={{ padding: 16 }}>
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </View>
      )}

      {/* Edit Amount Modal */}
      {editingOrder && (
        <Modal transparent animationType="fade" visible={!!editingOrder} onRequestClose={() => !isSubmitting && setEditingOrder(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <TouchableOpacity style={styles.closeBtn} onPress={() => !isSubmitting && setEditingOrder(null)}>
                <X size={24} color="#64748B" />
              </TouchableOpacity>
              
              <Text style={styles.modalTitle}>{t('Edit Invoice Amount')}</Text>
              <Text style={styles.modalDesc}>Update amount for <Text style={{fontWeight: '700'}}>{editingOrder}</Text></Text>

              <Text style={styles.inputLabel}>{t('New Amount (₹)')}</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={editAmount}
                onChangeText={setEditAmount}
              />

              <TouchableOpacity 
                style={[styles.submitBtn, (isSubmitting || !editAmount) && styles.submitBtnDisabled]}
                onPress={handleSaveEdit}
                disabled={isSubmitting || !editAmount}
              >
                {isSubmitting ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.submitBtnText}>{t('Save Changes')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* View Receipt Modal */}
      {viewReceiptUrl && (
        <Modal transparent animationType="fade" visible={!!viewReceiptUrl} onRequestClose={() => { setViewReceiptUrl(null); setReceiptRotation(0); }}>
          <View style={styles.fullModalOverlay}>
            <TouchableOpacity style={styles.closeFullBtn} onPress={() => { setViewReceiptUrl(null); setReceiptRotation(0); }}>
              <X size={28} color="white" />
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={1} onPress={() => setReceiptRotation(prev => prev + 90)} style={{ flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' }}>
              <Image 
                source={{ uri: viewReceiptUrl }} 
                style={[styles.fullImage, { transform: [{ rotate: `${receiptRotation}deg` }] }]} 
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  title: { fontSize: 20, fontWeight: '700', color: '#1A1A1A' },
  subtitle: { fontSize: 14, color: '#64748B', marginTop: 4 },
  statsContainer: { flexDirection: 'row', padding: 16, gap: 12, backgroundColor: '#F8FAFC' },
  statBox: { flex: 1, backgroundColor: 'white', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  statLabel: { fontSize: 13, color: '#64748B', marginBottom: 4 },
  statValueOutstanding: { fontSize: 20, fontWeight: 'bold', color: '#EF4444' },
  statValueWarning: { fontSize: 20, fontWeight: 'bold', color: '#F59E0B' },
  filtersContainer: { paddingHorizontal: 16, paddingBottom: 16, backgroundColor: '#F8FAFC', gap: 12 },
  filterScroll: { gap: 12, paddingBottom: 4 },
  listContent: { padding: 16, paddingTop: 0 },
  card: { backgroundColor: 'white', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  orderId: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  customerName: { fontSize: 14, color: '#64748B', marginTop: 2 },
  cardBody: { gap: 8, marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 14, color: '#64748B' },
  value: { fontSize: 14, fontWeight: '500', color: '#1A1A1A' },
  overdueTag: { fontSize: 12, fontWeight: '600', color: '#EF4444', backgroundColor: '#FEE2E2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  pendingTag: { fontSize: 12, fontWeight: '600', color: '#F59E0B', backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  amountValue: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  cardFooter: { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 16, flexDirection: 'row', justifyContent: 'space-between' },
  actionBtnOutline: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#3B82F6', gap: 8 },
  actionBtnOutlineText: { color: '#3B82F6', fontWeight: '600', fontSize: 14 },
  actionBtnPrimary: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B981', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, gap: 8 },
  actionBtnText: { color: 'white', fontWeight: '600', fontSize: 14 },
  emptyText: { textAlign: 'center', color: '#64748B', marginTop: 24, fontSize: 15 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(26,26,26,0.8)', justifyContent: 'center', padding: 16 },
  modalContent: { backgroundColor: 'white', borderRadius: 24, padding: 24, position: 'relative' },
  closeBtn: { position: 'absolute', top: 20, right: 20, zIndex: 1 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A1A', marginBottom: 8 },
  modalDesc: { fontSize: 14, color: '#64748B', marginBottom: 24 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#1A1A1A', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 16, height: 48, fontSize: 15, marginBottom: 24 },
  submitBtn: { backgroundColor: '#3B82F6', height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: 'white', fontSize: 16, fontWeight: '600' },
  
  fullModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  closeFullBtn: { position: 'absolute', top: 40, right: 24, zIndex: 100, padding: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 24 },
  fullImage: { width: '100%', height: '80%' }
});
