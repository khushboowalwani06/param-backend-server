import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { sheetsService } from '../../services/sheetsService';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../../components/StatusBadge';
import { useRealtime } from '../../hooks/useRealtime';
import { SearchFilter } from '../../components/SearchFilter';
import { CardSkeleton } from '../../components/Skeleton';
import { ExportButton } from '../../components/ExportButton';
import { EditOrderModal } from '../../components/EditOrderModal';
import { Edit2 } from 'lucide-react-native';
import { DateRangeFilter } from '../../components/DateRangeFilter';
import { Pagination } from '../../components/Pagination';

const OrderCard = ({ order, users, isEditing, onEditStart, onEditCancel, onUpdate }) => {
  const flipAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(flipAnim, {
      toValue: isEditing ? 180 : 0,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start();
  }, [isEditing]);

  const frontInterpolate = flipAnim.interpolate({ inputRange: [0, 180], outputRange: ['0deg', '180deg'] });
  const backInterpolate = flipAnim.interpolate({ inputRange: [0, 180], outputRange: ['180deg', '360deg'] });

  const formatCurrency = (val) => `₹${Number(val).toLocaleString('en-IN')}`;

  const u = users.find(usr => usr.UserID === order.UserID);
  const userSegment = u ? (u.Segment ? u.Segment : (u.NonTradeActivated === true || u.NonTradeActivated === 'true' ? 'Non-Trade' : 'Trade')) : 'Trade';
  const isNonTrade = userSegment === 'Non-Trade';

  const renderFront = () => (
    <Animated.View style={[styles.cardFace, { transform: [{ rotateY: frontInterpolate }] }]}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.orderId}>{order.OrdID}</Text>
          <Text style={styles.orderDate}>{order.OrderTimestamp ? new Date(order.OrderTimestamp).toLocaleDateString() : 'N/A'}</Text>
        </View>
        <StatusBadge status={order.ApprovalStatus} />
      </View>

      <View style={styles.cardBody}>
        <View style={styles.infoBlock}>
          <Text style={styles.infoLabel}>CUSTOMER</Text>
          <Text style={styles.infoValue} numberOfLines={1}>{order.Name} <Text style={{ fontWeight: '400', color: '#8E8E93' }}>({order.Company})</Text></Text>
        </View>

        <View style={styles.infoBlock}>
          <Text style={styles.infoLabel}>PRODUCT</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[styles.infoValue, { flex: 1 }]} numberOfLines={1}>{order.Product}</Text>
            <View style={[styles.segmentBadge, isNonTrade && styles.segmentBadgeNonTrade]}>
              <Text style={[styles.segmentText, isNonTrade && styles.segmentTextNonTrade]}>{userSegment}</Text>
            </View>
          </View>
        </View>

        <View style={styles.grid2}>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>QUANTITY</Text>
            <Text style={[styles.infoValue, { fontSize: 16 }]}>{order.EstimateQty} {order.Unit}</Text>
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>UNIT PRICE</Text>
            <Text style={[styles.infoValue, { fontSize: 16 }]}>{formatCurrency(order.UnitPrice || 0)}</Text>
          </View>
        </View>

        <View style={styles.amtBox}>
          <Text style={styles.infoLabel}>ESTIMATE AMOUNT</Text>
          <Text style={styles.amtValue}>{formatCurrency(order.EstimateAmt || 0)}</Text>
        </View>

        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={onEditStart} style={styles.editBtn}>
          <Edit2 size={16} color="#475569" />
          <Text style={styles.editBtnText}>Edit Order</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const renderBack = () => (
    <Animated.View style={[styles.cardFace, styles.cardFaceBack, { transform: [{ rotateY: backInterpolate }] }]}>
      <EditOrderModal order={order} inline={true} onClose={onEditCancel} onUpdate={onUpdate} />
    </Animated.View>
  );

  return (
    <View style={styles.cardContainer}>
      {renderBack()}
      {renderFront()}
    </View>
  );
};

export const AllOrders = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSegment, setActiveSegment] = useState('All Segments');
  const [users, setUsers] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [editingOrder, setEditingOrder] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  useRealtime(['orders', 'payments'], () => setRefreshKey(k => k + 1));

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [data, allUsers] = await Promise.all([
          sheetsService.getOrders(user),
          sheetsService._fetch('/users').catch(() => [])
        ]);
        setOrders(data);
        setUsers(allUsers);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user, refreshKey]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeSegment, startDate, endDate]);

  if (loading) return <View style={{ padding: 16 }}><CardSkeleton /><CardSkeleton /></View>;

  const filteredOrders = orders.filter(o => {
    if (activeSegment !== 'All Segments') {
      const u = users.find(usr => usr.UserID === o.UserID);
      const segment = u ? (u.Segment ? u.Segment : (u.NonTradeActivated === true || u.NonTradeActivated === 'true' ? 'Non-Trade' : 'Trade')) : 'Trade';
      if (segment !== activeSegment) return false;
    }

    if (startDate || endDate) {
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
    }

    const term = searchTerm.toLowerCase();
    return (
      o.OrdID?.toLowerCase().includes(term) ||
      o.Company?.toLowerCase().includes(term) ||
      o.Name?.toLowerCase().includes(term) ||
      o.Product?.toLowerCase().includes(term)
    );
  });

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>All Orders Directory</Text>
        <Text style={styles.headerSub}>Complete ledger of all orders across the system.</Text>

        <View style={styles.filtersWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.segmentsRow}>
            {['All Segments', 'Trade', 'Non-Trade'].map(seg => (
              <TouchableOpacity
                key={seg}
                onPress={() => setActiveSegment(seg)}
                style={[styles.segmentBtn, activeSegment === seg && styles.segmentBtnActive]}
              >
                <Text style={[styles.segmentText, activeSegment === seg && styles.segmentTextActive]}>{seg}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <DateRangeFilter
            startDate={startDate} endDate={endDate}
            onDateChange={({ startDate: s, endDate: e }) => { setStartDate(s); setEndDate(e); }}
            onClear={() => { setStartDate(''); setEndDate(''); }}
            style={{ marginBottom: 12 }}
          />

          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <SearchFilter value={searchTerm} onChange={setSearchTerm} placeholder="Search ID, Company..." />
            </View>
            <ExportButton data={filteredOrders} filename="AllOrders" />
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.listContent}>
        {paginatedOrders.map(order => (
          <OrderCard
            key={order.OrdID}
            order={order}
            users={users}
            isEditing={editingOrder?.OrdID === order.OrdID}
            onEditStart={() => setEditingOrder(order)}
            onEditCancel={() => setEditingOrder(null)}
            onUpdate={() => setRefreshKey(k => k + 1)}
          />
        ))}

        {paginatedOrders.length === 0 && (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Text style={{ color: '#8E8E93' }}>No orders found.</Text>
          </View>
        )}
      </ScrollView>

      {totalPages > 1 && (
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E5EA' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A1A' },
  headerSub: { fontSize: 14, color: '#8E8E93', marginTop: 4, marginBottom: 16 },
  filtersWrapper: { gap: 12 },
  segmentsRow: { gap: 8, paddingBottom: 8 },
  segmentBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: '#E5E5EA' },
  segmentBtnActive: { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' },
  segmentText: { fontSize: 12, fontWeight: '600', color: '#8E8E93' },
  segmentTextActive: { color: '#FFF' },
  listContent: { padding: 16, gap: 16, paddingBottom: 40 },

  cardContainer: { width: '100%' },
  cardFace: { width: '100%', backfaceVisibility: 'hidden', backgroundColor: '#FFF', borderRadius: 16, borderWidth: 1, borderColor: '#E5E5EA', elevation: 2 },
  cardFaceBack: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#F8F9FA' },
  cardHeader: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#F2F2F7', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  orderId: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  orderDate: { fontSize: 12, color: '#8E8E93', marginTop: 4 },
  cardBody: { padding: 16, flex: 1, gap: 16 },
  infoBlock: { marginBottom: 4 },
  infoLabel: { fontSize: 10, fontWeight: '600', color: '#8E8E93', letterSpacing: 0.5, marginBottom: 4 },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  segmentBadge: { backgroundColor: '#E0F2FE', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  segmentBadgeNonTrade: { backgroundColor: '#F3E8FF' },
  segmentText: { fontSize: 10, fontWeight: '600', color: '#0284C7' },
  segmentTextNonTrade: { color: '#9333EA' },
  grid2: { flexDirection: 'row', gap: 16 },
  amtBox: { backgroundColor: '#F8F9FA', padding: 16, borderRadius: 12, marginTop: 8 },
  amtValue: { fontSize: 24, fontWeight: '700', color: '#1A1A1A' },
  editBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8F9FA', paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E5E5EA', gap: 8 },
  editBtnText: { fontSize: 14, fontWeight: '600', color: '#475569' }
});
