import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Animated, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Package, CheckCircle, XCircle, Calendar as CalendarIcon, X } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { sheetsService } from '../../services/sheetsService';
import { useRealtime } from '../../hooks/useRealtime';
import { Pagination } from '../../components/Pagination';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLanguage } from '../../context/LanguageContext';
const getProgressState = status => {
  const states = {
    sales: false,
    admin: false,
    dispatch: false,
    delivered: false,
    invoiced: false,
    current: ''
  };
  if (!status || status === 'Draft') return states;
  const s = String(status).toLowerCase();
  if (s.includes('reject')) {
    states.current = 'rejected';
    return states;
  }
  states.sales = true;
  if (s.includes('admin') || s.includes('approve') && !s.includes('dispatch')) {
    states.sales = true;
    states.current = 'admin';
  }
  if (s.includes('dispatch') || s.includes('transit') || s.includes('ready')) {
    states.admin = true;
    states.dispatch = true;
    states.current = 'dispatch';
  }
  if (s.includes('deliver')) {
    states.admin = true;
    states.dispatch = true;
    states.delivered = true;
    states.current = 'delivered';
  }
  if (s.includes('invoice') || s.includes('close') || s.includes('payment')) {
    states.admin = true;
    states.dispatch = true;
    states.delivered = true;
    states.invoiced = true;
    states.current = 'invoiced';
  }
  if (!states.current) states.current = 'sales';
  return states;
};
const OrderCardItem = ({
  order,
  user,
  navigation,
  onRefresh
}) => {
  const {
    t
  } = useLanguage();
  const progress = getProgressState(order.ApprovalStatus);
  const isRejected = progress.current === 'rejected';
  const flipAnim = useRef(new Animated.Value(0)).current;
  const [isFlipped, setIsFlipped] = useState(false);
  const flipCard = toFlipped => {
    const {
      t
    } = useLanguage();
    setIsFlipped(toFlipped);
    Animated.spring(flipAnim, {
      toValue: toFlipped ? 180 : 0,
      friction: 8,
      tension: 10,
      useNativeDriver: true
    }).start();
  };
  const frontOpacity = flipAnim.interpolate({
    inputRange: [0, 89, 90, 180],
    outputRange: [1, 1, 0, 0]
  });
  const backOpacity = flipAnim.interpolate({
    inputRange: [0, 89, 90, 180],
    outputRange: [0, 0, 1, 1]
  });
  const frontTransform = [{
    rotateY: flipAnim.interpolate({
      inputRange: [0, 180],
      outputRange: ['0deg', '180deg']
    })
  }];
  const backTransform = [{
    rotateY: flipAnim.interpolate({
      inputRange: [0, 180],
      outputRange: ['180deg', '360deg']
    })
  }];
  return <View style={styles.cardContainer}>
      {/* Front of Card */}
      <Animated.View style={[styles.orderCard, styles.cardFace, {
      opacity: frontOpacity,
      transform: frontTransform,
      zIndex: isFlipped ? 0 : 1
    }]}>
        <View style={styles.orderHeader}>
          <View style={{
          flex: 1,
          paddingRight: 8
        }}>
            <Text style={styles.orderId} numberOfLines={1}>{order.OrdID}</Text>
            <Text style={styles.orderDate}>{new Date(order.OrderTimestamp).toLocaleDateString()}</Text>
          </View>
          <View style={{
          alignItems: 'flex-end'
        }}>
            <Text style={styles.orderAmt}>₹{order.EstimateAmt?.toLocaleString()}</Text>
            <Text style={styles.orderQty}>{order.EstimateQty} {order.Unit || 'Tons'}</Text>
          </View>
        </View>

        {isRejected ? <View style={styles.rejectBox}>
            <View style={styles.rejectRow}>
              <XCircle size={16} color="#DC2626" />
              <Text style={styles.rejectText}>{t('Order Rejected')}</Text>
            </View>
            {!!order.RejectionReason && <View style={styles.rejectReasonBox}>
                <Text style={styles.rejectReasonText}>Reason: {order.RejectionReason}</Text>
              </View>}
          </View> : <View style={styles.trackerContainer}>
            <View style={styles.trackerLineBg}>
              <View style={[styles.trackerLineFill, {
            width: progress.invoiced ? '100%' : progress.delivered ? '75%' : progress.dispatch ? '50%' : progress.admin ? '25%' : '0%'
          }]} />
            </View>
            <View style={styles.trackerNodes}>
              <View style={styles.node}>
                <View style={[styles.dot, progress.sales && styles.dotActive]} />
                <Text style={[styles.nodeLabel, progress.sales && styles.nodeLabelActive]}>{t('Under Process')}</Text>
              </View>
              <View style={styles.node}>
                <View style={[styles.dot, progress.admin && styles.dotActive]} />
                <Text style={[styles.nodeLabel, progress.admin && styles.nodeLabelActive]}>{t('Loading')}</Text>
              </View>
              <View style={styles.node}>
                <View style={[styles.dot, progress.dispatch && styles.dotActive]} />
                <Text style={[styles.nodeLabel, progress.dispatch && styles.nodeLabelActive]}>{t('Transit')}</Text>
              </View>
              <View style={styles.node}>
                <View style={[styles.dot, progress.delivered && styles.dotActive]} />
                <Text style={[styles.nodeLabel, progress.delivered && styles.nodeLabelActive]}>{t('Delivered')}</Text>
              </View>
              <View style={styles.node}>
                <View style={[styles.dot, progress.invoiced && styles.dotActive]} />
                <Text style={[styles.nodeLabel, progress.invoiced && styles.nodeLabelActive]}>{t('Invoice')}</Text>
              </View>
            </View>
          </View>}

        <View style={styles.orderFooter}>
          <View style={[styles.productRow, {
          flex: 1,
          paddingRight: 8
        }]}>
            <Package size={14} color="#8E8E93" />
            <Text style={styles.productText} numberOfLines={1}>{order.Product}</Text>
          </View>
          <View style={styles.footerActions}>
            {order.ApprovalStatus === 'Delivered' && <TouchableOpacity style={styles.verifyBtn} onPress={() => flipCard(true)}>
                <CheckCircle size={12} color="#FFF" />
                <Text style={styles.verifyBtnText}>{t('Confirm Receipt')}</Text>
              </TouchableOpacity>}
            <View style={styles.statusPill}>
              <Text style={styles.statusText}>{order.ApprovalStatus}</Text>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* Back of Card (Verification View) */}
      <Animated.View style={[styles.orderCard, styles.cardFace, styles.cardBack, {
      opacity: backOpacity,
      transform: backTransform,
      zIndex: isFlipped ? 1 : 0
    }]}>
        <View style={styles.confirmView}>
          <CheckCircle size={40} color="#34C759" />
          <Text style={styles.confirmTitle}>{t('Verify Delivery')}</Text>
          <Text style={styles.confirmSub}>Please confirm you have received order {order.OrdID}.</Text>
          
          <View style={styles.confirmActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => flipCard(false)}>
              <Text style={styles.cancelBtnText}>{t('Cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.issueBtn} onPress={() => {
            flipCard(false);
            navigation.navigate('customer/disputes');
          }}>
              <Text style={styles.issueBtnText}>{t('Raise Issue')}</Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity style={styles.completeBtn} onPress={async () => {
          try {
            await sheetsService.updateOrderStatus(user, order.OrdID, 'Pending Invoice');
            onRefresh();
            flipCard(false);
          } catch (err) {
            alert('Failed to mark complete');
          }
        }}>
            <Text style={styles.completeBtnText}>{t('Mark Complete')}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>;
};
export default function CustomerOrders() {
  const {
    t
  } = useLanguage();
  const {
    user
  } = useAuth();
  const navigation = useNavigation();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [refreshKey, setRefreshKey] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Date Range State
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
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
    return <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1A1A1A" />
      </View>;
  }
  const validOrders = orders.filter(o => !o.ApprovalStatus.includes('Rejected') && o.ApprovalStatus !== 'Cancelled');
  const totalIncurred = validOrders.reduce((sum, o) => sum + (Number(o.EstimateAmt) || 0), 0);
  const activeCount = orders.filter(o => !['Delivered', 'Pending Invoice', 'Payment Pending', 'Payment Sent', 'Closed', 'Rejected', 'Admin Rejected', 'Sales Rejected', 'Cancelled'].includes(o.ApprovalStatus) && o.ApprovalStatus !== 'Draft').length;
  const dispatchedCount = orders.filter(o => o.ApprovalStatus.includes('Dispatch') || o.ApprovalStatus.includes('Transit')).length;
  const deliveredCount = orders.filter(o => ['Delivered', 'Pending Invoice', 'Payment Pending', 'Payment Sent', 'Closed'].includes(o.ApprovalStatus)).length;
  const filteredOrders = orders.filter(o => {
    if (activeFilter === 'PENDING') {
      if (o.ApprovalStatus !== 'Pending Sales Approval' && o.ApprovalStatus !== 'Pending Admin Approval') return false;
    } else if (activeFilter === 'DISPATCHED') {
      if (!o.ApprovalStatus.includes('Dispatch') && !o.ApprovalStatus.includes('Transit') && !o.ApprovalStatus.includes('Ready')) return false;
    } else if (activeFilter === 'DELIVERED') {
      if (!['Delivered', 'Pending Invoice', 'Payment Pending', 'Payment Sent', 'Closed'].includes(o.ApprovalStatus)) return false;
    } else if (activeFilter === 'REJECTED') {
      if (!o.ApprovalStatus.includes('Rejected')) return false;
    }

    // Date range logic
    if (startDate || endDate) {
      const orderDate = new Date(o.OrderTimestamp);
      if (startDate && orderDate < startDate) return false;
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (orderDate > end) return false;
      }
    }
    return true;
  });
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const clearDates = () => {
    const {
      t
    } = useLanguage();
    setStartDate(null);
    setEndDate(null);
  };
  return <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      
      {/* Quick Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statChip, {
        backgroundColor: '#1A1A1A'
      }]}>
          <Text style={[styles.statLabel, {
          color: 'rgba(255,255,255,0.7)'
        }]}>{t('Total Incurred')}</Text>
          <Text style={[styles.statValue, {
          color: '#FFF'
        }]}>₹{totalIncurred.toLocaleString()}</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={styles.statLabel}>{t('Active')}</Text>
          <Text style={[styles.statValue, {
          color: '#0056D2'
        }]}>{activeCount}</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={styles.statLabel}>{t('Dispatched')}</Text>
          <Text style={[styles.statValue, {
          color: '#007AFF'
        }]}>{dispatchedCount}</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={styles.statLabel}>{t('Delivered')}</Text>
          <Text style={[styles.statValue, {
          color: '#34C759'
        }]}>{deliveredCount}</Text>
        </View>
      </View>

      {/* Date Range Filter */}
      <View style={styles.dateFilterContainer}>
        <Text style={styles.filterSectionTitle}>{t('Filter by Date')}</Text>
        <View style={styles.dateRow}>
          <TouchableOpacity style={styles.dateBtn} onPress={() => setShowStart(true)}>
            <CalendarIcon size={14} color="#64748B" />
            <Text style={styles.dateBtnText}>{startDate ? startDate.toLocaleDateString() : 'Start Date'}</Text>
          </TouchableOpacity>
          <Text style={styles.dateTo}>{t('to')}</Text>
          <TouchableOpacity style={styles.dateBtn} onPress={() => setShowEnd(true)}>
            <CalendarIcon size={14} color="#64748B" />
            <Text style={styles.dateBtnText}>{endDate ? endDate.toLocaleDateString() : 'End Date'}</Text>
          </TouchableOpacity>
          {(startDate || endDate) && <TouchableOpacity style={styles.clearDateBtn} onPress={clearDates}>
              <X size={16} color="#DC2626" />
            </TouchableOpacity>}
        </View>
      </View>

      {showStart && <DateTimePicker value={startDate || new Date()} mode="date" display="default" onValueChange={(event, selectedDate) => {
      setShowStart(false);
      if (selectedDate) setStartDate(selectedDate);
    }} onDismiss={() => setShowStart(false)} />}
      {showEnd && <DateTimePicker value={endDate || new Date()} mode="date" display="default" minimumDate={startDate || undefined} onValueChange={(event, selectedDate) => {
      setShowEnd(false);
      if (selectedDate) setEndDate(selectedDate);
    }} onDismiss={() => setShowEnd(false)} />}

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={{
      paddingRight: 16
    }}>
        {['ALL', 'PENDING', 'DISPATCHED', 'DELIVERED', 'REJECTED'].map(filter => <TouchableOpacity key={filter} style={[styles.filterBtn, activeFilter === filter && styles.filterBtnActive]} onPress={() => setActiveFilter(filter)}>
            <Text style={[styles.filterText, activeFilter === filter && styles.filterTextActive]}>{filter}</Text>
          </TouchableOpacity>)}
      </ScrollView>

      {/* Orders List */}
      {filteredOrders.length === 0 ? <View style={styles.emptyState}>
          <Package size={48} color="#C7C7CC" />
          <Text style={styles.emptyTitle}>{t('No Orders Found')}</Text>
          <Text style={styles.emptySub}>{t("You don't have any orders matching these filters.")}</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('customer/order')}>
            <Text style={styles.emptyBtnText}>{t('Place New Order')}</Text>
          </TouchableOpacity>
        </View> : <View style={styles.orderList}>
          {paginatedOrders.map(order => <OrderCardItem key={order.OrdID} order={order} user={user} navigation={navigation} onRefresh={() => setRefreshKey(k => k + 1)} />)}
        </View>}

      {totalPages > 1 && <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />}
    </ScrollView>;
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA'
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap'
  },
  statChip: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '600',
    marginBottom: 4
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A'
  },
  dateFilterContainer: {
    marginBottom: 20
  },
  filterSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8E8E93',
    textTransform: 'uppercase',
    marginBottom: 8
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  dateBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  dateBtnText: {
    fontSize: 12,
    color: '#1A1A1A',
    fontWeight: '500'
  },
  dateTo: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500'
  },
  clearDateBtn: {
    padding: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA'
  },
  filterScroll: {
    flexGrow: 0,
    marginBottom: 20
  },
  filterBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 8
  },
  filterBtnActive: {
    backgroundColor: '#1A1A1A',
    borderColor: '#1A1A1A'
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B'
  },
  filterTextActive: {
    color: '#FFF'
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginTop: 16,
    marginBottom: 8
  },
  emptySub: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 24
  },
  emptyBtn: {
    backgroundColor: '#1A1A1A',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8
  },
  emptyBtnText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14
  },
  orderList: {
    gap: 16
  },
  cardContainer: {
    position: 'relative',
    minHeight: 180
  },
  cardFace: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0
  },
  cardBack: {},
  orderCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20
  },
  orderId: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4
  },
  orderDate: {
    fontSize: 12,
    color: '#8E8E93'
  },
  orderAmt: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0056D2',
    marginBottom: 4
  },
  orderQty: {
    fontSize: 12,
    color: '#8E8E93'
  },
  rejectBox: {
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 20
  },
  rejectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8
  },
  rejectText: {
    color: '#DC2626',
    fontWeight: '600',
    fontSize: 14
  },
  rejectReasonBox: {
    backgroundColor: '#FFF',
    padding: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FECACA'
  },
  rejectReasonText: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '500'
  },
  trackerContainer: {
    position: 'relative',
    marginBottom: 24,
    paddingHorizontal: 8
  },
  trackerLineBg: {
    position: 'absolute',
    top: 6,
    left: 16,
    right: 16,
    height: 2,
    backgroundColor: '#E2E8F0'
  },
  trackerLineFill: {
    height: '100%',
    backgroundColor: '#34C759'
  },
  trackerNodes: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  node: {
    alignItems: 'center',
    width: 50
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    marginBottom: 6
  },
  dotActive: {
    backgroundColor: '#34C759',
    borderColor: '#34C759'
  },
  nodeLabel: {
    fontSize: 9,
    color: '#8E8E93',
    textAlign: 'center',
    fontWeight: '500'
  },
  nodeLabelActive: {
    color: '#1A1A1A',
    fontWeight: '700'
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 16,
    flexWrap: 'wrap',
    gap: 8
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  productText: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500'
  },
  footerActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center'
  },
  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#34C759',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4
  },
  verifyBtnText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700'
  },
  statusPill: {
    backgroundColor: '#F2F2F7',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1A1A1A'
  },
  confirmView: {
    alignItems: 'center',
    padding: 16
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 12,
    marginBottom: 8
  },
  confirmSub: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 24
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 12
  },
  cancelBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center'
  },
  cancelBtnText: {
    color: '#64748B',
    fontWeight: '600'
  },
  issueBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    alignItems: 'center'
  },
  issueBtnText: {
    color: '#DC2626',
    fontWeight: '600'
  },
  completeBtn: {
    width: '100%',
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#34C759',
    alignItems: 'center'
  },
  completeBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16
  }
});