import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native';
import { sheetsService } from '../services/sheetsService';
import { useAuth } from '../context/AuthContext';
import { Truck, Package, CheckCircle, PackageCheck, AlertCircle, Edit3, Check, X, Search } from 'lucide-react-native';

const StatusBadge = ({ status }) => {
  let color = '#64748B';
  let bgColor = '#F1F5F9';
  if (status === 'Delivered') { color = '#10B981'; bgColor = '#D1FAE5'; }
  else if (status === 'In Transit') { color = '#F59E0B'; bgColor = '#FEF3C7'; }
  else if (status === 'Dispatched') { color = '#3B82F6'; bgColor = '#DBEAFE'; }
  else if (status === 'Ready for Dispatch') { color = '#8B5CF6'; bgColor = '#EDE9FE'; }

  return (
    <View style={[styles.badge, { backgroundColor: bgColor }]}>
      <Text style={[styles.badgeText, { color }]}>{status || 'Unknown'}</Text>
    </View>
  );
};

export default function SharedLogistics() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSegment, setActiveSegment] = useState('All Segments');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [dispatchingOrder, setDispatchingOrder] = useState(null);
  const [selectedDepot, setSelectedDepot] = useState('Main Godown');

  const [editingPriceId, setEditingPriceId] = useState(null);
  const [editingPriceValue, setEditingPriceValue] = useState('');

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const [data, allUsers] = await Promise.all([
        sheetsService.getOrders(user),
        sheetsService._fetch('/users').catch(() => [])
      ]);
      const activeLogistics = data.filter(o => 
        ['Ready for Dispatch', 'Dispatched', 'In Transit'].includes(o.ApprovalStatus)
      );
      activeLogistics.sort((a, b) => new Date(a.OrderTimestamp) - new Date(b.OrderTimestamp));
      setOrders(activeLogistics);
      setUsers(allUsers);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [user]);

  const handleUpdateStatus = async (order, newStatus) => {
    try {
      if (newStatus === 'Dispatched') {
        await sheetsService._fetch('/challans', {
          method: 'POST',
          body: JSON.stringify({
            UserID: order.UserID,
            Date: new Date().toISOString().split('T')[0],
            Depot: selectedDepot,
            Grade: order.Product,
            QuantityDeposited: order.EstimateQty
          })
        });
      }
      await sheetsService.updateOrderStatus(user, order.OrdID, newStatus);
      setDispatchingOrder(null);
      await fetchOrders();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const handleCancel = (order) => {
    Alert.alert(
      "Cancel Order",
      `Are you sure you want to cancel order ${order.OrdID}?`,
      [
        { text: "No", style: "cancel" },
        { 
          text: "Yes", 
          style: "destructive",
          onPress: async () => {
            try {
              await sheetsService.updateOrderStatus(user, order.OrdID, 'Cancelled');
              fetchOrders();
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          }
        }
      ]
    );
  };

  const handleSavePrice = async (ordId) => {
    try {
      await sheetsService.updateOrderPrice(user, ordId, Number(editingPriceValue));
      setEditingPriceId(null);
      await fetchOrders();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const filteredOrders = orders.filter(order => {
    if (activeSegment !== 'All Segments') {
      const u = users.find(u => u.UserID === order.UserID);
      const segment = u ? (u.Segment ? u.Segment : (u.NonTradeActivated === true || u.NonTradeActivated === 'true' ? 'Non-Trade' : 'Trade')) : 'Trade';
      if (segment !== activeSegment) return false;
    }
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matches = 
        order.OrdID?.toLowerCase().includes(q) || 
        order.Company?.toLowerCase().includes(q) || 
        order.Name?.toLowerCase().includes(q) || 
        order.Product?.toLowerCase().includes(q);
      if (!matches) return false;
    }

    return true;
  });

  const renderAction = (order) => {
    return (
      <View style={{ gap: 8, marginTop: 12 }}>
        {order.ApprovalStatus === 'Ready for Dispatch' && (
          dispatchingOrder === order.OrdID ? (
            <View style={styles.dispatchForm}>
              <Text style={styles.dispatchLabel}>Selected Depot: Main Godown (Static for now)</Text>
              <View style={styles.dispatchButtons}>
                <TouchableOpacity 
                  style={[styles.btn, { flex: 1, backgroundColor: '#1A1A1A' }]}
                  onPress={() => handleUpdateStatus(order, 'Dispatched')}
                >
                  <Text style={[styles.btnText, { color: '#FFF' }]}>Confirm Dispatch</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.btn, { flex: 1, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0' }]}
                  onPress={() => setDispatchingOrder(null)}
                >
                  <Text style={[styles.btnText, { color: '#64748B' }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity 
              style={[styles.btn, { backgroundColor: '#1A1A1A' }]}
              onPress={() => {
                setDispatchingOrder(order.OrdID);
                setSelectedDepot('Main Godown');
              }}
            >
              <Package size={16} color="#FFF" />
              <Text style={[styles.btnText, { color: '#FFF' }]}>Mark Dispatched</Text>
            </TouchableOpacity>
          )
        )}
        {order.ApprovalStatus === 'Dispatched' && (
          <TouchableOpacity 
            style={[styles.btn, { backgroundColor: '#F59E0B' }]}
            onPress={() => handleUpdateStatus(order, 'In Transit')}
          >
            <Truck size={16} color="#FFF" />
            <Text style={[styles.btnText, { color: '#FFF' }]}>Mark In Transit</Text>
          </TouchableOpacity>
        )}
        {order.ApprovalStatus === 'In Transit' && (
          <TouchableOpacity 
            style={[styles.btn, { backgroundColor: '#10B981' }]}
            onPress={() => handleUpdateStatus(order, 'Delivered')}
          >
            <CheckCircle size={16} color="#FFF" />
            <Text style={[styles.btnText, { color: '#FFF' }]}>Mark Delivered</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          style={[styles.btn, { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#DC2626' }]}
          onPress={() => handleCancel(order)}
        >
          <X size={16} color="#DC2626" />
          <Text style={[styles.btnText, { color: '#DC2626' }]}>Cancel Order</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1A1A1A" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Logistics & Delivery</Text>
        <Text style={styles.subtitle}>Manage the physical dispatch and delivery of approved orders.</Text>
      </View>

      <View style={styles.filtersContainer}>
        <View style={styles.segments}>
          {['All Segments', 'Trade', 'Non-Trade'].map(seg => (
            <TouchableOpacity 
              key={seg}
              onPress={() => setActiveSegment(seg)}
              style={[styles.segmentBtn, activeSegment === seg && styles.segmentBtnActive]}
            >
              <Text style={[styles.segmentText, activeSegment === seg && styles.segmentTextActive]}>{seg}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.searchBar}>
          <Search size={20} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by Order ID, Company..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#94A3B8"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={20} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {filteredOrders.length === 0 ? (
        <View style={styles.emptyState}>
          <PackageCheck size={48} color="#CBD5E1" />
          <Text style={styles.emptyText}>No Active Logistics</Text>
          <Text style={styles.emptySubtext}>There are no orders currently awaiting dispatch or delivery.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {filteredOrders.map(order => (
            <View key={order.OrdID} style={styles.card}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.ordId}>{order.OrdID}</Text>
                  <Text style={styles.companyName}>{order.Company || 'No Company Name'}</Text>
                  <Text style={styles.customerName}>{order.Name || 'No Customer Name'}</Text>
                </View>
                <StatusBadge status={order.ApprovalStatus} />
              </View>

              <View style={styles.cardBody}>
                <View style={styles.row}>
                  <Text style={styles.label}>Product</Text>
                  <Text style={styles.value}>{order.Product}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>Quantity</Text>
                  <Text style={styles.value}>{order.EstimateQty}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>Price</Text>
                  {editingPriceId === order.OrdID ? (
                    <View style={styles.editPriceContainer}>
                      <Text style={styles.currency}>₹</Text>
                      <TextInput 
                        style={styles.priceInput}
                        value={String(editingPriceValue)}
                        onChangeText={setEditingPriceValue}
                        keyboardType="numeric"
                      />
                      <TouchableOpacity onPress={() => handleSavePrice(order.OrdID)} style={styles.iconBtnPrimary}><Check size={12} color="#FFF" /></TouchableOpacity>
                      <TouchableOpacity onPress={() => setEditingPriceId(null)} style={styles.iconBtnSecondary}><X size={12} color="#8E8E93" /></TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.editPriceContainer}>
                      <Text style={styles.valueBold}>₹{(Number(order.EstimateAmt) || 0).toLocaleString()}</Text>
                      <TouchableOpacity onPress={() => { setEditingPriceId(order.OrdID); setEditingPriceValue(String(order.EstimateAmt)); }}>
                        <Edit3 size={14} color="#8E8E93" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>Address</Text>
                  <Text style={[styles.value, { textAlign: 'right', flex: 2 }]} numberOfLines={2}>
                    {order.Address}, {order.City}
                  </Text>
                </View>
              </View>

              {order.ApprovalStatus === 'In Transit' && (
                <View style={styles.warningBox}>
                  <AlertCircle size={16} color="#F59E0B" />
                  <Text style={styles.warningText}>Once marked Delivered, Customer must confirm receipt.</Text>
                </View>
              )}

              {renderAction(order)}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  subtitle: {
    color: '#64748B',
    fontSize: 14,
  },
  filtersContainer: {
    gap: 12,
    marginBottom: 20,
  },
  segments: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  segmentBtnActive: {
    backgroundColor: '#1A1A1A',
    borderColor: '#1A1A1A',
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  segmentTextActive: {
    color: '#FFF',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#1A1A1A',
    outlineStyle: 'none',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  emptySubtext: {
    marginTop: 4,
    fontSize: 14,
    color: '#64748B',
  },
  list: {
    gap: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  ordId: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  companyName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginTop: 2,
  },
  customerName: {
    fontSize: 14,
    color: '#64748B',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardBody: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 16,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    color: '#64748B',
  },
  value: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  valueBold: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  editPriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currency: {
    fontWeight: 'bold',
  },
  priceInput: {
    width: 60,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    fontSize: 14,
    backgroundColor: '#FFF',
  },
  iconBtnPrimary: {
    backgroundColor: '#1A1A1A',
    padding: 4,
    borderRadius: 4,
  },
  iconBtnSecondary: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 4,
    borderRadius: 4,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  warningText: {
    fontSize: 12,
    color: '#B45309',
    fontWeight: '500',
    flex: 1,
  },
  dispatchForm: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
  },
  dispatchLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  dispatchButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  btnText: {
    fontWeight: '600',
    fontSize: 14,
  },
});
