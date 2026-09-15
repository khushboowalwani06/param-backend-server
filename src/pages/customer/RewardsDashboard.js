import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Gift, Trophy, Lock, Unlock, Calendar, TrendingUp } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { sheetsService } from '../../services/sheetsService';
import { useRealtime } from '../../hooks/useRealtime';

export default function RewardsDashboard() {
  const { user } = useAuth();
  
  const [campaign, setCampaign] = useState({
    startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)),
    endDate: new Date(new Date().setMonth(new Date().getMonth() + 2)),
    currentBags: 0,
    currentTons: 0,
  });

  const [targets, setTargets] = useState([
    { id: 1, target: 150, rewardName: 'Silver Tier Trip', rewardImage: 'Gift', color: '#94a3b8' },
    { id: 2, target: 280, rewardName: 'Gold Tier Trip (Dubai)', rewardImage: 'Trophy', color: '#fbbf24' }
  ]);
  
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useRealtime(['orders', 'users'], () => setRefreshKey(k => k + 1));

  useEffect(() => {
    const fetchTargets = async () => {
      try {
        if (user?.UserID) {
          let data = null;
          if (sheetsService.getCustomerRewards) {
            data = await sheetsService.getCustomerRewards(user.UserID);
          }
          if (data && data.targets) {
            setTargets(data.targets);
          }
          if (data && data.startDate && data.endDate) {
            setCampaign(prev => ({
              ...prev,
              startDate: new Date(data.startDate),
              endDate: new Date(data.endDate)
            }));
          }
          
          const orders = await sheetsService.getOrders(user);
          const campaignOrders = orders.filter(o => {
            if (!data?.startDate || !data?.endDate) return true;
            let ts = o.OrderTimestamp;
            if (!ts) return false;
            if (!ts.endsWith('Z') && !ts.includes('+')) ts += 'Z';
            const orderDate = new Date(ts);
            const start = new Date(data.startDate);
            const end = new Date(data.endDate);
            end.setDate(end.getDate() + 1);
            return orderDate >= start && orderDate < end;
          });

          const liveBags = campaignOrders.reduce((total, o) => {
            if (!['Delivered', 'Closed'].includes(o.ApprovalStatus)) return total;
            const qty = Number(o.EstimateQty) || 0;
            return total + (o.Unit === 'Tons' ? qty * 20 : qty);
          }, 0);
          
          const liveTons = campaignOrders.reduce((total, o) => {
            if (!['Delivered', 'Closed'].includes(o.ApprovalStatus)) return total;
            const qty = Number(o.EstimateQty) || 0;
            return total + (o.Unit === 'Bags' ? qty / 20 : qty);
          }, 0);
          
          setCampaign(prev => ({ ...prev, currentBags: liveBags, currentTons: liveTons }));
        }
      } catch (e) {
        console.error('Failed to load targets', e);
      } finally {
        setLoading(false);
      }
    };
    fetchTargets();
  }, [user, refreshKey]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1A1A1A" />
      </View>
    );
  }

  const target1 = targets[0]?.target || 150;
  const target2 = targets[1]?.target || 280;

  const tons1Percent = Math.min((campaign.currentTons / target1) * 100, 100);
  const tons2Percent = Math.min((campaign.currentTons / target2) * 100, 100);

  const remainingTons1 = Math.max(target1 - campaign.currentTons, 0);
  const remainingTons2 = Math.max(target2 - campaign.currentTons, 0);

  const isTarget1Achieved = campaign.currentTons >= target1;
  const isTarget2Achieved = campaign.currentTons >= target2;

  const reward1Status = isTarget1Achieved ? 'Unlocked' : 'Locked';
  const reward2Status = isTarget2Achieved ? 'Unlocked' : 'Locked';

  const daysRemaining = Math.ceil((campaign.endDate - new Date()) / (1000 * 60 * 60 * 24));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Rewards & Targets</Text>
        <Text style={styles.headerSub}>Track your campaign progress and unlock rewards</Text>
      </View>

      {/* Progress Timelines Card */}
      <View style={styles.card}>
        
        {/* Target 1 Section */}
        <View style={styles.targetSection}>
          <View style={styles.targetHeader}>
            <View>
              <Text style={styles.targetLabel}>TONS PROGRESS (TARGET 1)</Text>
              <View style={styles.targetValues}>
                <Text style={styles.currentValue}>{campaign.currentTons}</Text>
                <Text style={styles.targetValue}>/ {target1} Tons</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.targetLabel}>CAMPAIGN ENDS</Text>
              <View style={styles.daysRow}>
                <Calendar size={16} color="#0056D2" />
                <Text style={styles.daysText}>{daysRemaining > 0 ? daysRemaining : 0} Days</Text>
              </View>
            </View>
          </View>

          <View style={styles.timelineWrapper}>
            <View style={styles.timelineBg}>
              <View style={[styles.timelineFill, { width: `${tons1Percent}%`, backgroundColor: '#94A3B8' }]} />
            </View>
            <View style={styles.timelineNode}>
              <View style={[styles.nodeIcon, { borderColor: '#94A3B8' }]}>
                {isTarget1Achieved ? <Unlock size={14} color="#94A3B8" /> : <Lock size={14} color="#94A3B8" />}
              </View>
              <Text style={styles.nodeTargetText}>{target1}T</Text>
              {isTarget1Achieved && <View style={styles.unlockedBadge}><Text style={styles.unlockedBadgeText}>Unlocked</Text></View>}
            </View>
          </View>
        </View>

        {/* Target 2 Section */}
        <View style={styles.targetSection}>
          <View style={styles.targetHeader}>
            <View>
              <Text style={styles.targetLabel}>TONS PROGRESS (TARGET 2)</Text>
              <View style={styles.targetValues}>
                <Text style={styles.currentValue}>{campaign.currentTons}</Text>
                <Text style={styles.targetValue}>/ {target2} Tons</Text>
              </View>
            </View>
          </View>

          <View style={styles.timelineWrapper}>
            <View style={styles.timelineBg}>
              <View style={[styles.timelineFill, { width: `${tons2Percent}%`, backgroundColor: '#FBBF24' }]} />
            </View>
            <View style={styles.timelineNode}>
              <View style={[styles.nodeIcon, { borderColor: '#FBBF24' }]}>
                {isTarget2Achieved ? <Trophy size={14} color="#FBBF24" /> : <Lock size={14} color="#FBBF24" />}
              </View>
              <Text style={styles.nodeTargetText}>{target2}T</Text>
              {isTarget2Achieved && <View style={[styles.unlockedBadge, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}><Text style={[styles.unlockedBadgeText, { color: '#D97706' }]}>Unlocked</Text></View>}
            </View>
          </View>
        </View>

        <View style={styles.statsFooter}>
          <View style={styles.statPill}>
            <TrendingUp size={14} color="#1A1A1A" />
            <Text style={styles.statPillText}>{Math.round((tons1Percent + tons2Percent) / 2)}% Avg Completed</Text>
          </View>
          {(remainingTons1 > 0 || remainingTons2 > 0) && (
            <View style={styles.statPillOutline}>
              <Text style={styles.statPillOutlineText}>{remainingTons1} Tons (T1), {remainingTons2} Tons (T2) Left</Text>
            </View>
          )}
        </View>

      </View>

      {/* Rewards Cards */}
      <Text style={styles.sectionTitle}>Your Rewards</Text>

      {/* Reward 1 */}
      <View style={styles.rewardCard}>
        <View style={styles.rewardHeader}>
          <Text style={styles.rewardTargetTag}>Target 1: {target1} Bags</Text>
          <View style={[styles.rewardStatusBadge, isTarget1Achieved ? styles.badgeUnlocked : styles.badgeLocked]}>
            <Text style={[styles.rewardStatusText, isTarget1Achieved ? styles.textUnlocked : styles.textLocked]}>{reward1Status}</Text>
          </View>
        </View>
        <View style={styles.rewardBody}>
          <View style={[styles.rewardIconBox, { backgroundColor: '#F1F5F9' }]}>
            <Gift size={32} color="#64748B" />
          </View>
          <View style={styles.rewardInfo}>
            <Text style={styles.rewardName}>{targets[0]?.rewardName}</Text>
            <Text style={styles.rewardDesc}>Achieve {target1} bags before the campaign ends.</Text>
          </View>
        </View>
      </View>

      {/* Reward 2 */}
      <View style={[styles.rewardCard, { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' }]}>
        <View style={styles.rewardHeader}>
          <Text style={[styles.rewardTargetTag, { backgroundColor: '#FEF3C7', color: '#D97706' }]}>Target 2: {target2} Tons</Text>
          <View style={[styles.rewardStatusBadge, isTarget2Achieved ? styles.badgeUnlockedGold : styles.badgeLocked]}>
            <Text style={[styles.rewardStatusText, isTarget2Achieved ? styles.textUnlockedGold : styles.textLocked]}>{reward2Status}</Text>
          </View>
        </View>
        <View style={styles.rewardBody}>
          <View style={[styles.rewardIconBox, { backgroundColor: '#FEF3C7' }]}>
            <Trophy size={32} color="#D97706" />
          </View>
          <View style={styles.rewardInfo}>
            <Text style={[styles.rewardName, { color: '#D97706' }]}>{targets[1]?.rewardName}</Text>
            <Text style={styles.rewardDesc}>Achieve {target2} tons for the ultimate reward.</Text>
          </View>
        </View>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  header: { marginBottom: 20 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  headerSub: { fontSize: 14, color: '#8E8E93', fontWeight: '600' },

  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  
  targetSection: { marginBottom: 32 },
  targetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  targetLabel: { fontSize: 10, fontWeight: '700', color: '#8E8E93', textTransform: 'uppercase', marginBottom: 4 },
  targetValues: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  currentValue: { fontSize: 32, fontWeight: '800', color: '#1A1A1A' },
  targetValue: { fontSize: 14, fontWeight: '600', color: '#8E8E93' },
  
  daysRow: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'flex-end' },
  daysText: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },

  timelineWrapper: { position: 'relative', height: 40, marginTop: 10, paddingRight: 40 },
  timelineBg: { height: 8, backgroundColor: '#F2F2F7', borderRadius: 4, position: 'absolute', left: 0, right: 0, top: 16 },
  timelineFill: { height: '100%', borderRadius: 4 },
  timelineNode: { position: 'absolute', right: 0, top: 0, alignItems: 'center', width: 40 },
  nodeIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF', borderWidth: 2, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  nodeTargetText: { fontSize: 10, fontWeight: '700', color: '#1A1A1A', marginTop: 4 },
  unlockedBadge: { position: 'absolute', top: -20, backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, width: 60, alignItems: 'center' },
  unlockedBadgeText: { fontSize: 8, fontWeight: '700', color: '#16A34A', textTransform: 'uppercase' },

  statsFooter: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  statPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F2F2F7', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16 },
  statPillText: { fontSize: 12, fontWeight: '600', color: '#1A1A1A' },
  statPillOutline: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  statPillOutlineText: { fontSize: 12, fontWeight: '600', color: '#64748B' },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 16 },

  rewardCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  rewardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  rewardTargetTag: { backgroundColor: '#F1F5F9', color: '#475569', fontSize: 12, fontWeight: '700', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6 },
  rewardStatusBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12 },
  badgeLocked: { backgroundColor: '#F2F2F7' },
  textLocked: { color: '#8E8E93', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  badgeUnlocked: { backgroundColor: '#F0FDF4' },
  textUnlocked: { color: '#16A34A', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  badgeUnlockedGold: { backgroundColor: '#FEF3C7' },
  textUnlockedGold: { color: '#D97706', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },

  rewardBody: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  rewardIconBox: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  rewardInfo: { flex: 1 },
  rewardName: { fontSize: 16, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  rewardDesc: { fontSize: 12, color: '#8E8E93', lineHeight: 18 }
});
