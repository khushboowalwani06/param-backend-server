import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Package, CheckCircle, XCircle } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { sheetsService } from '../../services/sheetsService';
import { useRealtime } from '../../hooks/useRealtime';
import { Pagination } from '../../components/Pagination';

export default function CustomerOrders() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [refreshKey, setRefreshKey] = useState(0);
  const [confirmOrder, setConfirmOrder] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useRealtime(['orders'], () => setRefreshKey(k => k + 1));

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const data = await sheetsService.getOrders(user);
        const myOrders = data.filter(o => o.UserID === user.UserID);
        myOrders.sort((a, b) => new Date(b.OrderTimestamp) - new Date(a.OrderTimestamp));
        setOrders(myOrders);
        setCurrentPage(1);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, [user, refreshKey]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1A1A1A" />
      </View>
    );
  }

  const validOrders = orders.filter(o => !o.ApprovalStatus.includes('Rejected') && o.ApprovalStatus !== 'Cancelled');
  const totalIncurred = validOrders.reduce((sum, o) => sum + (Number(o.EstimateAmt) || 0), 0);
  const activeCount = orders.filter(o => !['Delivered', 'Pending Invoice', 'Payment Pending', 'Payment Sent', 'Closed', 'Rejected', 'Admin Rejected', 'Sales Rejected', 'Cancelled'].includes(o.ApprovalStatus) && o.ApprovalStatus !== 'Draft').length;
  const dispatchedCount = orders.filter(o => o.ApprovalStatus.includes('Dispatch') || o.ApprovalStatus.includes('Transit')).length;
  const deliveredCount = orders.filter(o => ['Delivered', 'Pending Invoice', 'Payment Pending', 'Payment Sent', 'Closed'].includes(o.ApprovalStatus)).length;

  const filteredOrders = orders.filter(o => {
    if (activeFilter === 'PENDING') return o.ApprovalStatus === 'Pending Sales Approval' || o.ApprovalStatus === 'Pending Admin Approval';
    if (activeFilter === 'DISPATCHED') return o.ApprovalStatus.includes('Dispatch') || o.ApprovalStatus.includes('Transit') || o.ApprovalStatus.includes('Ready');
    if (activeFilter === 'DELIVERED') return ['Delivered', 'Pending Invoice', 'Payment Pending', 'Payment Sent', 'Closed'].includes(o.ApprovalStatus);
    if (activeFilter === 'REJECTED') return o.ApprovalStatus.includes('Rejected');
    return true;
  });

  const getProgressState = (status) => {
    const states = { sales: false, admin: false, dispatch: false, delivered: false, invoiced: false, current: '' };
    if (!status || status === 'Draft') return states;
    const s = String(status).toLowerCase();
    
    if (s.includes('reject')) { states.current = 'rejected'; return states; }
    states.sales = true;
    
    if (s.includes('admin') || (s.includes('approve') && !s.includes('dispatch'))) {
      states.sales = true; states.current = 'admin';
    } 
    if (s.includes('dispatch') || s.includes('transit') || s.includes('ready')) {
      states.admin = true; states.dispatch = true; states.current = 'dispatch';
    } 
    if (s.includes('deliver')) {
      states.admin = true; states.dispatch = true; states.delivered = true; states.current = 'delivered';
    } 
    if (s.includes('invoice') || s.includes('close') || s.includes('payment')) {
      states.admin = true; states.dispatch = true; states.delivered = true; states.invoiced = true; states.current = 'invoiced';
    } 
    if (!states.current) states.current = 'sales';
    return states;
  };

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      
      {/* Quick Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statChip, { backgroundColor: '#1A1A1A' }]}>
          <Text style={[styles.statLabel, { color: 'rgba(255,255,255,0.7)' }]}>Total Incurred</Text>
          <Text style={[styles.statValue, { color: '#FFF' }]}>₹{totalIncurred.toLocaleString()}</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={styles.statLabel}>Active</Text>
          <Text style={[styles.statValue, { color: '#0056D2' }]}>{activeCount}</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={styles.statLabel}>Dispatched</Text>
          <Text style={[styles.statValue, { color: '#007AFF' }]}>{dispatchedCount}</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={styles.statLabel}>Delivered</Text>
          <Text style={[styles.statValue, { color: '#34C759' }]}>{deliveredCount}</Text>
        </View>
      </View>

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={{ paddingRight: 16 }}>
        {['ALL', 'PENDING', 'DISPATCHED', 'DELIVERED', 'REJECTED'].map(filter => (
          <TouchableOpacity 
            key={filter}
            style={[styles.filterBtn, activeFilter === filter && styles.filterBtnActive]}
            onPress={() => setActiveFilter(filter)}
          >
            <Text style={[styles.filterText, activeFilter === filter && styles.filterTextActive]}>{filter}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <View style={styles.emptyState}>
          <Package size={48} color="#C7C7CC" />
          <Text style={styles.emptyTitle}>No Orders Found</Text>
          <Text style={styles.emptySub}>You don't have any orders matching this status.</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('customer/new-order')}>
            <Text style={styles.emptyBtnText}>Place New Order</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.orderList}>
          {paginatedOrders.map(order => {
            const progress = getProgressState(order.ApprovalStatus);
            const isRejected = progress.current === 'rejected';
            const isConfirming = confirmOrder === order.OrdID;

            return (
              <View key={order.OrdID} style={styles.orderCard}>
                
                {isConfirming ? (
                  <View style={styles.confirmView}>
                    <CheckCircle size={40} color="#34C759" />
                    <Text style={styles.confirmTitle}>Verify Delivery</Text>
                    <Text style={styles.confirmSub}>Please confirm you have received order {order.OrdID}.</Text>
                    
                    <View style={styles.confirmActions}>
                      <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmOrder(null)}>
                        <Text style={styles.cancelBtnText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.issueBtn} 
                        onPress={() => {
                          setConfirmOrder(null);
                          navigation.navigate('customer/disputes'); // Needs param in a real router context
                        }}
                      >
                        <Text style={styles.issueBtnText}>Raise Issue</Text>
                      </TouchableOpacity>
                    </View>
                    
                    <TouchableOpacity 
                      style={styles.completeBtn}
                      onPress={async () => {
                        try {
                          await sheetsService.updateOrderStatus(user, order.OrdID, 'Pending Invoice');
                          setRefreshKey(k => k + 1);
                          setConfirmOrder(null);
                        } catch (err) {
                          alert('Failed to mark complete');
                        }
                      }}
                    >
                      <Text style={styles.completeBtnText}>Mark Complete</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <View style={styles.orderHeader}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={styles.orderId} numberOfLines={1}>{order.OrdID}</Text>
                        <Text style={styles.orderDate}>{new Date(order.OrderTimestamp).toLocaleDateString()}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.orderAmt}>₹{order.EstimateAmt?.toLocaleString()}</Text>
                        <Text style={styles.orderQty}>{order.EstimateQty} {order.Unit || 'Tons'}</Text>
                      </View>
                    </View>

                    {isRejected ? (
                      <View style={styles.rejectBox}>
                        <View style={styles.rejectRow}>
                          <XCircle size={16} color="#DC2626" />
                          <Text style={styles.rejectText}>Order Rejected</Text>
                        </View>
                        {!!order.RejectionReason && (
                          <View style={styles.rejectReasonBox}>
                            <Text style={styles.rejectReasonText}>Reason: {order.RejectionReason}</Text>
                          </View>
                        )}
                      </View>
                    ) : (
                      <View style={styles.trackerContainer}>
                        <View style={styles.trackerLineBg}>
                          <View style={[styles.trackerLineFill, { 
                            width: progress.invoiced ? '100%' : progress.delivered ? '75%' : progress.dispatch ? '50%' : progress.admin ? '25%' : '0%' 
                          }]} />
                        </View>
                        <View style={styles.trackerNodes}>
                          <View style={styles.node}><View style={[styles.dot, progress.sales && styles.dotActive]} /></View>
                          <View style={styles.node}><View style={[styles.dot, progress.admin && styles.dotActive]} /></View>
                          <View style={styles.node}><View style={[styles.dot, progress.dispatch && styles.dotActive]} /></View>
                          <View style={styles.node}><View style={[styles.dot, progress.delivered && styles.dotActive]} /></View>
                          <View style={styles.node}><View style={[styles.dot, progress.invoiced && styles.dotActive]} /></View>
                        </View>
                      </View>
                    )}

                    <View style={styles.orderFooter}>
                      <View style={[styles.productRow, { flex: 1, paddingRight: 8 }]}>
                        <Package size={14} color="#8E8E93" />
                        <Text style={styles.productText} numberOfLines={1}>{order.Product}</Text>
                      </View>
                      <View style={styles.footerActions}>
                        {order.ApprovalStatus === 'Delivered' && (
                          <TouchableOpacity style={styles.verifyBtn} onPress={() => setConfirmOrder(order.OrdID)}>
                            <CheckCircle size={12} color="#FFF" />
                            <Text style={styles.verifyBtnText}>Confirm Receipt</Text>
                          </TouchableOpacity>
                        )}
                        <View style={styles.statusPill}>
                          <Text style={styles.statusText}>{order.ApprovalStatus}</Text>
                        </View>
                      </View>
                    </View>
                  </>
                )}
              </View>
            );
          })}
        </View>
      )}

      {totalPages > 1 && (
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  statChip: { flex: 1, minWidth: '45%', backgroundColor: '#FFF', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  statLabel: { fontSize: 12, color: '#8E8E93', fontWeight: '600', marginBottom: 4 },
  statValue: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },

  filterScroll: { flexGrow: 0, marginBottom: 20 },
  filterBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', marginRight: 8 },
  filterBtnActive: { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' },
  filterText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  filterTextActive: { color: '#FFF' },

  emptyState: { alignItems: 'center', padding: 40, backgroundColor: '#FFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#1A1A1A', marginTop: 16, marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#8E8E93', textAlign: 'center', marginBottom: 24 },
  emptyBtn: { backgroundColor: '#1A1A1A', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  emptyBtnText: { color: '#FFF', fontWeight: '600', fontSize: 14 },

  orderList: { gap: 16 },
  orderCard: { backgroundColor: '#FFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  orderId: { fontSize: 16, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  orderDate: { fontSize: 12, color: '#8E8E93' },
  orderAmt: { fontSize: 16, fontWeight: '700', color: '#0056D2', marginBottom: 4 },
  orderQty: { fontSize: 12, color: '#8E8E93' },

  rejectBox: { backgroundColor: '#FEF2F2', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#FECACA', marginBottom: 20 },
  rejectRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  rejectText: { color: '#DC2626', fontWeight: '600', fontSize: 14 },
  rejectReasonBox: { backgroundColor: '#FFF', padding: 8, borderRadius: 4, borderWidth: 1, borderColor: '#FECACA' },
  rejectReasonText: { color: '#991B1B', fontSize: 12, fontWeight: '500' },

  trackerContainer: { position: 'relative', marginBottom: 24, paddingHorizontal: 8 },
  trackerLineBg: { position: 'absolute', top: 6, left: 16, right: 16, height: 2, backgroundColor: '#E2E8F0' },
  trackerLineFill: { height: '100%', backgroundColor: '#34C759' },
  trackerNodes: { flexDirection: 'row', justifyContent: 'space-between' },
  node: { alignItems: 'center' },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#FFF', borderWidth: 2, borderColor: '#E2E8F0' },
  dotActive: { backgroundColor: '#34C759', borderColor: '#34C759' },

  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 16, flexWrap: 'wrap', gap: 8 },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  productText: { fontSize: 12, color: '#8E8E93', fontWeight: '500' },
  footerActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  verifyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#34C759', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 4 },
  verifyBtnText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  statusPill: { backgroundColor: '#F2F2F7', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 4 },
  statusText: { fontSize: 10, fontWeight: '700', color: '#1A1A1A' },

  confirmView: { alignItems: 'center', padding: 16 },
  confirmTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginTop: 12, marginBottom: 8 },
  confirmSub: { fontSize: 14, color: '#8E8E93', textAlign: 'center', marginBottom: 24 },
  confirmActions: { flexDirection: 'row', gap: 12, width: '100%', marginBottom: 12 },
  cancelBtn: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  cancelBtnText: { color: '#64748B', fontWeight: '600' },
  issueBtn: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2', alignItems: 'center' },
  issueBtnText: { color: '#DC2626', fontWeight: '600' },
  completeBtn: { width: '100%', padding: 14, borderRadius: 8, backgroundColor: '#34C759', alignItems: 'center' },
  completeBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 }
});
