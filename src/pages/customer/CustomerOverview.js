import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { differenceInDays, format, subDays } from 'date-fns';
import { Download, ArrowRight, CheckCircle2, Circle } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { sheetsService } from '../../services/sheetsService';
import { useRealtime } from '../../hooks/useRealtime';

const { width } = Dimensions.get('window');

export default function CustomerOverview() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salesRepName, setSalesRepName] = useState('');
  const [adminName, setAdminName] = useState('System Admin');
  const [chartDays, setChartDays] = useState(7);
  const [rewards, setRewards] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [realtimeUser, setRealtimeUser] = useState(user);

  useRealtime(['orders', 'profiles', 'accounts', 'issues'], () => setRefreshKey(k => k + 1));

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const data = await sheetsService.getOrders(user);
        setOrders(data);
        if (user?.UserID) {
          const latestProfile = await sheetsService.fetchProfile();
          if (latestProfile) setRealtimeUser(latestProfile);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();

    if (user?.AssignedSalesRep) {
      sheetsService.getBasicUserProfile(user.AssignedSalesRep).then(rep => {
        if (rep && rep.name) setSalesRepName(rep.name);
      }).catch(() => {});
    }
    
    if (sheetsService.fetchAdminContact) {
      sheetsService.fetchAdminContact()
        .then(res => { if (res && res.name) setAdminName(res.name); })
        .catch(() => {});
    }

    if (user?.UserID) {
      if (sheetsService.getCustomerRewards) {
        sheetsService.getCustomerRewards(user.UserID).then(data => {
          setRewards(data);
        }).catch(() => {});
      }
    }
  }, [user, refreshKey]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1A1A1A" />
      </View>
    );
  }

  // --- CALCULATIONS ---
  const filteredOrders = orders.filter(o => o.OrderTimestamp);
  const totalOrders = filteredOrders.length;
  const submittedOrders = filteredOrders.filter(o => {
    const status = o.ApprovalStatus || '';
    return status !== 'Draft' && !status.includes('Rejected') && status !== 'Delivered' && status !== 'Closed';
  }).length;
  const pendingActions = filteredOrders.filter(o => (o.ApprovalStatus || '').includes('Payment Pending')).length;

  const totalCreditLimit = Number(realtimeUser?.CreditLimit) || 0;
  const outstandingBalance = Number(realtimeUser?.OutstandingAmount) || 0;
  const availableBalance = totalCreditLimit - outstandingBalance;
  
  const duePayments = filteredOrders.filter(o => o.PaymentDueDate && !o.ApprovalStatus.includes('Closed') && !o.ApprovalStatus.includes('Payment Sent'));
  const overdueCount = duePayments.filter(o => differenceInDays(new Date(o.PaymentDueDate), new Date()) < 0).length;
  const dueTodayCount = duePayments.filter(o => differenceInDays(new Date(o.PaymentDueDate), new Date()) === 0).length;
  const creditUsedPct = totalCreditLimit > 0 ? Math.round((outstandingBalance / totalCreditLimit) * 100) : 0;
  
  const campaignOrders = orders; // simplified date logic for rewards tracking for now
  const campaignTons = campaignOrders.reduce((total, o) => {
    if (!o.ApprovalStatus || o.ApprovalStatus.includes('Rejected') || o.ApprovalStatus === 'Draft') return total;
    const qty = Number(o.EstimateQty) || 0;
    return total + (o.Unit === 'Bags' ? qty / 20 : qty);
  }, 0);

  const target1 = rewards?.targets?.[0]?.target || 150;
  const target2 = rewards?.targets?.[1]?.target || 280;
  const tons1Pct = Math.min(Math.round((campaignTons / target1) * 100), 100);
  const tons2Pct = Math.min(Math.round((campaignTons / target2) * 100), 100);

  const formatCompact = (val) => {
    return val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val;
  };

  const handleDownload = () => {
    alert("Downloading CSV is currently supported on the web platform.");
  };

  // --- BAR CHART ---
  const pastDays = Array.from({length: chartDays}, (_, i) => {
    const d = subDays(new Date(), (chartDays - 1) - i);
    return { date: format(d, 'yyyy-MM-dd'), label: format(d, 'EEEEEE') };
  });

  const volumeData = pastDays.map(dayObj => {
    const dayOrders = filteredOrders.filter(o => {
      let ts = o.OrderTimestamp;
      if (!ts) return false;
      if (!ts.endsWith('Z') && !ts.includes('+')) ts += 'Z';
      return format(new Date(ts), 'yyyy-MM-dd') === dayObj.date;
    });
    let totalBags = 0;
    dayOrders.forEach(curr => {
      let qty = Number(curr.EstimateQty) || 0;
      totalBags += (curr.Unit === 'Bags' ? qty : qty * 20);
    });
    return { label: dayObj.label[0], tons: Math.floor(totalBags / 20), bags: totalBags % 20 };
  });

  const maxVolume = Math.max(...volumeData.flatMap(d => [d.tons, d.bags]), 1);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Hi, {user?.Name || 'Customer'}!</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.downloadBtn} onPress={handleDownload}>
            <Download size={16} color="#1A1A1A" />
            <Text style={styles.downloadText}>Download</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.placeOrderBtn} onPress={() => navigation.navigate('customer/new-order')}>
            <Text style={styles.placeOrderText}>Place Order</Text>
            <ArrowRight size={16} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Financial Overview (Dark Card) */}
      <View style={[styles.card, styles.darkCard]}>
        <Text style={styles.cardTitleDark}>Financial Overview</Text>
        <View style={styles.balanceContainer}>
          <Text style={styles.currencySymbol}>₹</Text>
          <Text style={styles.balanceText} numberOfLines={1}>{formatCompact(availableBalance > 0 ? availableBalance : 0)}</Text>
          <Text style={styles.balanceLabel}>Available Balance</Text>
        </View>

        <View style={styles.pillRow}>
          <TouchableOpacity style={styles.pill} onPress={() => navigation.navigate('customer/orders')}>
            <View style={[styles.pillIcon, { borderStyle: 'solid' }]}><View style={styles.pillDot} /></View>
            <Text style={styles.pillNumber}>{totalOrders}</Text>
            <Text style={styles.pillLabel}>Total</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.pill} onPress={() => navigation.navigate('customer/orders')}>
            <View style={[styles.pillIcon, { borderStyle: 'dashed' }]} />
            <Text style={styles.pillNumber}>{submittedOrders}</Text>
            <Text style={styles.pillLabel}>Submitted</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.pill, pendingActions > 0 && { backgroundColor: '#FFF3CD' }]} onPress={() => navigation.navigate('customer/invoices')}>
            <View style={styles.pillIcon}><View style={[styles.pillDot, { backgroundColor: 'transparent', borderWidth: 2 }]} /></View>
            <Text style={styles.pillNumber}>{pendingActions}</Text>
            <Text style={styles.pillLabel}>Invoices</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Order Trends */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Order Trends (Past {chartDays} Days)</Text>
        <View style={styles.chartContainer}>
          {volumeData.map((d, i) => {
            const hTons = (d.tons / maxVolume) * 100;
            const hBags = (d.bags / maxVolume) * 100;
            return (
              <View key={i} style={styles.chartCol}>
                <View style={styles.barsArea}>
                  <View style={[styles.bar, styles.barTons, { height: `${hTons}%` }]} />
                  <View style={[styles.bar, styles.barBags, { height: `${hBags}%` }]} />
                </View>
                <Text style={styles.chartLabel}>{d.label}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Credit Health */}
      <View style={[styles.card, styles.darkCard]}>
        <Text style={styles.cardTitleDark}>Credit Utilization</Text>
        <View style={styles.limitRow}>
          <View>
            <Text style={styles.limitLabel}>Spendable</Text>
            <Text style={styles.limitValue}>₹{formatCompact(availableBalance)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.limitLabel}>Limit</Text>
            <Text style={styles.limitValue}>₹{formatCompact(totalCreditLimit)}</Text>
          </View>
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${creditUsedPct}%`, backgroundColor: '#FFF' }]} />
        </View>
        <Text style={styles.utilizationText}>{creditUsedPct}% Utilization</Text>
      </View>

      {/* Actions */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Ageing & Actions</Text>
        <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('customer/invoices')}>
          <View style={[styles.actionIconBg, overdueCount > 0 && { backgroundColor: '#FFEFEF' }]}>
            <Circle size={18} color={overdueCount > 0 ? '#FF3B30' : '#8E8E93'} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Overdue Payments</Text>
            <Text style={styles.actionSub}>Immediate attention required</Text>
          </View>
          <Text style={[styles.actionCount, overdueCount > 0 && { color: '#FF3B30' }]}>{overdueCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('customer/invoices')}>
          <View style={[styles.actionIconBg, dueTodayCount > 0 && { backgroundColor: '#FFF8D6' }]}>
            <CheckCircle2 size={18} color={dueTodayCount > 0 ? '#FFCC00' : '#8E8E93'} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Due Today</Text>
            <Text style={styles.actionSub}>Payments scheduled for today</Text>
          </View>
          <Text style={styles.actionCount}>{dueTodayCount}</Text>
        </TouchableOpacity>
      </View>

      {/* Rewards Progress */}
      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('customer/rewards')}>
        <Text style={styles.cardTitle}>Rewards Progress</Text>
        <View style={styles.limitRow}>
          <View>
            <Text style={styles.limitLabel}>Tons (Target 1)</Text>
            <Text style={[styles.limitValue, { color: '#1A1A1A' }]}>{formatCompact(campaignTons)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.limitLabel}>Tons (Target 2)</Text>
            <Text style={[styles.limitValue, { color: '#1A1A1A' }]}>{formatCompact(campaignTons)}</Text>
          </View>
        </View>
        
        <Text style={styles.progressLabel}>Target 1 Progress ({tons1Pct}%)</Text>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${tons1Pct}%`, backgroundColor: '#8E8E93' }]} />
        </View>

        <Text style={styles.progressLabel}>Target 2 Progress ({tons2Pct}%)</Text>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${tons2Pct}%`, backgroundColor: '#1A1A1A' }]} />
        </View>
      </TouchableOpacity>
      
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { marginBottom: 20 },
  greeting: { fontSize: 24, fontWeight: '700', color: '#1A1A1A', marginBottom: 12 },
  headerActions: { flexDirection: 'row', gap: 12 },
  downloadBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F2F7', padding: 12, borderRadius: 12, gap: 8 },
  downloadText: { color: '#1A1A1A', fontWeight: '600' },
  placeOrderBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A1A1A', padding: 12, borderRadius: 12, gap: 8 },
  placeOrderText: { color: '#FFF', fontWeight: '600' },
  card: { backgroundColor: '#FFF', borderRadius: 24, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  darkCard: { backgroundColor: '#1C1C1E' },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#1A1A1A', marginBottom: 16 },
  cardTitleDark: { fontSize: 18, fontWeight: '600', color: '#FFF', marginBottom: 16 },
  balanceContainer: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 24 },
  currencySymbol: { fontSize: 24, fontWeight: '700', color: '#8E8E93' },
  balanceText: { fontSize: 40, fontWeight: '700', color: '#FFF', flex: 1, marginHorizontal: 8 },
  balanceLabel: { fontSize: 12, color: '#8E8E93', maxWidth: 60 },
  pillRow: { flexDirection: 'row', gap: 12 },
  pill: { flex: 1, backgroundColor: '#FFF', borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  pillIcon: { width: 24, height: 24, borderRadius: 12, borderColor: '#1C1C1E', borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  pillDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#1C1C1E' },
  pillNumber: { fontSize: 20, fontWeight: '700', color: '#1C1C1E' },
  pillLabel: { fontSize: 10, fontWeight: '600', color: '#1C1C1E', textTransform: 'uppercase' },
  limitRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  limitLabel: { fontSize: 14, color: '#8E8E93', fontWeight: '600', marginBottom: 4 },
  limitValue: { fontSize: 24, fontWeight: '700', color: '#FFF' },
  progressBarBg: { height: 12, backgroundColor: '#F2F2F7', borderRadius: 6, marginBottom: 8, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 6 },
  utilizationText: { color: '#FFF', fontSize: 16, fontWeight: '700', textAlign: 'center', marginTop: 16 },
  chartContainer: { height: 120, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 20, borderBottomWidth: 1, borderBottomColor: '#F2F2F7', paddingBottom: 8 },
  chartCol: { alignItems: 'center', width: `${100/7}%`, height: '100%' },
  barsArea: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', height: '80%', width: '100%', gap: 2 },
  bar: { width: 8, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barTons: { backgroundColor: '#1A1A1A' },
  barBags: { backgroundColor: '#8E8E93' },
  chartLabel: { fontSize: 10, color: '#8E8E93', fontWeight: '600', marginTop: 8 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  actionIconBg: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F2F2F7', alignItems: 'center', justifyContent: 'center' },
  actionTitle: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  actionSub: { fontSize: 12, color: '#8E8E93' },
  actionCount: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  progressLabel: { fontSize: 12, color: '#8E8E93', fontWeight: '600', marginBottom: 4 },
});
