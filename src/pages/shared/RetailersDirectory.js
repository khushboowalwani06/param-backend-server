import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, FlatList, StyleSheet, Animated, Alert, Platform, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { sheetsService } from '../../services/sheetsService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ExportButton } from '../../components/ExportButton';
import { useRealtime } from '../../hooks/useRealtime';
import { Users, Search, Gift, X, Edit2, Trash2, ShoppingCart, Pencil, Check } from 'lucide-react-native';
import { LocationFilter } from '../../components/LocationFilter';
import { CardSkeleton } from '../../components/Skeleton';
import { Picker } from '@react-native-picker/picker';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const RetailerCard = ({ r, user, repName, repId, outst, creditLimit, spendable, segment, ordersCount, outstColor, badgeBg, badgeColor, targetValue, achievedValue, onOpenProfile, onOpenRewards, onDelete, onOrder, handleSaveCreditLimit }) => {
  const [flipped, setFlipped] = useState(false);
  const [flipContext, setFlipContext] = useState(null);
  const flipAnim = useRef(new Animated.Value(0)).current;

  // Edit States
  const [editingCredit, setEditingCredit] = useState(false);
  const [editLimit, setEditLimit] = useState(String(creditLimit));
  
  const [rewardsForm, setRewardsForm] = useState({target1: '150', rewardName1: 'Silver Tier Trip', target2: '280', rewardName2: 'Gold Tier Trip (Dubai)'});
  const [savingRewards, setSavingRewards] = useState(false);

  const flipTo = (toValue, context) => {
    if (context) setFlipContext(context);
    Animated.spring(flipAnim, {
      toValue,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start(() => {
      setFlipped(toValue === 180);
      if (toValue === 0) setFlipContext(null);
    });
  };

  const frontInterpolate = flipAnim.interpolate({ inputRange: [0, 180], outputRange: ['0deg', '180deg'] });
  const backInterpolate = flipAnim.interpolate({ inputRange: [0, 180], outputRange: ['180deg', '360deg'] });

  const formatCurrency = (val) => `₹${Number(val).toLocaleString('en-IN')}`;

  const renderFront = () => (
    <Animated.View style={[styles.cardFace, { transform: [{ rotateY: frontInterpolate }] }]}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.cardTitle} numberOfLines={1}>{r.Name || 'Unknown'}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: badgeBg }]}>
          <Text style={[styles.badgeText, { color: badgeColor }]}>{segment}</Text>
        </View>
      </View>
      <Text style={styles.cardSub}>{r.Company || 'No Company'} | {r.UserID}</Text>
      
      <View style={styles.infoGrid}>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Phone</Text><Text style={styles.infoValue} numberOfLines={1}>{r.Phone || 'N/A'}</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Address</Text><Text style={[styles.infoValue, {textAlign:'right', flex:1}]}>{r.Address || 'N/A'}</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>PAN & GST</Text><Text style={styles.infoValue} numberOfLines={1}>{r.Documents?.pan || 'N/A'} | {r.Documents?.gst || 'N/A'}</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Email</Text><Text style={styles.infoValue} numberOfLines={1}>{r.Email || r.EmailAddress || 'No Email'}</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Sales Rep</Text><View style={{alignItems:'flex-end'}}><Text style={styles.infoValue}>{repName}</Text>{repId && <Text style={{fontSize:10, color:'#8E8E93'}}>{repId}</Text>}</View></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Total Orders</Text><Text style={[styles.infoValue, {fontWeight:'700'}]}>{ordersCount}</Text></View>
      </View>

      <View style={styles.financeGrid}>
        <View style={styles.financeBox}>
          <Text style={styles.financeLabel}>CREDIT LIMIT</Text>
          <View style={{flexDirection:'row', alignItems:'center'}}>
            {editingCredit ? (
              <View style={{flexDirection:'row', alignItems:'center'}}>
                <TextInput value={editLimit} onChangeText={setEditLimit} style={styles.editInput} keyboardType="numeric" />
                <TouchableOpacity onPress={() => { handleSaveCreditLimit(r.UserID, editLimit); setEditingCredit(false); }} style={styles.iconBtn}><Check size={14} color="#FFF"/></TouchableOpacity>
                <TouchableOpacity onPress={() => setEditingCredit(false)} style={[styles.iconBtn, {backgroundColor:'#E5E5EA'}]}><X size={14} color="#1A1A1A"/></TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.financeValue}>{formatCurrency(creditLimit)}</Text>
            )}
            {!editingCredit && user?.Role && ['admin', 'accountant'].includes(user.Role) && (
              <TouchableOpacity onPress={() => setEditingCredit(true)} style={{marginLeft:8}}>
                <Pencil size={12} color="#8E8E93" />
              </TouchableOpacity>
            )}
          </View>
        </View>
        <View style={styles.financeBox}>
          <Text style={styles.financeLabel}>SPENDABLE</Text>
          <Text style={[styles.financeValue, {color:'#34C759'}]}>{formatCurrency(spendable)}</Text>
        </View>
      </View>

      <View style={styles.outstandingRow}>
        <Text style={styles.financeLabel}>OUTSTANDING</Text>
        <Text style={[styles.financeValue, {fontSize:20, color:outstColor}]}>{formatCurrency(outst)}</Text>
      </View>

      <View style={styles.rewardsBox}>
        <Gift size={20} color="#8E8E93" />
        <View style={{flex:1}}>
          <View style={styles.rewardTextRow}><Text style={styles.rewardLabel}>Achieved:</Text><Text style={styles.rewardVal}>{achievedValue.toFixed(1)}T</Text></View>
          <View style={styles.rewardTextRow}><Text style={styles.rewardLabel}>Target:</Text><Text style={styles.rewardVal}>{targetValue}T</Text></View>
          <View style={styles.progressBar}><View style={[styles.progressFill, {width: `${Math.min(100, (achievedValue/targetValue)*100)}%`}]} /></View>
        </View>
      </View>

      <View style={{flex:1}} />

      {user?.Role && ['admin', 'sales', 'accountant'].includes(user.Role) && (
        <View style={styles.actionRow}>
          {user?.Role === 'admin' && (
            <>
              <TouchableOpacity onPress={() => onDelete(r.UserID)} style={[styles.actionBtn, {backgroundColor:'#FEE2E2'}]}>
                <Trash2 size={14} color="#DC2626" /><Text style={[styles.actionBtnText, {color:'#DC2626'}]}>Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => flipTo(180, 'profile')} style={[styles.actionBtn, {backgroundColor:'#F9FAFB', borderWidth:1, borderColor:'#E5E5EA'}]}>
                <Edit2 size={14} color="#1A1A1A" /><Text style={[styles.actionBtnText, {color:'#1A1A1A'}]}>Edit Details</Text>
              </TouchableOpacity>
            </>
          )}
          {user?.Role !== 'accountant' && (
            <TouchableOpacity onPress={() => onOrder(r)} style={[styles.actionBtn, {backgroundColor:'#E0F2FE'}]}>
              <ShoppingCart size={14} color="#0284C7" /><Text style={[styles.actionBtnText, {color:'#0284C7'}]}>Place Order</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => flipTo(180, 'rewards')} style={[styles.actionBtn, {backgroundColor:'#F3E8FF'}]}>
            <Gift size={14} color="#9333EA" /><Text style={[styles.actionBtnText, {color:'#9333EA'}]}>Rewards</Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );

  const renderBack = () => (
    <Animated.View style={[styles.cardFace, styles.cardFaceBack, { transform: [{ rotateY: backInterpolate }] }]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{flipContext === 'rewards' ? 'Edit Rewards' : 'Edit Details'}</Text>
        <TouchableOpacity onPress={() => flipTo(0, null)}><X size={20} color="#8E8E93" /></TouchableOpacity>
      </View>
      
      <ScrollView style={{flex:1}}>
        {flipContext === 'rewards' ? (
          <View style={{gap: 12}}>
            <Text style={styles.infoLabel}>Currently editable in web version</Text>
            <Text style={styles.infoValue}>Full rewards management coming soon to mobile.</Text>
          </View>
        ) : (
          <View style={{gap: 12}}>
            <Text style={styles.infoLabel}>Currently editable in web version</Text>
            <Text style={styles.infoValue}>Full profile editing coming soon to mobile.</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.actionRowEnd}>
        <TouchableOpacity onPress={() => flipTo(0, null)} style={styles.cancelBtn}><Text style={{color:'#1A1A1A', fontWeight:'600'}}>Cancel</Text></TouchableOpacity>
        <TouchableOpacity style={styles.saveBtn}><Text style={{color:'#FFF', fontWeight:'600'}}>Save</Text></TouchableOpacity>
      </View>
    </Animated.View>
  );

  return (
    <View style={styles.cardContainer}>
      {renderBack()}
      {renderFront()}
    </View>
  );
};

export const RetailersDirectory = ({ compactMode = false }) => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { error } = useToast();
  const [retailers, setRetailers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSegment, setActiveSegment] = useState('All Segments');
  const [orderAggregates, setOrderAggregates] = useState({});
  const [availableDistricts, setAvailableDistricts] = useState([]);
  const [rewardsMap, setRewardsMap] = useState({});
  const [salesRepsMap, setSalesRepsMap] = useState({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedLocation, setSelectedLocation] = useState('');

  useRealtime(['users', 'orders'], () => setRefreshKey(k => k + 1));

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [allUsers, aggData, distData, bulkRewards] = await Promise.all([
          sheetsService._fetch('/users').catch(() => []),
          sheetsService.getOrderAggregates().catch(() => ({})),
          sheetsService.getAvailableDistricts().catch(() => []),
          sheetsService.getBulkCustomerRewards().catch(() => ({}))
        ]);
        
        if (Array.isArray(distData)) setAvailableDistricts(distData);
        
        const onlyRetailers = allUsers.filter(u => 
          (u.Role === 'customer' || u.Role === 'dealer' || u.Role === 'retailer') && 
          u.ApprovalStatus !== 'Pending'
        );
        
        setRetailers(onlyRetailers);
        setOrderAggregates(aggData);

        const salesMap = {};
        allUsers.forEach(u => {
          if (u.Role === 'sales') salesMap[u.UserID] = u.Name || 'Unknown Rep';
        });
        setSalesRepsMap(salesMap);
        setRewardsMap(bulkRewards);
      } catch (err) {
        error('Failed to load retailers directory.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user, error, refreshKey]);

  const uniqueLocations = [...new Set(retailers.map(r => r.City || 'Unknown'))].filter(Boolean).sort();

  const filteredRetailers = retailers.filter(r => {
    if (selectedLocation && (r.City || 'Unknown') !== selectedLocation) return false;
    const segment = r.Segment ? r.Segment : (r.NonTradeActivated === true || r.NonTradeActivated === 'true' ? 'Non-Trade' : 'Trade');
    if (activeSegment !== 'All Segments' && segment !== activeSegment) return false;
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (r.Name?.toLowerCase().includes(q) || r.Company?.toLowerCase().includes(q) || r.UserID?.toLowerCase().includes(q));
  });

  const handleDeleteCustomer = async (customerId) => {
    Alert.alert("Confirm Delete", "Are you sure you want to permanently delete this customer?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
          try {
            await sheetsService.deleteUser(user, customerId);
            setRetailers(prev => prev.filter(r => r.UserID !== customerId));
          } catch (err) {
            error(err.message || 'Failed to delete customer');
          }
        }
      }
    ]);
  };

  const handleSaveCreditLimit = async (userId, editLimit) => {
    try {
      await sheetsService.updateCustomerLimits(user, userId, { CreditLimit: Number(editLimit) });
      setRefreshKey(k => k + 1);
    } catch(err) {
      error(err.message || 'Failed to update limit');
    }
  };

  const handleOrder = (r) => {
    const rolePath = user.Role === 'admin' ? 'admin' : (user.Role || '').toLowerCase();
    navigation.navigate('NewOrder', { forCustomer: JSON.stringify(r) });
  };

  if (loading) return <View style={{padding:16}}><CardSkeleton /><CardSkeleton /></View>;

  return (
    <View style={styles.container}>
      {!compactMode && (
        <View style={styles.header}>
          <Text style={styles.headerTitle}><Users size={18} color="#1A1A1A" /> Retailer & Dealer Directory</Text>
          <View style={styles.filterRow}>
            <View style={styles.searchBox}>
              <Search size={16} color="#8E8E93" style={{position:'absolute', left:12}} />
              <TextInput value={searchTerm} onChangeText={setSearchTerm} placeholder="Search retailers..." style={styles.searchInput} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8, paddingVertical:4}}>
              {['All Segments', 'Trade', 'Non-Trade'].map(seg => (
                <TouchableOpacity key={seg} onPress={() => setActiveSegment(seg)} style={[styles.segmentBtn, activeSegment===seg && styles.segmentBtnActive]}>
                  <Text style={[styles.segmentText, activeSegment===seg && styles.segmentTextActive]}>{seg}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <ExportButton data={filteredRetailers} filename="Retailers" />
          </View>
        </View>
      )}

      {compactMode ? (
        <View style={styles.listContainer}>
          {filteredRetailers.slice(0, 5).map(r => {
            const segment = r.Segment ? r.Segment : (r.NonTradeActivated === true || r.NonTradeActivated === 'true' ? 'Non-Trade' : 'Trade');
            const outst = Number(r.OutstandingAmount) || 0;
            const creditLimit = Number(r.CreditLimit) || 0;
            const spendable = Math.max(0, creditLimit - outst);
            const agg = orderAggregates[r.UserID] || { count: 0, achievedValue: 0 };
            const isNonTrade = segment === 'Non-Trade';
            const repId = r.AssignedSalesRep;
            return (
              <RetailerCard 
                key={r.UserID} r={r} user={user}
                repName={repId ? (salesRepsMap[repId] || 'Unknown Rep') : 'Unassigned'} repId={repId}
                outst={outst} creditLimit={creditLimit} spendable={spendable} segment={segment}
                ordersCount={agg.count} outstColor={outst === 0 ? '#34C759' : '#F59E0B'}
                badgeBg={isNonTrade ? '#F3E8FF' : '#E0F2FE'} badgeColor={isNonTrade ? '#9333EA' : '#0284C7'}
                targetValue={rewardsMap[r.UserID]?.targets?.[1]?.target || 280} achievedValue={agg.achievedValue}
                onDelete={handleDeleteCustomer} onOrder={handleOrder} handleSaveCreditLimit={handleSaveCreditLimit}
              />
            );
          })}
        </View>
      ) : (
        <FlatList
          data={filteredRetailers}
          keyExtractor={r => r.UserID}
          contentContainerStyle={styles.listContainer}
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={5}
          renderItem={({ item: r }) => {
            const segment = r.Segment ? r.Segment : (r.NonTradeActivated === true || r.NonTradeActivated === 'true' ? 'Non-Trade' : 'Trade');
            const outst = Number(r.OutstandingAmount) || 0;
            const creditLimit = Number(r.CreditLimit) || 0;
            const spendable = Math.max(0, creditLimit - outst);
            const agg = orderAggregates[r.UserID] || { count: 0, achievedValue: 0 };
            const isNonTrade = segment === 'Non-Trade';
            const repId = r.AssignedSalesRep;
            return (
              <RetailerCard 
                r={r} user={user}
                repName={repId ? (salesRepsMap[repId] || 'Unknown Rep') : 'Unassigned'} repId={repId}
                outst={outst} creditLimit={creditLimit} spendable={spendable} segment={segment}
                ordersCount={agg.count} outstColor={outst === 0 ? '#34C759' : '#F59E0B'}
                badgeBg={isNonTrade ? '#F3E8FF' : '#E0F2FE'} badgeColor={isNonTrade ? '#9333EA' : '#0284C7'}
                targetValue={rewardsMap[r.UserID]?.targets?.[1]?.target || 280} achievedValue={agg.achievedValue}
                onDelete={handleDeleteCustomer} onOrder={handleOrder} handleSaveCreditLimit={handleSaveCreditLimit}
              />
            );
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E5EA' },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A1A', marginBottom: 16, display:'flex', flexDirection:'row', alignItems:'center' },
  filterRow: { gap: 12 },
  searchBox: { position: 'relative', justifyContent: 'center' },
  searchInput: { backgroundColor: '#F2F2F7', borderRadius: 8, padding: 10, paddingLeft: 36, fontSize: 14 },
  segmentBtn: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: '#E5E5EA' },
  segmentBtnActive: { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' },
  segmentText: { fontSize: 12, fontWeight: '600', color: '#8E8E93' },
  segmentTextActive: { color: '#FFF' },
  listContainer: { padding: 16, gap: 16 },
  
  cardContainer: { width: '100%', marginBottom: 16 },
  cardFace: { width: '100%', backfaceVisibility: 'hidden', backgroundColor: '#FFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E5E5EA', elevation: 2 },
  cardFaceBack: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#F8F9FA' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#1A1A1A' },
  badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  cardSub: { fontSize: 14, color: '#8E8E93', marginBottom: 24 },
  infoGrid: { gap: 16, marginBottom: 24 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  infoLabel: { fontSize: 14, color: '#8E8E93' },
  infoValue: { flex: 1, textAlign: 'right', fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  financeGrid: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  financeBox: { flex: 1, backgroundColor: '#F8F9FA', borderRadius: 12, padding: 16 },
  financeLabel: { fontSize: 10, fontWeight: '600', color: '#8E8E93', marginBottom: 8 },
  financeValue: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  editInput: { width: 70, backgroundColor: '#FFF', borderWidth: 1, padding: 4, borderRadius: 6 },
  iconBtn: { backgroundColor: '#1A1A1A', padding: 6, borderRadius: 12, marginLeft: 4 },
  outstandingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  rewardsBox: { flexDirection: 'row', backgroundColor: '#F8F9FA', borderRadius: 12, padding: 16, gap: 16, alignItems: 'center', marginBottom: 20 },
  rewardTextRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  rewardLabel: { fontSize: 14, color: '#8E8E93' },
  rewardVal: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  progressBar: { height: 4, backgroundColor: '#E5E5EA', borderRadius: 2, marginTop: 8 },
  progressFill: { height: '100%', backgroundColor: '#D1D1D6', borderRadius: 2 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20 },
  actionBtnText: { fontSize: 12, fontWeight: '600' },
  actionRowEnd: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 24 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: '#E5E5EA', backgroundColor: '#FFF' },
  saveBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#1A1A1A' }
});
