import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Modal, Image, Alert } from 'react-native';
import { FileText, Image as ImageIcon, X, UploadCloud, CheckCircle } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useAuth } from '../../context/AuthContext';
import { sheetsService } from '../../services/sheetsService';
import { useRealtime } from '../../hooks/useRealtime';
import StatusBadge from '../../components/StatusBadge';

export default function CustomerInvoices() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('ALL');
  
  // Payment Modal State
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payOrderId, setPayOrderId] = useState(null);
  const [transactionId, setTransactionId] = useState('');
  const [screenshotBase64, setScreenshotBase64] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // View Transaction Modal State
  const [viewReceiptUrl, setViewReceiptUrl] = useState(null);
  const [viewTransactionId, setViewTransactionId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useRealtime(['orders', 'accounts'], () => setRefreshKey(k => k + 1));

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await sheetsService.getOrders(user);
      const invoicedOrders = data.filter(o => o.UserID === user.UserID && (o.ApprovalStatus === 'Payment Pending' || o.ApprovalStatus === 'Payment Sent' || o.ApprovalStatus === 'Closed'));
      invoicedOrders.sort((a, b) => new Date(b.OrderTimestamp) - new Date(a.OrderTimestamp));
      setOrders(invoicedOrders);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to load invoices.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user, refreshKey]);

  const handlePayClick = (ordId) => {
    setPayOrderId(ordId);
    setTransactionId('');
    setScreenshotBase64('');
    setPayModalOpen(true);
  };

  const handleFileChange = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'image/*' });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        
        // guess mime type based on extension or fallback
        const mimeType = uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
        setScreenshotBase64(`data:${mimeType};base64,${base64}`);
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to pick image.');
    }
  };

  const handlePaySubmit = async () => {
    if (!transactionId.trim() || !screenshotBase64) {
      return Alert.alert('Error', 'Please provide both Transaction ID and a screenshot.');
    }
    
    setIsSubmitting(true);
    try {
      await sheetsService.updateOrderStatus(user, payOrderId, 'Payment Sent', {
        transactionId,
        screenshot: screenshotBase64
      });
      Alert.alert('Success', 'Payment details submitted successfully!');
      setPayModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', err.message || 'Failed to submit payment details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredOrders = orders.filter(o => {
    if (activeFilter === 'PENDING') return o.ApprovalStatus === 'Payment Pending';
    if (activeFilter === 'PAID') return o.ApprovalStatus === 'Payment Sent' || o.ApprovalStatus === 'Closed';
    return true;
  });

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1A1A1A" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Invoices & Payments</Text>
          <Text style={styles.headerSub}>Track payments for your delivered orders.</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={{ paddingRight: 16 }}>
          {['ALL', 'PENDING', 'PAID'].map(filter => (
            <TouchableOpacity 
              key={filter}
              style={[styles.filterBtn, activeFilter === filter && styles.filterBtnActive]}
              onPress={() => setActiveFilter(filter)}
            >
              <Text style={[styles.filterText, activeFilter === filter && styles.filterTextActive]}>{filter}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {filteredOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <FileText size={48} color="#C7C7CC" />
            <Text style={styles.emptyTitle}>No Invoices Yet</Text>
            <Text style={styles.emptySub}>You don't have any pending or closed invoices.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {filteredOrders.map(order => {
              const isClosed = order.ApprovalStatus === 'Closed';
              const isPaymentSent = order.ApprovalStatus === 'Payment Sent';
              const isPaid = isClosed || isPaymentSent;
              
              return (
                <View key={order.OrdID} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View>
                      <Text style={styles.cardId}>{order.OrdID}</Text>
                      <Text style={styles.cardDate}>{new Date(order.OrderTimestamp).toLocaleDateString()}</Text>
                    </View>
                    <StatusBadge status={order.ApprovalStatus} />
                  </View>
                  
                  <View style={styles.cardDetails}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardProduct}>{order.Product}</Text>
                      <Text style={styles.cardQty}>{order.EstimateQty} {order.Unit || 'Tons'}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.cardLabel}>Amount</Text>
                      <Text style={styles.cardAmt}>₹{order.EstimateAmt.toLocaleString()}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.cardActions}>
                    {(order.InvoicePdf || order.InvoicePdfLink) ? (
                      <TouchableOpacity 
                        style={styles.actionBtn}
                        onPress={() => Alert.alert('View Invoice', 'Viewing PDFs is currently supported on web.')}
                      >
                        <FileText size={14} color="#1A1A1A" />
                        <Text style={styles.actionBtnText}>View Invoice</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={[styles.actionBtn, { opacity: 0.5 }]}>
                        <FileText size={14} color="#8E8E93" />
                        <Text style={[styles.actionBtnText, { color: '#8E8E93' }]}>No Invoice Yet</Text>
                      </View>
                    )}
                    
                    {!isPaid && (order.InvoicePdf || order.InvoicePdfLink) && (
                      <TouchableOpacity style={styles.payBtn} onPress={() => handlePayClick(order.OrdID)}>
                        <Text style={styles.payBtnText}>Pay Now</Text>
                      </TouchableOpacity>
                    )}

                    {(order.PaymentScreenshot || order.PaymentProofLink) && (
                      <TouchableOpacity 
                        style={styles.viewTxBtn}
                        onPress={() => {
                          setViewReceiptUrl(order.PaymentScreenshot || order.PaymentProofLink);
                          setViewTransactionId(order.TransactionID || order.PaymentReference || 'N/A');
                        }}
                      >
                        <ImageIcon size={14} color="#16A34A" />
                        <Text style={styles.viewTxBtnText}>View Receipt</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Pay Modal */}
      <Modal visible={payModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Submit Payment</Text>
              <TouchableOpacity onPress={() => !isSubmitting && setPayModalOpen(false)}>
                <X size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              <View style={styles.modalPayFor}>
                <Text style={styles.modalPayForLabel}>PAYMENT FOR</Text>
                <Text style={styles.modalPayForVal}>Order {payOrderId}</Text>
              </View>

              <Text style={styles.inputLabel}>Transaction ID (UTR)</Text>
              <TextInput 
                style={styles.input} 
                value={transactionId} 
                onChangeText={setTransactionId} 
                placeholder="e.g. 123456789012"
                maxLength={35}
              />

              <Text style={styles.inputLabel}>Upload Receipt Screenshot</Text>
              <TouchableOpacity style={styles.uploadArea} onPress={handleFileChange}>
                {screenshotBase64 ? (
                  <View style={styles.previewContainer}>
                    <Image source={{ uri: screenshotBase64 }} style={styles.previewImage} resizeMode="contain" />
                    <View style={styles.previewCheck}>
                      <CheckCircle size={16} color="#FFF" />
                    </View>
                  </View>
                ) : (
                  <View style={styles.uploadPlaceholder}>
                    <UploadCloud size={32} color="#94A3B8" />
                    <Text style={styles.uploadText}>Tap to pick image</Text>
                    <Text style={styles.uploadSub}>JPEG, PNG, JPG</Text>
                  </View>
                )}
              </TouchableOpacity>
              
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setPayModalOpen(false)} disabled={isSubmitting}>
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalSubmitBtn} onPress={handlePaySubmit} disabled={isSubmitting}>
                  {isSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.modalSubmitBtnText}>Submit Payment</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* View Transaction Modal */}
      <Modal visible={!!viewReceiptUrl} transparent animationType="fade">
        <View style={styles.modalOverlayDark}>
          <TouchableOpacity 
            style={styles.closeViewBtn}
            onPress={() => { setViewReceiptUrl(null); setViewTransactionId(null); }}
          >
            <X size={28} color="#FFF" />
          </TouchableOpacity>
          
          <Text style={styles.viewTitle}>Transaction Details</Text>
          <View style={styles.viewIdPill}>
            <Text style={styles.viewIdLabel}>ID: </Text>
            <Text style={styles.viewIdVal}>{viewTransactionId}</Text>
          </View>
          
          {viewReceiptUrl && (
            <Image 
              source={{ uri: viewReceiptUrl }} 
              style={styles.viewImage} 
              resizeMode="contain" 
            />
          )}
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  header: { marginBottom: 20 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  headerSub: { fontSize: 14, color: '#8E8E93' },
  
  filterScroll: { flexGrow: 0, marginBottom: 20 },
  filterBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', marginRight: 8 },
  filterBtnActive: { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' },
  filterText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  filterTextActive: { color: '#FFF' },

  emptyState: { alignItems: 'center', padding: 40, backgroundColor: '#FFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', marginTop: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#1A1A1A', marginTop: 16, marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#8E8E93', textAlign: 'center' },

  list: { gap: 16 },
  card: { backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F2F2F7' },
  cardId: { fontSize: 16, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  cardDate: { fontSize: 12, color: '#8E8E93' },
  
  cardDetails: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  cardProduct: { fontSize: 14, fontWeight: '600', color: '#1A1A1A', marginBottom: 4 },
  cardQty: { fontSize: 12, color: '#8E8E93' },
  cardLabel: { fontSize: 10, color: '#8E8E93', fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  cardAmt: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'flex-end', paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F2F2F7' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F2F2F7', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 },
  actionBtnText: { fontSize: 12, fontWeight: '600', color: '#1A1A1A' },
  payBtn: { backgroundColor: '#1A1A1A', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6 },
  payBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  viewTxBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 },
  viewTxBtnText: { fontSize: 12, fontWeight: '600', color: '#16A34A' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'center', padding: 16 },
  modalContent: { backgroundColor: '#FFF', borderRadius: 12, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  modalBody: { padding: 16 },
  
  modalPayFor: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 6, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 },
  modalPayForLabel: { fontSize: 10, color: '#8E8E93', fontWeight: '700', marginBottom: 4 },
  modalPayForVal: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },

  inputLabel: { fontSize: 14, fontWeight: '600', color: '#1A1A1A', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 12, fontSize: 16, color: '#1A1A1A', marginBottom: 16 },
  
  uploadArea: { height: 160, borderWidth: 2, borderColor: '#CBD5E1', borderStyle: 'dashed', borderRadius: 8, backgroundColor: '#F8FAFC', overflow: 'hidden', marginBottom: 24 },
  uploadPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  uploadText: { fontSize: 14, fontWeight: '600', color: '#475569', marginTop: 8 },
  uploadSub: { fontSize: 12, color: '#94A3B8', marginTop: 4 },
  previewContainer: { flex: 1, padding: 8 },
  previewImage: { width: '100%', height: '100%', borderRadius: 4 },
  previewCheck: { position: 'absolute', top: 12, right: 12, backgroundColor: '#34C759', borderRadius: 12, padding: 2 },
  
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: { flex: 1, padding: 14, borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1', alignItems: 'center' },
  modalCancelBtnText: { color: '#475569', fontWeight: '600', fontSize: 16 },
  modalSubmitBtn: { flex: 2, padding: 14, borderRadius: 8, backgroundColor: '#1A1A1A', alignItems: 'center' },
  modalSubmitBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },

  modalOverlayDark: { flex: 1, backgroundColor: 'rgba(15,23,42,0.95)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  closeViewBtn: { position: 'absolute', top: 40, right: 20, zIndex: 10, padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20 },
  viewTitle: { color: '#FFF', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  viewIdPill: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, marginBottom: 32 },
  viewIdLabel: { color: '#9CA3AF', fontSize: 14 },
  viewIdVal: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  viewImage: { width: '100%', height: '60%', borderRadius: 8 }
});
