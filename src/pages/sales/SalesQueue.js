import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, Modal, ActivityIndicator } from 'react-native';
import { sheetsService } from '../../services/sheetsService';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../../components/StatusBadge';
import { useRealtime } from '../../hooks/useRealtime';
import { SearchFilter } from '../../components/SearchFilter';
import { ExportButton } from '../../components/ExportButton';
import { EditOrderModal } from '../../components/EditOrderModal';
import { Check, Calendar, User, History, ChevronUp, ChevronDown, Target } from 'lucide-react-native';
import { isThisMonth } from 'date-fns';
import { CardSkeleton } from '../../components/Skeleton';

const QueueCard = ({ order, index, isExpanded, onToggleExpand, hist, isSubmitting, onApprove, onReject, onEdit }) => {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardNumber}>{(index + 1).toString().padStart(2, '0')}.</Text>
        <StatusBadge status={order.ApprovalStatus} />
      </View>

      <View style={styles.headline}>
        <View style={styles.reqBadge}><Text style={styles.reqBadgeText}>ORDER REQUEST</Text></View>
        <Text style={styles.orderId}>{order.OrdID}</Text>
      </View>

      <View style={styles.clientInfo}>
        <Text style={styles.sectionLabel}>CLIENT INFO</Text>
        <Text style={styles.companyName} numberOfLines={1}>{order.Company}</Text>
        <Text style={styles.clientName} numberOfLines={1}>{order.Name}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.grid}>
        <View style={styles.gridItem}>
          <Text style={styles.sectionLabel}>PRODUCT TYPE</Text>
          <Text style={styles.gridVal} numberOfLines={1}>{order.Product}</Text>
        </View>
        <View style={styles.gridItem}>
          <Text style={styles.sectionLabel}>QUANTITY</Text>
          <Text style={styles.gridVal}>{order.EstimateQty} {order.Unit || 'tons'}</Text>
        </View>
        <View style={styles.gridItem}>
          <Text style={styles.sectionLabel}>EST. AMOUNT</Text>
          <Text style={styles.gridVal}>₹{Number(order.EstimateAmt || 0).toLocaleString('en-IN')}</Text>
        </View>
        {order.City ? (
          <View style={styles.gridItem}>
            <Text style={styles.sectionLabel}>DESTINATION</Text>
            <Text style={styles.gridVal} numberOfLines={1}>{order.City}</Text>
          </View>
        ) : null}
      </View>

      {order.Notes ? (
        <View style={styles.notesBox}>
          <Text style={styles.sectionLabel}>NOTES</Text>
          <Text style={styles.notesText}>"{order.Notes.replace(' [Audio Note Attached]', '')}"</Text>
        </View>
      ) : null}

      <TouchableOpacity onPress={onToggleExpand} style={styles.historyBtn}>
        <History size={14} color="#0F172A" />
        <Text style={styles.historyText}>Customer Profile</Text>
        {isExpanded ? <ChevronUp size={14} color="#0F172A" /> : <ChevronDown size={14} color="#0F172A" />}
      </TouchableOpacity>

      {isExpanded && hist && (
        <View style={styles.histGrid}>
          <View style={styles.histBox}>
            <Text style={styles.histNum}>{hist.TotalOrdersPlaced}</Text>
            <Text style={styles.histLbl}>Total</Text>
          </View>
          <View style={styles.histBox}>
            <Text style={styles.histNum}>{hist.TotalOrdersClosedOnTime}</Text>
            <Text style={styles.histLbl}>On Time</Text>
          </View>
          <View style={[styles.histBox, { borderRightWidth: 0 }]}>
            <Text style={styles.histNum}>{hist.TotalOrdersOverdue}</Text>
            <Text style={styles.histLbl}>Overdue</Text>
          </View>
        </View>
      )}

      <View style={styles.divider} />

      <View style={styles.actions}>
        <TouchableOpacity style={styles.editBtn} onPress={onEdit} disabled={isSubmitting}>
          <Text style={styles.editBtnText}>EDIT</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.rejectBtn} onPress={onReject} disabled={isSubmitting}>
          <Text style={styles.rejectBtnText}>REJECT</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.approveBtn} onPress={onApprove} disabled={isSubmitting}>
          <Check size={16} color="#FFF" />
          <Text style={styles.approveBtnText}>APPROVE</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function SalesQueue() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [dealers, setDealers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [expandedOrders, setExpandedOrders] = useState({});
  const [customerHistory, setCustomerHistory] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  
  const [monthlyVolume, setMonthlyVolume] = useState(0);
  const [dailyVisits, setDailyVisits] = useState(0);
  const VOLUME_TARGET = 1000;
  const VISITS_TARGET = 8;
  
  const [submittingIds, setSubmittingIds] = useState(new Set());
  const [refreshKey, setRefreshKey] = useState(0);

  // Edit Modal State
  const [editingOrder, setEditingOrder] = useState(null);
  
  // Reject Modal State
  const [rejectingOrder, setRejectingOrder] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  useRealtime(['orders', 'profiles'], () => setRefreshKey(k => k + 1));

  const fetchData = async () => {
    try {
      const [ordersData, visitsData] = await Promise.all([
        sheetsService.getOrders(user),
        sheetsService.getVisits ? sheetsService.getVisits().catch(() => []) : Promise.resolve([])
      ]);

      const queue = ordersData.filter(o => o.ApprovalStatus === 'Pending Sales Approval');
      queue.sort((a, b) => new Date(a.OrderTimestamp) - new Date(b.OrderTimestamp));
      setOrders(queue);

      let thisMonthVolume = 0;
      ordersData.forEach(o => {
        if (!o.OrderTimestamp) return;
        let ts = o.OrderTimestamp;
        if (!ts.endsWith('Z') && !ts.includes('+')) ts += 'Z';
        if (isThisMonth(new Date(ts))) {
          if (o.ApprovalStatus !== 'Sales Rejected' && o.ApprovalStatus !== 'Admin Rejected') {
            const qty = Number(o.EstimateQty) || 0;
            thisMonthVolume += o.Unit === 'Bags' ? (qty / 20) : qty;
          }
        }
      });
      setMonthlyVolume(thisMonthVolume);

      const todayStr = new Date().toISOString().split('T')[0];
      const myVisitsToday = visitsData.filter(v => 
        v.sales_rep_id === user.UserID && v.date && v.date.startsWith(todayStr)
      );
      setDailyVisits(myVisitsToday.length);

      try {
        const allUsers = await sheetsService.getAllUsers(user); 
        const onlyDealers = allUsers.filter(u => u.Role === 'customer' || u.Role === 'dealer');
        setDealers(onlyDealers);
      } catch (e) {
        console.warn('Could not fetch dealers for balances view.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user, refreshKey]);

  const loadHistory = async (userId, ordId) => {
    try {
      const allUsers = await sheetsService.getAllUsers(user);
      const histUser = allUsers.find(u => u.UserID === userId);
      if (histUser) {
        setCustomerHistory(prev => ({
          ...prev,
          [ordId]: {
            TotalOrdersPlaced: 45, 
            TotalOrdersClosedOnTime: 40,
            TotalOrdersOverdue: 5,
            OutstandingAmount: histUser.OutstandingAmount || 0
          }
        }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleExpand = (order) => {
    const isExpanding = !expandedOrders[order.OrdID];
    setExpandedOrders(prev => ({ ...prev, [order.OrdID]: isExpanding }));
    if (isExpanding && !customerHistory[order.OrdID]) {
      loadHistory(order.CustomerID, order.OrdID);
    }
  };

  const handleApprove = async (ordId) => {
    setSubmittingIds(prev => new Set(prev).add(ordId));
    try {
      await sheetsService.updateOrderStatus(user, ordId, 'Pending Admin Approval');
      setRefreshKey(k => k + 1);
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmittingIds(prev => {
        const next = new Set(prev);
        next.delete(ordId);
        return next;
      });
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectReason.trim()) {
      alert('Please provide a reason');
      return;
    }
    const ordId = rejectingOrder;
    setSubmittingIds(prev => new Set(prev).add(ordId));
    setRejectingOrder(null);
    setRejectReason('');
    try {
      await sheetsService.updateOrderStatus(user, ordId, 'Sales Rejected', { reason: rejectReason });
      setRefreshKey(k => k + 1);
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmittingIds(prev => {
        const next = new Set(prev);
        next.delete(ordId);
        return next;
      });
    }
  };

  const filteredOrders = orders.filter(o => {
    if (!searchQuery) return true;
    const term = searchQuery.toLowerCase();
    return o.OrdID?.toLowerCase().includes(term) || o.Company?.toLowerCase().includes(term);
  });

  if (loading) {
    return (
      <View style={{ flex: 1, padding: 16 }}>
        <CardSkeleton />
        <CardSkeleton />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.header}>
          <Text style={styles.title}>Sales Queue</Text>
          <Text style={styles.subtitle}>{orders.length} Orders awaiting sales review</Text>
        </View>

        <View style={styles.targetsCard}>
          <Text style={styles.targetsTitle}>My Monthly Targets</Text>
          <View style={styles.targetsGrid}>
            <View style={styles.targetCol}>
              <Text style={styles.targetLabel}>Volume (Tons)</Text>
              <Text style={styles.targetVal} adjustsFontSizeToFit numberOfLines={1}>{monthlyVolume.toFixed(1)} / {VOLUME_TARGET}</Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${Math.min(100, (monthlyVolume/VOLUME_TARGET)*100)}%` }]} />
              </View>
            </View>
            <View style={styles.targetCol}>
              <Text style={styles.targetLabel}>Daily Visits</Text>
              <Text style={styles.targetVal}>{dailyVisits} / {VISITS_TARGET}</Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${Math.min(100, (dailyVisits/VISITS_TARGET)*100)}%` }]} />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.tools}>
          <SearchFilter value={searchQuery} onChange={setSearchQuery} placeholder="Search orders..." />
          <ExportButton data={filteredOrders} filename="sales_queue" />
        </View>

        {filteredOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <Check size={48} color="#94A3B8" />
            <Text style={styles.emptyTitle}>Queue is Clear!</Text>
            <Text style={styles.emptySub}>No orders currently awaiting your approval.</Text>
          </View>
        ) : (
          filteredOrders.map((order, idx) => (
            <QueueCard
              key={order.OrdID}
              order={order}
              index={idx}
              isExpanded={expandedOrders[order.OrdID]}
              onToggleExpand={() => handleToggleExpand(order)}
              hist={customerHistory[order.OrdID]}
              isSubmitting={submittingIds.has(order.OrdID)}
              onApprove={() => handleApprove(order.OrdID)}
              onReject={() => setRejectingOrder(order.OrdID)}
              onEdit={() => setEditingOrder(order)}
            />
          ))
        )}
      </ScrollView>

      {/* Reject Modal */}
      <Modal visible={!!rejectingOrder} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reject Order {rejectingOrder}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Reason for rejection..."
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setRejectingOrder(null)}>
                <Text style={styles.modalCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSubmit} onPress={handleRejectSubmit}>
                <Text style={styles.modalSubmitText}>CONFIRM REJECT</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Modal Placeholder */}
      {editingOrder && (
        <EditOrderModal
          order={editingOrder}
          onClose={() => setEditingOrder(null)}
          onSave={async (updatedData) => {
            await sheetsService.updateOrder(user, editingOrder.OrdID, updatedData);
            setEditingOrder(null);
            setRefreshKey(k => k + 1);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  targetsCard: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 20,
  },
  targetsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  targetsGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  targetCol: {
    flex: 1,
  },
  targetLabel: {
    fontSize: 12,
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  targetVal: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#F1F5F9',
    width: '100%',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
  },
  tools: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
    zIndex: 10,
  },
  card: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cardNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  headline: {
    padding: 16,
    paddingBottom: 8,
  },
  reqBadge: {
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  reqBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  orderId: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  clientInfo: {
    padding: 16,
    paddingTop: 0,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 1,
    marginBottom: 4,
  },
  companyName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  clientName: {
    fontSize: 14,
    color: '#475569',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 16,
  },
  gridItem: {
    width: '45%',
  },
  gridVal: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0F172A',
  },
  notesBox: {
    padding: 16,
    backgroundColor: '#F8FAFC',
    marginHorizontal: 16,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#94A3B8',
  },
  notesText: {
    fontSize: 13,
    color: '#475569',
    fontStyle: 'italic',
  },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#F1F5F9',
    gap: 8,
  },
  historyText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
    textTransform: 'uppercase',
  },
  histGrid: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  histBox: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
  },
  histNum: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  histLbl: {
    fontSize: 10,
    color: '#64748B',
    textTransform: 'uppercase',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
  },
  editBtn: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  rejectBtn: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
  },
  rejectBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  approveBtn: {
    flex: 2,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
    gap: 8,
  },
  approveBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
    marginTop: 16,
  },
  emptySub: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFF',
    width: '100%',
    maxWidth: 400,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    fontSize: 14,
    color: '#0F172A',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalCancel: {
    padding: 12,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  modalSubmit: {
    backgroundColor: '#DC2626',
    padding: 12,
    paddingHorizontal: 20,
  },
  modalSubmitText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
});
