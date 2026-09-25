import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, Modal, ActivityIndicator } from 'react-native';
import { sheetsService } from '../../services/sheetsService';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../../components/StatusBadge';
import { useRealtime } from '../../hooks/useRealtime';
import { SearchFilter } from '../../components/SearchFilter';
import { ExportButton } from '../../components/ExportButton';
import { EditOrderModal } from '../../components/EditOrderModal';
import { Check, Calendar, User, History, ChevronUp, ChevronDown } from 'lucide-react-native';
import { isToday, isYesterday, isThisWeek, parseISO } from 'date-fns';
import { CardSkeleton } from '../../components/Skeleton';
import { Picker } from '@react-native-picker/picker';
import { Pagination } from '../../components/Pagination';
import { useLanguage } from '../../context/LanguageContext';

const QueueCard = ({ order, index, isExpanded, onToggleExpand, hist, isSubmitting, onApprove, onReject, onEdit }) => {
  const { t, tDynamic } = useLanguage();
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardNumber}>{(index + 1).toString().padStart(2, '0')}.</Text>
        <StatusBadge status={order.ApprovalStatus} />
      </View>

      <View style={styles.headline}>
        <View style={styles.reqBadge}><Text style={styles.reqBadgeText}>{t('ORDER REQUEST')}</Text></View>
        <Text style={styles.orderId}>{order.OrdID}</Text>
      </View>

      <View style={styles.clientInfo}>
        <Text style={styles.sectionLabel}>{t('CLIENT INFO')}</Text>
        <Text style={styles.companyName} numberOfLines={1}>{tDynamic(order.Company)}</Text>
        <Text style={styles.clientName} numberOfLines={1}>{tDynamic(order.Name)}</Text>
        <View style={styles.repRow}>
          <User size={12} color="#64748B" />
          <Text style={styles.repText} numberOfLines={1}>{t("Sales Rep:")} {tDynamic(order.SalesApproverID || 'System')}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.grid}>
        <View style={styles.gridItem}>
          <Text style={styles.sectionLabel}>{t('PRODUCT TYPE')}</Text>
          <Text style={styles.gridVal}>{tDynamic(order.Product)}</Text>
        </View>
        <View style={styles.gridItem}>
          <Text style={styles.sectionLabel}>{t('QUANTITY')}</Text>
          <Text style={styles.gridVal}>{order.EstimateQty} {order.Unit || 'tons'}</Text>
        </View>
        <View style={styles.gridItem}>
          <Text style={styles.sectionLabel}>{t('EST. AMOUNT')}</Text>
          <Text style={styles.gridVal}>₹{Number(order.EstimateAmt || 0).toLocaleString('en-IN')}</Text>
        </View>
        {order.City ?
        <View style={styles.gridItem}>
            <Text style={styles.sectionLabel}>{t('DESTINATION')}</Text>
            <Text style={styles.gridVal}>{tDynamic(order.City)}</Text>
          </View> :
        null}
      </View>

      {order.Notes ?
      <View style={styles.notesBox}>
          <Text style={styles.sectionLabel}>{t('NOTES')}</Text>
          <Text style={styles.notesText}>"{order.Notes.replace(' [Audio Note Attached]', '')}"</Text>
        </View> :
      null}

      <TouchableOpacity onPress={onToggleExpand} style={styles.historyBtn}>
        <History size={14} color="#0F172A" />
        <Text style={styles.historyText}>{t('Customer Profile')}</Text>
        {isExpanded ? <ChevronUp size={14} color="#0F172A" /> : <ChevronDown size={14} color="#0F172A" />}
      </TouchableOpacity>

      {isExpanded && hist &&
      <View style={styles.histGrid}>
          <View style={styles.histBox}>
            <Text style={styles.histNum}>{hist.TotalOrdersPlaced}</Text>
            <Text style={styles.histLbl}>{t('Total')}</Text>
          </View>
          <View style={styles.histBox}>
            <Text style={styles.histNum}>{hist.TotalOrdersClosedOnTime}</Text>
            <Text style={styles.histLbl}>{t('On Time')}</Text>
          </View>
          <View style={[styles.histBox, { borderRightWidth: 0 }]}>
            <Text style={styles.histNum}>{hist.TotalOrdersOverdue}</Text>
            <Text style={styles.histLbl}>{t('Overdue')}</Text>
          </View>
        </View>
      }

      <View style={styles.divider} />

      <View style={styles.actions}>
        <TouchableOpacity style={styles.editBtn} onPress={onEdit} disabled={isSubmitting}>
          <Text style={styles.editBtnText}>{t('EDIT')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.rejectBtn} onPress={onReject} disabled={isSubmitting}>
          <Text style={styles.rejectBtnText}>{t('REJECT')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.approveBtn} onPress={onApprove} disabled={isSubmitting}>
          <Text style={styles.approveBtnText}>{t('APPROVE')}</Text>
        </TouchableOpacity>
      </View>
    </View>);

};

export const AdminQueue = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [timeFilter, setTimeFilter] = useState('All Time');
  const [editingOrder, setEditingOrder] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [rejectingOrder, setRejectingOrder] = useState(null);
  const [overrideReason, setOverrideReason] = useState('');

  const [expandedOrders, setExpandedOrders] = useState({});
  const [customerHistory, setCustomerHistory] = useState({});

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useRealtime(['orders', 'profiles'], () => setRefreshKey((k) => k + 1));

  const fetchOrders = async () => {
    try {
      const data = await sheetsService.getOrders(user);
      const queue = data.filter((o) => o.ApprovalStatus === 'Pending Admin Approval' || o.ApprovalStatus === 'Pending Sales Approval');
      queue.sort((a, b) => new Date(a.OrderTimestamp) - new Date(b.OrderTimestamp));
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

  const toggleAccordion = (ordId) => {
    setExpandedOrders((prev) => ({ ...prev, [ordId]: !prev[ordId] }));
    if (!customerHistory[ordId]) {
      setCustomerHistory((prev) => ({
        ...prev,
        [ordId]: { TotalOrdersPlaced: 45, TotalOrdersClosedOnTime: 40, TotalOrdersOverdue: 5 }
      }));
    }
  };

  const handleApprove = async (ordId) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await sheetsService.updateOrderStatus(user, ordId, 'Ready for Dispatch');
      await fetchOrders();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {

    if (!overrideReason.trim()) {
      alert("Please provide a rejection reason.");
      return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await sheetsService.updateOrderStatus(user, rejectingOrder, t("Admin Rejected"), { reason: overrideReason });
      setRejectingOrder(null);
      setOverrideReason('');
      await fetchOrders();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <View style={{ padding: 16 }}><CardSkeleton /><CardSkeleton /></View>;

  const filteredOrders = orders.filter((o) => {

    const term = searchTerm.toLowerCase();
    const matchesSearch = o.OrdID?.toLowerCase().includes(term) ||
    o.Company?.toLowerCase().includes(term) ||
    o.Product?.toLowerCase().includes(term) ||
    o.Name?.toLowerCase().includes(term) ||
    o.SalesApproverID?.toLowerCase().includes(term);

    let matchesTime = true;
    if (timeFilter !== 'All Time' && o.OrderTimestamp) {
      let ts = o.OrderTimestamp;
      if (!ts.endsWith('Z') && !ts.includes('+')) ts += 'Z';
      const orderDate = new Date(ts);
      if (timeFilter === 'Today') matchesTime = isToday(orderDate);else
      if (timeFilter === 'Yesterday') matchesTime = isYesterday(orderDate);else
      if (timeFilter === 'Last 7 Days') matchesTime = isThisWeek(orderDate);
    }

    return matchesSearch && matchesTime;
  });

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.headerTitle} numberOfLines={2} adjustsFontSizeToFit>{t('Final Approval Queue')}</Text>
          </View>
          <ExportButton data={filteredOrders} filename="AdminQueue" />
        </View>

        <View style={styles.filters}>
          <View style={{ flex: 1 }}><SearchFilter value={searchTerm} onChange={setSearchTerm} placeholder={t("Search Order ID...")} /></View>
          <View style={styles.pickerWrapper}>
            <Calendar size={16} color="#8E8E93" style={styles.pickerIcon} />
            <Picker
              selectedValue={timeFilter}
              onValueChange={setTimeFilter}
              style={styles.picker}>
              
              <Picker.Item label={t("All Time")} value="All Time" />
              <Picker.Item label={t("Today")} value="Today" />
              <Picker.Item label={t("Yesterday")} value="Yesterday" />
              <Picker.Item label={t("Last 7 Days")} value="Last 7 Days" />
            </Picker>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        {filteredOrders.length === 0 ?
        <View style={styles.emptyState}>
            <Check size={48} color={searchTerm ? "#8E8E93" : "#34C759"} />
            <Text style={styles.emptyTitle}>{searchTerm ? 'No Results Found' : 'All Caught Up'}</Text>
            <Text style={styles.emptySub}>{searchTerm ? `No orders matching "${searchTerm}".` : 'No orders awaiting final approval.'}</Text>
          </View> :

        paginatedOrders.map((order, index) =>
        <QueueCard
          key={order.OrdID}
          index={index}
          order={order}
          isExpanded={!!expandedOrders[order.OrdID]}
          onToggleExpand={() => toggleAccordion(order.OrdID)}
          hist={customerHistory[order.OrdID]}
          isSubmitting={isSubmitting}
          onApprove={() => handleApprove(order.OrdID)}
          onReject={() => setRejectingOrder(order.OrdID)}
          onEdit={() => setEditingOrder(order)} />

        )
        }
      </View>

      {totalPages > 1 &&
      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
      }

      <Modal visible={!!editingOrder} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {editingOrder &&
            <EditOrderModal
              order={editingOrder}
              onClose={() => setEditingOrder(null)}
              onUpdate={() => {setEditingOrder(null);fetchOrders();}}
              inline />

            }
          </View>
        </View>
      </Modal>

      <Modal visible={!!rejectingOrder} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.rejectModal}>
            <Text style={styles.rejectTitle}>{t('REJECT REQUEST')}</Text>
            <Text style={styles.sectionLabel}>{t('REASON')}</Text>
            <TextInput
              style={styles.rejectInput}
              value={overrideReason}
              onChangeText={setOverrideReason}
              placeholder={t("Explain rejection reason...")}
              multiline
              textAlignVertical="top" />
            
            <View style={styles.rejectActions}>
              <TouchableOpacity style={styles.cancelRejectBtn} onPress={() => {setRejectingOrder(null);setOverrideReason('');}}>
                <Text style={styles.cancelRejectText}>{t('CANCEL')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmRejectBtn} onPress={handleReject} disabled={isSubmitting}>
                <Text style={styles.confirmRejectText}>{isSubmitting ? 'WAIT' : 'REJECT'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>);

};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E5EA', gap: 16 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '600', color: '#1A1A1A' },
  filters: { flexDirection: 'row', gap: 12 },
  pickerWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 8, backgroundColor: '#FFF', paddingHorizontal: 12 },
  pickerIcon: { marginRight: -10, zIndex: 1 },
  picker: { flex: 1, height: 40, marginLeft: -10 },

  content: { padding: 16, gap: 16, paddingBottom: 40 },
  emptyState: { padding: 48, alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, borderWidth: 1, borderColor: '#E5E5EA' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginTop: 16, marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#8E8E93', textAlign: 'center' },

  card: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E5EA', padding: 20, marginBottom: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardNumber: { fontSize: 32, fontWeight: '300', color: '#E2E8F0', fontFamily: 'monospace' },
  headline: { marginBottom: 16 },
  reqBadge: { backgroundColor: '#0F172A', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, marginBottom: 6 },
  reqBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  orderId: { fontSize: 22, fontWeight: '900', color: '#0F172A' },
  clientInfo: { marginBottom: 16 },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: '#94A3B8', letterSpacing: 1, marginBottom: 4 },
  companyName: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  clientName: { fontSize: 14, color: '#64748B' },
  repRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  repText: { fontSize: 12, color: '#64748B', flexShrink: 1 },
  divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  gridItem: { width: '45%' },
  gridVal: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  notesBox: { backgroundColor: '#F8FAFC', padding: 12, borderLeftWidth: 2, borderLeftColor: '#0F172A', marginTop: 16 },
  notesText: { fontSize: 14, fontStyle: 'italic', color: '#0F172A', fontWeight: '500' },
  historyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, paddingVertical: 8 },
  historyText: { fontSize: 12, fontWeight: '800', color: '#0F172A' },
  histGrid: { flexDirection: 'row', backgroundColor: '#FAFAFA', marginTop: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  histBox: { flex: 1, padding: 12, borderRightWidth: 1, borderRightColor: '#E2E8F0', alignItems: 'center' },
  histNum: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  histLbl: { fontSize: 10, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  editBtn: { flex: 1, borderWidth: 1, borderColor: '#0F172A', backgroundColor: '#F8FAFC', alignItems: 'center', padding: 12 },
  editBtnText: { color: '#0F172A', fontWeight: '800', fontSize: 12, letterSpacing: 1 },
  rejectBtn: { flex: 1, borderWidth: 1, borderColor: '#0F172A', backgroundColor: '#FFF', alignItems: 'center', padding: 12 },
  rejectBtnText: { color: '#0F172A', fontWeight: '800', fontSize: 12, letterSpacing: 1 },
  approveBtn: { flex: 1, backgroundColor: '#0F172A', alignItems: 'center', padding: 12 },
  approveBtnText: { color: '#FFF', fontWeight: '800', fontSize: 12, letterSpacing: 1 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  modalContent: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, maxHeight: '90%' },
  rejectModal: { backgroundColor: '#FFF', padding: 24, borderWidth: 1, borderColor: '#0F172A' },
  rejectTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 20, letterSpacing: 1 },
  rejectInput: { borderWidth: 1, borderColor: '#E2E8F0', padding: 12, fontSize: 14, minHeight: 100, marginBottom: 20, backgroundColor: '#FFF' },
  rejectActions: { flexDirection: 'row', gap: 8 },
  cancelRejectBtn: { flex: 1, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', padding: 12, alignItems: 'center' },
  cancelRejectText: { color: '#0F172A', fontWeight: '800', fontSize: 12, letterSpacing: 1 },
  confirmRejectBtn: { flex: 1, backgroundColor: '#0F172A', padding: 12, alignItems: 'center' },
  confirmRejectText: { color: '#FFF', fontWeight: '800', fontSize: 12, letterSpacing: 1 }
});