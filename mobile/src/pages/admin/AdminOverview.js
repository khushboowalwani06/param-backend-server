import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import { sheetsService } from '../../services/sheetsService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useNavigation } from '@react-navigation/native';
import { Download, Grid, List, CheckCircle2, Circle } from 'lucide-react-native';
import { useRealtime } from '../../hooks/useRealtime';
import { isToday, isThisMonth, format, subDays } from 'date-fns';
import { RetailersDirectory } from '../shared/RetailersDirectory';
import { CardSkeleton } from '../../components/Skeleton';
import { DateRangeFilter } from '../../components/DateRangeFilter';
import Svg, { Path, Rect, Line } from 'react-native-svg';
import { useLanguage } from '../../context/LanguageContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const AdminOverview = () => {
  const { t, tDynamic } = useLanguage();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { success, info } = useToast();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const [timeFilter, setTimeFilter] = useState('All Time');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [repViewMode, setRepViewMode] = useState('grid');
  const [refreshKey, setRefreshKey] = useState(0);

  useRealtime(['orders', 'profiles', 'payments'], () => setRefreshKey((k) => k + 1));

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ordersData] = await Promise.all([
        sheetsService.getOrders(user)]
        );
        setOrders(ordersData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user, refreshKey]);

  if (loading) return <View style={styles.loadingContainer}><CardSkeleton /><CardSkeleton /></View>;

  const filteredOrders = orders.filter((o) => {
    if (!o.OrderTimestamp) return false;
    let ts = o.OrderTimestamp;
    if (!ts.endsWith('Z') && !ts.includes('+')) ts += 'Z';
    const orderDate = new Date(ts);

    if (startDate && orderDate < new Date(startDate)) return false;
    if (endDate) {
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      if (orderDate >= end) return false;
    }

    if (startDate || endDate || timeFilter === 'All Time') return true;
    if (timeFilter === 'Today') return isToday(orderDate);
    if (timeFilter === 'This Month') return isThisMonth(orderDate);
    return true;
  });

  const totalOrders = filteredOrders.length;
  const pendingFinal = filteredOrders.filter((o) => o.ApprovalStatus === 'Pending Admin Approval' || o.ApprovalStatus === 'Pending Sales Approval').length;
  const inTransit = filteredOrders.filter((o) => o.ApprovalStatus?.includes('Dispatch') || o.ApprovalStatus?.includes('Transit')).length;
  const closedOrders = filteredOrders.filter((o) => o.ApprovalStatus === 'Closed' || o.ApprovalStatus === 'Delivered').length;
  const overduePayments = filteredOrders.filter((o) => o.ApprovalStatus === 'Overdue' || (o.ApprovalStatus?.includes('Payment Pending') && new Date(o.PaymentDueDate) < new Date())).length;

  const funnelSubmitted = filteredOrders.filter((o) => o.ApprovalStatus !== 'Draft').length;
  const funnelApproved = filteredOrders.filter((o) => !['Draft', 'Pending Sales Approval', 'Pending Admin Approval', 'Rejected', t("Admin Rejected")].includes(o.ApprovalStatus)).length;
  const funnelDelivered = closedOrders;

  const repStats = filteredOrders.reduce((acc, order) => {
    const rep = order.SalesApproverID || 'Direct';
    if (!acc[rep]) acc[rep] = { name: rep, totalAmt: 0, orderCount: 0 };
    acc[rep].totalAmt += Number(order.EstimateAmt) || 0;
    acc[rep].orderCount += 1;
    return acc;
  }, {});
  const topReps = Object.values(repStats).sort((a, b) => b.totalAmt - a.totalAmt).slice(0, 3);

  const blockedCount = filteredOrders.filter((o) => o.ApprovalStatus?.includes('Rejected')).length;
  const delayedCount = overduePayments;
  const activeCount = totalOrders - blockedCount - delayedCount - closedOrders;

  const activePct = totalOrders > 0 ? Math.round(activeCount / totalOrders * 100) : 100;
  const delayedPct = totalOrders > 0 ? Math.round(delayedCount / totalOrders * 100) : 0;

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), 6 - i);
    return { date: format(d, 'yyyy-MM-dd'), label: format(d, 'EEEEE') }; // M, T, W etc.
  });

  const volumeData = last7Days.map((dayObj) => {
    const dayOrders = filteredOrders.filter((o) => {
      if (!o.OrderTimestamp) return false;
      let ts = o.OrderTimestamp;
      if (!ts.endsWith('Z') && !ts.includes('+')) ts += 'Z';
      return format(new Date(ts), 'yyyy-MM-dd') === dayObj.date;
    });
    return {
      label: dayObj.label,
      orders: dayOrders.length,
      dispatch: dayOrders.filter((o) => o.ApprovalStatus?.includes('Dispatch') || o.ApprovalStatus?.includes('Transit')).length
    };
  });

  const maxVolume = Math.max(...volumeData.map((d) => d.orders), 1);
  const graphWidth = SCREEN_WIDTH - 64;
  const graphHeight = 80;
  const stepX = graphWidth / 6;
  const growthRate = totalOrders > 0 ? Math.round(volumeData[6].orders / (volumeData[0].orders || 1) * 100) : 0;

  const handleDownload = async () => {
    try {
      // Lazy-load the export utility to avoid bundle overhead if unused
      const { exportToExcel } = await import('../../utils/exportToExcel');

      // Sort by priority status for the report
      const priorityWeights = {
        'Overdue': 1,
        'Pending Admin Approval': 2,
        'Pending Sales Approval': 3,
        'Ready for Dispatch': 4,
        'Dispatch': 5,
        'Transit': 6,
        'Payment Pending': 7,
        'Delivered': 8,
        'Closed': 9
      };

      const sortedData = [...filteredOrders].sort((a, b) => {
        const weightA = priorityWeights[a.ApprovalStatus] || 99;
        const weightB = priorityWeights[b.ApprovalStatus] || 99;
        return weightA - weightB;
      });

      await exportToExcel(sortedData, 'Admin_Overview_Report', 'Orders');
      success(t("Report exported successfully!"));
    } catch (err) {
      console.error(err);
    }
  };

  const circumference = 2 * Math.PI * 15.9155;
  const strokeDashoffsetActive = circumference - activePct / 100 * circumference;

  const circumferenceInner = 2 * Math.PI * 11.9155;
  const strokeDashoffsetDelayed = circumferenceInner - delayedPct / 100 * circumferenceInner;

  const pendingApprovals = filteredOrders.filter((o) => o.ApprovalStatus === 'Pending Admin Approval' || o.ApprovalStatus === 'Pending Sales Approval');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("Hi,")} {tDynamic(user?.Name || 'Admin')}!</Text>

        <View style={styles.timeFiltersWrapper}>
          <View style={styles.timeFilters}>
            {['All Time', 'Today', 'This Month'].map((f) =>
            <TouchableOpacity key={f} onPress={() => {setTimeFilter(f);setStartDate('');setEndDate('');}} style={[styles.timeBtn, timeFilter === f && styles.timeBtnActive]}>
                <Text style={[styles.timeText, timeFilter === f && styles.timeTextActive]}>{f}</Text>
              </TouchableOpacity>
            )}
          </View>
          <DateRangeFilter startDate={startDate} endDate={endDate} onDateChange={({ startDate: s, endDate: e }) => {setStartDate(s);setEndDate(e);setTimeFilter('Custom');}} onClear={() => {setStartDate('');setEndDate('');setTimeFilter('All Time');}} />
        </View>
      </View>

      <View style={styles.darkCard}>
        <Text style={styles.darkCardTitle}>{t("Overall Information")}</Text>

        <View style={styles.overallStatsRow}>
          <TouchableOpacity onPress={() => navigation?.navigate('admin/orders')} style={styles.mainStatCol}>
            <Text style={styles.mainStatValue} adjustsFontSizeToFit numberOfLines={1}>{totalOrders}</Text>
            <Text style={styles.mainStatLabel}>{t("Total Orders")}</Text>
          </TouchableOpacity>
          <View style={styles.verticalDivider} />
          <TouchableOpacity onPress={() => navigation?.navigate('admin/aging')} style={styles.mainStatCol}>
            <Text style={styles.subStatValue} adjustsFontSizeToFit numberOfLines={1}>{overduePayments}</Text>
            <Text style={styles.mainStatLabel}>{t("Overdue accounts")}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.pillsRow}>
          <TouchableOpacity onPress={() => navigation?.navigate('admin/queue')} style={styles.pillCard}>
            <View style={styles.pillIconOutline}>
              <View style={styles.pillIconDot} />
            </View>
            <Text style={styles.pillValue} adjustsFontSizeToFit numberOfLines={1}>{pendingFinal}</Text>
            <Text style={styles.pillLabel}>{t("PENDING")}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation?.navigate('admin/logistics')} style={styles.pillCard}>
            <View style={styles.pillIconDashed} />
            <Text style={styles.pillValue} adjustsFontSizeToFit numberOfLines={1}>{inTransit}</Text>
            <Text style={styles.pillLabel}>{t("TRANSIT")}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation?.navigate('admin/orders')} style={styles.pillCard}>
            <View style={styles.pillIconOutline}>
              <View style={styles.pillIconRing} />
            </View>
            <Text style={styles.pillValue} adjustsFontSizeToFit numberOfLines={1}>{closedOrders}</Text>
            <Text style={styles.pillLabel}>{t("COMPLETED")}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View>
            <Text style={styles.cardTitle}>{t("Volume Trends (7d)")}</Text>
            <View style={styles.legendRow}>
              <View style={styles.legendDotBlack} /><Text style={styles.legendText}>{t("Orders")}</Text>
              <View style={styles.legendDotGray} /><Text style={styles.legendText}>{t("Dispatch")}</Text>
            </View>
          </View>
          <View style={styles.growthBadge}><Text style={styles.growthText}>+{growthRate}%</Text></View>
        </View>

        <View style={styles.chartArea}>
          <Svg height="120" width={graphWidth}>
            <Line x1="0" y1="100" x2={graphWidth} y2="100" stroke="#E5E5EA" strokeWidth="2" />
            {volumeData.map((d, i) => {
              const x = i * stepX;
              const hOrders = d.orders / maxVolume * graphHeight || 0;
              const hDispatch = d.dispatch / maxVolume * graphHeight || 0;
              const yOrders = 100 - hOrders;
              const yDispatch = 100 - hDispatch;
              const barWidth = 14;
              return (
                <React.Fragment key={i}>
                  <Rect x={x - barWidth / 2 - 2} y={yDispatch} width={barWidth / 2} height={hDispatch} fill="#C7C7CC" rx="2" />
                  <Rect x={x} y={yOrders} width={barWidth / 2} height={hOrders} fill="#1A1A1A" rx="2" />
                </React.Fragment>);

            })}
          </Svg>
          <View style={styles.chartLabels}>
            {volumeData.map((d, i) =>
            <View key={i} style={i === 6 ? styles.currentDayLabel : styles.dayLabel}>
                <Text style={i === 6 ? styles.currentDayText : styles.dayText}>{d.label[0]}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View>
            <Text style={styles.cardTitle}>{t("Operational SLA")}</Text>
            <Text style={styles.slaSubtext}>+{activePct > 50 ? '5' : '0'}% <Text style={styles.slaSubtextMuted}>{t("compared to last month")}</Text></Text>
          </View>
        </View>

        <View style={styles.slaContentRow}>
          <View style={styles.slaLegendCol}>
            <View style={styles.slaLegendRow}><View style={styles.legendDotBlack} /><Text style={styles.slaLegendText}>{t("Active (")}{activeCount})</Text></View>
            <View style={styles.slaLegendRow}><View style={styles.legendDotGray} /><Text style={styles.slaLegendText}>{t("Delayed (")}{delayedCount})</Text></View>
            <View style={styles.slaLegendRow}><View style={styles.legendDotLightGray} /><Text style={styles.slaLegendText}>{t("Blocked (")}{blockedCount})</Text></View>
          </View>
          <View style={styles.circularChartWrapper}>
            <Svg viewBox="0 0 36 36" width={100} height={100}>
              <Path stroke="#E5E5EA" strokeWidth="1.5" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <Path stroke="#1A1A1A" strokeWidth="2" fill="none" strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={strokeDashoffsetActive} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" strokeLinecap="round" />

              <Path stroke="#E5E5EA" strokeWidth="1" fill="none" d="M18 6.0845 a 11.9155 11.9155 0 0 1 0 23.831 a 11.9155 11.9155 0 0 1 0 -23.831" />
              <Path stroke="#8E8E93" strokeWidth="1.5" fill="none" strokeDasharray={`${circumferenceInner} ${circumferenceInner}`} strokeDashoffset={strokeDashoffsetDelayed} d="M18 6.0845 a 11.9155 11.9155 0 0 1 0 23.831 a 11.9155 11.9155 0 0 1 0 -23.831" strokeLinecap="round" />
            </Svg>
            <View style={styles.circularChartCenter}>
              <Text style={styles.circularChartText}>{activePct}%</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.downloadBtn} onPress={handleDownload}>
          <Download size={16} color="#1A1A1A" />
          <Text style={styles.downloadBtnText}>{t("Download Report")}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("Order Funnel:")}</Text>
        <View style={styles.funnelList}>
          <View style={styles.funnelRow}>
            <View style={styles.funnelLabelRow}><CheckCircle2 size={18} fill="#1A1A1A" color="#FFF" /><Text style={styles.funnelLabelActive}>{t("Submitted Orders")}</Text></View>
            <Text style={styles.funnelValue}>{funnelSubmitted}</Text>
          </View>
          <View style={styles.funnelRow}>
            <View style={styles.funnelLabelRow}><Circle size={18} color="#C7C7CC" /><Text style={styles.funnelLabelMuted}>{t("Approved Orders")}</Text></View>
            <Text style={styles.funnelValueMuted}>{funnelApproved}</Text>
          </View>
          <View style={styles.funnelRow}>
            <View style={styles.funnelLabelRow}><Circle size={18} color="#C7C7CC" /><Text style={styles.funnelLabelMuted}>{t("Delivered & Closed")}</Text></View>
            <Text style={styles.funnelValueMuted}>{funnelDelivered}</Text>
          </View>
          <View style={styles.funnelRow}>
            <View style={styles.funnelLabelRow}><Circle size={18} color="#C7C7CC" /><Text style={styles.funnelLabelMuted}>{t("Exceptions / Overdue")}</Text></View>
            <Text style={styles.funnelValueMuted}>{overduePayments}</Text>
          </View>
        </View>
      </View>

      <View style={styles.repsHeader}>
        <Text style={styles.cardTitle}>{t("Top Sales Reps (")}{topReps.length})</Text>
        <View style={styles.repsToggle}>
          <Text style={styles.repsToggleText}>{t("Sort by")}</Text>
          <TouchableOpacity onPress={() => setRepViewMode('grid')}><Grid size={16} color={repViewMode === 'grid' ? '#1A1A1A' : '#C7C7CC'} /></TouchableOpacity>
          <TouchableOpacity onPress={() => setRepViewMode('list')}><List size={16} color={repViewMode === 'list' ? '#1A1A1A' : '#C7C7CC'} /></TouchableOpacity>
        </View>
      </View>

      <View style={[styles.repsContainer, repViewMode === 'grid' && styles.repsGrid]}>
        {topReps.map((rep, idx) => {
          const repCircumference = 2 * Math.PI * 15.9155;
          const repScore = Math.max(20, 100 - idx * 25);
          const repDashoffset = repCircumference - repScore / 100 * repCircumference;

          return (
            <View key={idx} style={[styles.repCardDark, repViewMode === 'grid' ? styles.repCardGrid : styles.repCardList]}>
              <View style={[styles.repHeaderRow, repViewMode === 'grid' && { marginBottom: 16 }]}>
                <Text style={[styles.repName, { flexShrink: 1, marginRight: 8 }]} numberOfLines={1}>{rep.name}</Text>
                <View style={styles.repRankCircle}>
                  <Svg viewBox="0 0 36 36" width={32} height={32}>
                    <Path stroke="#3A3A3C" strokeWidth="2" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    <Path stroke="#FFF" strokeWidth="2" fill="none" strokeDasharray={`${repCircumference} ${repCircumference}`} strokeDashoffset={repDashoffset} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  </Svg>
                  <View style={styles.repRankCenter}><Text style={styles.repRankText}>#{idx + 1}</Text></View>
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.repStatusRow}>
                  <View style={styles.repStatusDot} /><Text style={styles.repStatusText}>{t("In progress")}</Text>
                </View>
                <View style={[styles.repStatsRow, repViewMode === 'grid' && { flexDirection: 'column', alignItems: 'flex-start', gap: 4 }, repViewMode === 'list' && { justifyContent: 'flex-start', gap: 32 }]}>
                  <Text style={styles.repStatLabel}>{t("Total Sales:")} <Text style={styles.repStatValue}>₹{rep.totalAmt.toLocaleString()}</Text></Text>
                  <Text style={styles.repStatLabel}>{t("Orders:")} <Text style={styles.repStatValue}>{rep.orderCount}</Text></Text>
                </View>
              </View>
            </View>);

        })}
        <TouchableOpacity style={styles.viewAllRepsBtn} onPress={() => navigation?.navigate('admin/team')}>
          <Text style={styles.viewAllRepsText}>{t("+ View All Reps")}</Text>
        </TouchableOpacity>
      </View>

      <View style={{ marginTop: 24 }}>
        <Text style={[styles.cardTitle, { marginBottom: 16 }]}>{t("Pending Admin Approvals (")}{pendingFinal})</Text>
        <View style={[styles.card, { padding: 0, overflow: 'hidden' }]}>
          {pendingApprovals.length === 0 ?
          <Text style={styles.emptyTableText}>{t("No orders pending your approval.")}</Text> :

          pendingApprovals.slice(0, 5).map((o, idx) =>
          <View key={o.OrdID} style={[styles.tableRow, idx === pendingApprovals.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tableRowId}>{o.OrdID}</Text>
                  <Text style={styles.tableRowDate}>{o.OrderTimestamp ? format(new Date(o.OrderTimestamp), 'dd MMM yyyy') : 'N/A'}</Text>
                </View>
                <View style={{ flex: 1.5 }}>
                  <Text style={styles.tableRowName} numberOfLines={1}>{o.Name || 'Unknown'}</Text>
                  <Text style={styles.tableRowCompany} numberOfLines={1}>{o.Company || ''}</Text>
                </View>
                <View style={{ flex: 1.5, marginLeft: 8 }}>
                  <Text style={styles.tableRowProduct} numberOfLines={1}>{o.Product} <Text style={styles.tableRowQty}>{t("x")} {o.EstimateQty}</Text></Text>
                  <Text style={styles.tableRowAmt}>₹{(Number(o.EstimateAmt) || 0).toLocaleString()}</Text>
                </View>
                <TouchableOpacity onPress={() => navigation?.navigate('admin/queue')} style={styles.reviewBtn}>
                  <Text style={styles.reviewBtnText}>{t("Review")}</Text>
                </TouchableOpacity>
              </View>
          )
          }
          {pendingApprovals.length > 5 &&
          <TouchableOpacity onPress={() => navigation?.navigate('admin/queue')} style={styles.viewMoreRow}>
              <Text style={styles.viewMoreText}>{t("View all")} {pendingApprovals.length} {t("pending orders")}</Text>
            </TouchableOpacity>
          }
        </View>
      </View>

      <View style={{ marginTop: 24 }}>
        <Text style={[styles.cardTitle, { marginBottom: 16 }]}>{t("Retailer Directory")}</Text>
        <RetailersDirectory compactMode={true} />
      </View>
    </ScrollView>);

};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  content: { padding: 16, paddingBottom: 40 },
  loadingContainer: { padding: 16 },
  header: { marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '700', color: '#1A1A1A', textTransform: 'capitalize', marginBottom: 12 },
  timeFiltersWrapper: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  timeFilters: { flexDirection: 'row', backgroundColor: '#F2F2F7', borderRadius: 12, padding: 4 },
  timeBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  timeBtnActive: { backgroundColor: '#FFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  timeText: { fontSize: 14, fontWeight: '500', color: '#8E8E93' },
  timeTextActive: { fontWeight: '600', color: '#1A1A1A' },

  darkCard: { backgroundColor: '#1C1C1E', borderRadius: 28, padding: 24, marginBottom: 24 },
  darkCardTitle: { fontSize: 18, fontWeight: '600', color: '#FFF', marginBottom: 24 },
  overallStatsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 32 },
  mainStatCol: { flex: 1 },
  mainStatValue: { fontSize: 48, fontWeight: '700', color: '#FFF', lineHeight: 56 },
  subStatValue: { fontSize: 32, fontWeight: '600', color: '#FFF', lineHeight: 40 },
  mainStatLabel: { fontSize: 12, color: '#8E8E93', marginTop: 4 },
  verticalDivider: { width: 1, height: 40, backgroundColor: '#3A3A3C', marginHorizontal: 24 },

  pillsRow: { flexDirection: 'row', gap: 12 },
  pillCard: { flex: 1, backgroundColor: '#FFF', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 8, alignItems: 'center' },
  pillIconOutline: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#1C1C1E', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  pillIconDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#1C1C1E' },
  pillIconRing: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#1C1C1E' },
  pillIconDashed: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#1C1C1E', borderStyle: 'dashed', marginBottom: 8 },
  pillValue: { fontSize: 24, fontWeight: '700', color: '#1C1C1E' },
  pillLabel: { fontSize: 10, fontWeight: '600', color: '#1C1C1E', marginTop: 2 },

  card: { backgroundColor: '#FFF', borderRadius: 28, padding: 24, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 20, elevation: 2 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#1A1A1A' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  legendDotBlack: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#1A1A1A', marginRight: 4 },
  legendDotGray: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#C7C7CC', marginRight: 4 },
  legendDotLightGray: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#E5E5EA', marginRight: 4 },
  legendText: { fontSize: 12, color: '#8E8E93', fontWeight: '500' },
  growthBadge: { backgroundColor: '#1A1A1A', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  growthText: { color: '#FFF', fontSize: 10, fontWeight: '700' },

  chartArea: { width: '100%', height: 140, marginTop: 16 },
  chartLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingHorizontal: 8 },
  dayLabel: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: 10, fontWeight: '600', color: '#8E8E93' },
  currentDayLabel: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' },
  currentDayText: { fontSize: 10, fontWeight: '600', color: '#FFF' },

  slaSubtext: { fontSize: 12, fontWeight: '600', color: '#34C759', marginTop: 4 },
  slaSubtextMuted: { color: '#8E8E93', fontWeight: '500' },
  slaContentRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  slaLegendCol: { flex: 1, gap: 12 },
  slaLegendRow: { flexDirection: 'row', alignItems: 'center' },
  slaLegendText: { fontSize: 12, fontWeight: '500', color: '#1A1A1A' },
  circularChartWrapper: { width: 100, height: 100, position: 'relative' },
  circularChartCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  circularChartText: { fontSize: 20, fontWeight: '700', color: '#1A1A1A' },
  downloadBtn: { width: '100%', padding: 14, borderRadius: 999, borderWidth: 1, borderColor: '#1A1A1A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 },
  downloadBtnText: { color: '#1A1A1A', fontWeight: '600', fontSize: 14 },

  funnelList: { gap: 16, marginTop: 16 },
  funnelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  funnelLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  funnelLabelActive: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  funnelValue: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  funnelLabelMuted: { fontSize: 14, fontWeight: '600', color: '#8E8E93' },
  funnelValueMuted: { fontSize: 14, fontWeight: '600', color: '#8E8E93' },

  repsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  repsToggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  repsToggleText: { fontSize: 12, fontWeight: '600', color: '#8E8E93' },
  repsContainer: { gap: 16 },
  repsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  repCardDark: { backgroundColor: '#1C1C1E', borderRadius: 24, padding: 24 },
  repCardGrid: { width: (SCREEN_WIDTH - 48) / 2 },
  repCardList: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 24 },
  repHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  repName: { fontSize: 16, fontWeight: '600', color: '#FFF' },
  repRankCircle: { width: 32, height: 32, position: 'relative' },
  repRankCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  repRankText: { fontSize: 8, fontWeight: '700', color: '#FFF' },
  repStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  repStatusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFF' },
  repStatusText: { fontSize: 12, color: '#8E8E93' },
  repStatsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  repStatLabel: { fontSize: 12, color: '#8E8E93' },
  repStatValue: { color: '#FFF', fontWeight: '600' },
  viewAllRepsBtn: { borderRadius: 24, padding: 24, borderWidth: 2, borderColor: '#C7C7CC', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  viewAllRepsText: { color: '#1A1A1A', fontWeight: '600', fontSize: 14 },

  tableRow: { flexDirection: 'row', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F2F2F7', alignItems: 'center' },
  tableRowId: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  tableRowDate: { fontSize: 12, color: '#8E8E93', marginTop: 4 },
  tableRowName: { fontSize: 14, fontWeight: '500', color: '#1A1A1A' },
  tableRowCompany: { fontSize: 12, color: '#8E8E93', marginTop: 4 },
  tableRowProduct: { fontSize: 12, color: '#1A1A1A' },
  tableRowQty: { color: '#8E8E93' },
  tableRowAmt: { fontSize: 14, fontWeight: '600', color: '#1A1A1A', marginTop: 4 },
  reviewBtn: { backgroundColor: '#1A1A1A', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  reviewBtnText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  emptyTableText: { padding: 32, textAlign: 'center', color: '#8E8E93', fontSize: 14 },
  viewMoreRow: { padding: 16, backgroundColor: '#F8F9FA', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F2F2F7' },
  viewMoreText: { color: '#0284C7', fontWeight: '600', fontSize: 14 }
});