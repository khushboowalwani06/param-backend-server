import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Modal, Image, Alert } from 'react-native';
import { sheetsService } from '../../services/sheetsService';
import { useAuth } from '../../context/AuthContext';
import { useRealtime } from '../../hooks/useRealtime';
import { FileText, CheckCircle, Pencil, X, CreditCard } from 'lucide-react-native';
import { StatusBadge } from '../../components/StatusBadge';

export default function AccountantCredit() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  // View Receipt Modal
  const [viewReceiptUrl, setViewReceiptUrl] = useState(null);

  // Edit Amount Modal
  const [editingOrder, setEditingOrder] = useState(null);
  const [editAmount, setEditAmount] = useState('');

  const [refreshKey, setRefreshKey] = useState(0);

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

  const renderItem = ({ item }) => {
    const isPaymentSent = item.ApprovalStatus === 'Payment Sent';
    const isPaymentPending = item.ApprovalStatus === 'Payment Pending' || item.ApprovalStatus === 'Overdue';
    const isClosed = item.ApprovalStatus === 'Closed';
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
            <Text style={styles.label}>Product:</Text>
            <Text style={styles.value}>{item.Product}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Due Date:</Text>
            <Text style={styles.value}>{item.PaymentDueDate ? new Date(item.PaymentDueDate).toLocaleDateString() : 'N/A'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Invoice Amount:</Text>
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
              <Text style={styles.actionBtnOutlineText}>View Receipt</Text>
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
              <Text style={styles.actionBtnText}>Verify</Text>
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Active Credit & Payments</Text>
        <Text style={styles.subtitle}>Verify payments and manage active credit lines.</Text>
      </View>

      <FlatList
        data={orders}
        keyExtractor={item => item.OrdID}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>No active credit records found.</Text>}
      />

      {/* Edit Amount Modal */}
      {editingOrder && (
        <Modal transparent animationType="fade" visible={!!editingOrder} onRequestClose={() => !isSubmitting && setEditingOrder(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <TouchableOpacity style={styles.closeBtn} onPress={() => !isSubmitting && setEditingOrder(null)}>
                <X size={24} color="#64748B" />
              </TouchableOpacity>
              
              <Text style={styles.modalTitle}>Edit Invoice Amount</Text>
              <Text style={styles.modalDesc}>Update amount for <Text style={{fontWeight: '700'}}>{editingOrder}</Text></Text>

              <Text style={styles.inputLabel}>New Amount (₹)</Text>
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
                {isSubmitting ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.submitBtnText}>Save Changes</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* View Receipt Modal */}
      {viewReceiptUrl && (
        <Modal transparent animationType="fade" visible={!!viewReceiptUrl} onRequestClose={() => setViewReceiptUrl(null)}>
          <View style={styles.fullModalOverlay}>
            <TouchableOpacity style={styles.closeFullBtn} onPress={() => setViewReceiptUrl(null)}>
              <X size={28} color="white" />
            </TouchableOpacity>
            <Image 
              source={{ uri: viewReceiptUrl }} 
              style={styles.fullImage} 
              resizeMode="contain"
            />
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
  listContent: { padding: 16 },
  card: { backgroundColor: 'white', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  orderId: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  customerName: { fontSize: 14, color: '#64748B', marginTop: 2 },
  cardBody: { gap: 8, marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 14, color: '#64748B' },
  value: { fontSize: 14, fontWeight: '500', color: '#1A1A1A' },
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
