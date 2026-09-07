import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Modal, Alert } from 'react-native';
import { sheetsService } from '../../services/sheetsService';
import { useAuth } from '../../context/AuthContext';
import { useRealtime } from '../../hooks/useRealtime';
import { FileUp, X, Search } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { StatusBadge } from '../../components/StatusBadge';
import { Pagination } from '../../components/Pagination';

export default function AccountantQueue() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Invoice Upload Modal
  const [invoicingOrder, setInvoicingOrder] = useState(null);
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [invoicePdf, setInvoicePdf] = useState('');
  const [invoiceFileName, setInvoiceFileName] = useState('');
  
  const [refreshKey, setRefreshKey] = useState(0);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useRealtime(['orders', 'accounts'], () => setRefreshKey(k => k + 1));

  const fetchOrders = async () => {
    try {
      const data = await sheetsService.getOrders(user);
      const queue = data.filter(o => o.ApprovalStatus === 'Pending Invoice');
      queue.sort((a, b) => new Date(a.DeliveryConfirmedTimestamp || a.OrderTimestamp || 0) - new Date(b.DeliveryConfirmedTimestamp || b.OrderTimestamp || 0));
      setOrders(queue);
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

  const handleFilePick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        if (file.size && file.size > 15 * 1024 * 1024) {
          return Alert.alert('Error', 'File is too large. Please upload a PDF under 15MB.');
        }
        const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
        setInvoicePdf(`data:application/pdf;base64,${base64}`);
        setInvoiceFileName(file.name);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to pick file');
    }
  };

  const handleUploadSubmit = async () => {
    if (!invoiceAmount || !invoicePdf || isSubmittingRef.current) return;
    
    const order = orders.find(o => o.OrdID === invoicingOrder);
    
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      await sheetsService.updateOrderStatus(user, invoicingOrder, 'Payment Pending', {
        invoiceAmount: Number(invoiceAmount),
        invoicePdf,
        userId: order ? (order.UserID || order.user_id) : undefined
      });
      setInvoicingOrder(null);
      setInvoiceAmount('');
      setInvoicePdf('');
      setInvoiceFileName('');
      await fetchOrders();
      Alert.alert('Success', 'Invoice uploaded successfully.');
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to upload invoice');
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const filteredOrders = orders.filter(o => {
    const term = searchTerm.toLowerCase();
    return (
      o.OrdID?.toLowerCase().includes(term) ||
      o.Company?.toLowerCase().includes(term) ||
      o.Name?.toLowerCase().includes(term)
    );
  });

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const renderItem = ({ item }) => (
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
          <Text style={styles.label}>Product:</Text>
          <Text style={styles.value}>{item.Product}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Quantity:</Text>
          <Text style={styles.value}>{item.Qty} Bags</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Estimate Amount:</Text>
          <Text style={styles.value}>₹{(parseFloat(item.EstimateAmt) || 0).toLocaleString()}</Text>
        </View>
      </View>
      <View style={styles.cardFooter}>
        <TouchableOpacity 
          style={styles.actionBtn}
          onPress={() => {
            setInvoicingOrder(item.OrdID);
            setInvoiceAmount(item.EstimateAmt || '');
          }}
        >
          <FileUp size={16} color="white" />
          <Text style={styles.actionBtnText}>Upload Invoice</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Pending Invoices</Text>
        <Text style={styles.subtitle}>Upload tax invoices for delivered orders.</Text>
      </View>

      <View style={styles.searchContainer}>
        <Search size={20} color="#64748B" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by Order ID or Customer"
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
      </View>

      <FlatList
        data={paginatedOrders}
        keyExtractor={item => item.OrdID}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>No pending invoices found.</Text>}
      />

      {totalPages > 1 && (
        <View style={{ padding: 16 }}>
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </View>
      )}

      {invoicingOrder && (
        <Modal transparent animationType="fade" visible={!!invoicingOrder} onRequestClose={() => !isSubmitting && setInvoicingOrder(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <TouchableOpacity style={styles.closeBtn} onPress={() => !isSubmitting && setInvoicingOrder(null)}>
                <X size={24} color="#64748B" />
              </TouchableOpacity>
              
              <View style={styles.modalHeader}>
                <View style={styles.iconBg}><FileUp size={24} color="#1A1A1A" /></View>
                <Text style={styles.modalTitle}>Upload Invoice</Text>
              </View>
              
              <Text style={styles.modalDesc}>Generating tax invoice for <Text style={{fontWeight: '700'}}>{invoicingOrder}</Text></Text>

              <Text style={styles.inputLabel}>Final Invoiced Amount (₹)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={String(invoiceAmount)}
                onChangeText={setInvoiceAmount}
                placeholder="0.00"
              />

              <Text style={styles.inputLabel}>Invoice PDF</Text>
              <TouchableOpacity style={styles.uploadBtn} onPress={handleFilePick}>
                <FileUp size={20} color="#64748B" />
                <Text style={styles.uploadBtnText} numberOfLines={1}>{invoiceFileName || 'Select PDF File'}</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.submitBtn, (isSubmitting || !invoiceAmount || !invoicePdf) && styles.submitBtnDisabled]}
                onPress={handleUploadSubmit}
                disabled={isSubmitting || !invoiceAmount || !invoicePdf}
              >
                {isSubmitting ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.submitBtnText}>Submit Invoice</Text>}
              </TouchableOpacity>
            </View>
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
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', margin: 16, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  searchInput: { flex: 1, height: 44, marginLeft: 8, fontSize: 15 },
  listContent: { padding: 16, paddingTop: 0 },
  card: { backgroundColor: 'white', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  orderId: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  customerName: { fontSize: 14, color: '#64748B', marginTop: 2 },
  cardBody: { gap: 8, marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 14, color: '#64748B' },
  value: { fontSize: 14, fontWeight: '500', color: '#1A1A1A' },
  cardFooter: { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 16, flexDirection: 'row', justifyContent: 'flex-end' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#3B82F6', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, gap: 8 },
  actionBtnText: { color: 'white', fontWeight: '600', fontSize: 14 },
  emptyText: { textAlign: 'center', color: '#64748B', marginTop: 24, fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(26,26,26,0.8)', justifyContent: 'center', padding: 16 },
  modalContent: { backgroundColor: 'white', borderRadius: 24, padding: 24, position: 'relative' },
  closeBtn: { position: 'absolute', top: 20, right: 20, zIndex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  iconBg: { backgroundColor: '#F1F5F9', padding: 8, borderRadius: 12 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A1A' },
  modalDesc: { fontSize: 14, color: '#64748B', marginBottom: 24 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#1A1A1A', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 16, height: 48, fontSize: 15, marginBottom: 20 },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#CBD5E1', borderStyle: 'dashed', borderRadius: 12, height: 48, backgroundColor: '#F8FAFC', marginBottom: 24 },
  uploadBtnText: { fontSize: 15, color: '#64748B', flex: 1, marginHorizontal: 8 },
  submitBtn: { backgroundColor: '#10B981', height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: 'white', fontSize: 16, fontWeight: '600' }
});
