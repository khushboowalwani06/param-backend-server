import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, ActivityIndicator, Alert } from 'react-native';
import { sheetsService } from '../../services/sheetsService';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../../components/StatusBadge';
import { useRealtime } from '../../hooks/useRealtime';
import { Clock, Truck, MapPin, Edit3, Check, X } from 'lucide-react-native';
import { CardSkeleton } from '../../components/Skeleton';
import { Pagination } from '../../components/Pagination';

const AwaitingCard = ({ order, isDispatching, onDispatch, onCancel, onSavePrice, editingPriceId, setEditingPriceId, editingPriceValue, setEditingPriceValue }) => {
  const isEditing = editingPriceId === order.OrdID;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.orderId} numberOfLines={1}>{order.OrdID}</Text>
        </View>
        <StatusBadge status={order.ApprovalStatus} />
      </View>

      <View style={styles.content}>
        <View style={styles.infoRow}>
          <Text style={styles.label}>CUSTOMER</Text>
          <Text style={styles.valueText} numberOfLines={1}>{order.Name}</Text>
          <Text style={styles.subText} numberOfLines={1}>{order.Company}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>ITEMS</Text>
          <Text style={styles.valueText} numberOfLines={1}>{order.EstimateQty} {order.Unit || 'Bags'} • {order.Product}</Text>
          <View style={styles.locationRow}>
            <MapPin size={12} color="#8E8E93" />
            <Text style={styles.subText}>{order.AddressDetails ? order.AddressDetails.substring(0, 30) + '...' : 'Address Pending'}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>AMOUNT</Text>
          {isEditing ? (
            <View style={styles.editPriceRow}>
              <Text style={styles.currency}>₹</Text>
              <TextInput
                style={styles.priceInput}
                value={editingPriceValue}
                onChangeText={setEditingPriceValue}
                keyboardType="numeric"
              />
              <TouchableOpacity onPress={() => onSavePrice(order.OrdID)} style={styles.saveBtn}>
                <Check size={14} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditingPriceId(null)} style={styles.cancelEditBtn}>
                <X size={14} color="#8E8E93" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.priceRow}>
              <Text style={styles.valueText}>₹{(Number(order.EstimateAmt) || 0).toLocaleString()}</Text>
              <TouchableOpacity onPress={() => { setEditingPriceId(order.OrdID); setEditingPriceValue(order.EstimateAmt); }} style={styles.editIconBtn}>
                <Edit3 size={14} color="#8E8E93" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelBtnText}>CANCEL ORDER</Text>
        </TouchableOpacity>
        
        {order.ApprovalStatus === 'Ready for Dispatch' ? (
          <TouchableOpacity 
            style={[styles.dispatchBtn, isDispatching && { opacity: 0.7 }]} 
            onPress={onDispatch}
            disabled={isDispatching}
          >
            {isDispatching ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Truck size={16} color="#FFF" />
                <Text style={styles.dispatchBtnText}>DISPATCH</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.waitingBtn}>
            <Clock size={16} color="#F59E0B" />
            <Text style={styles.waitingBtnText}>WAITING FOR ADMIN</Text>
          </View>
        )}
      </View>
    </View>
  );
};

export default function SalesAwaiting() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDispatching, setIsDispatching] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [editingPriceValue, setEditingPriceValue] = useState('');
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useRealtime(['orders', 'profiles'], () => setRefreshKey(k => k + 1));

  const fetchOrders = async () => {
    try {
      const data = await sheetsService.getOrders(user);
      const awaitingAdmin = data.filter(o => 
        (o.ApprovalStatus === 'Pending Admin Approval' || o.ApprovalStatus === 'Ready for Dispatch') && 
        o.SalesApproverID === user.UserID
      );
      awaitingAdmin.sort((a, b) => new Date(a.OrderTimestamp) - new Date(b.OrderTimestamp));
      setOrders(awaitingAdmin);
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

  const handleDispatch = async (ordId) => {
    setIsDispatching(true);
    try {
      await sheetsService.updateOrderStatus(user, ordId, 'In Transit');
      alert(`Order ${ordId} dispatched successfully!`);
      await fetchOrders();
    } catch (err) {
      alert(`Dispatch failed: ${err.message}`);
    } finally {
      setIsDispatching(false);
    }
  };

  const handleSavePrice = async (ordId) => {
    try {
      await sheetsService.updateOrderPrice(user, ordId, Number(editingPriceValue));
      alert(`Price updated successfully`);
      setEditingPriceId(null);
      await fetchOrders();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCancel = (ordId) => {
    Alert.alert(
      "Cancel Order",
      `Are you sure you want to cancel order ${ordId}?`,
      [
        { text: "No", style: "cancel" },
        { 
          text: "Yes", 
          style: "destructive",
          onPress: async () => {
            try {
              await sheetsService.updateOrderStatus(user, ordId, 'Cancelled');
              fetchOrders();
            } catch (err) {
              alert(err.message);
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, padding: 16 }}>
        <CardSkeleton />
        <CardSkeleton />
      </View>
    );
  }

  const totalPages = Math.ceil(orders.length / itemsPerPage);
  const paginatedOrders = orders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.header}>
          <Text style={styles.title}>Fleet Dispatch Actions</Text>
          <Text style={styles.subtitle}>Orders approved by administration waiting for physical dispatch logs.</Text>
        </View>

        {orders.length === 0 ? (
          <View style={styles.emptyState}>
            <Clock size={48} color="#E5E5EA" />
            <Text style={styles.emptyTitle}>No Pending Dispatches</Text>
            <Text style={styles.emptySub}>All your approved orders have either been dispatched or are waiting for Admin sign-off.</Text>
          </View>
        ) : (
          paginatedOrders.map(order => (
            <AwaitingCard
              key={order.OrdID}
              order={order}
              isDispatching={isDispatching}
              onDispatch={() => handleDispatch(order.OrdID)}
              onCancel={() => handleCancel(order.OrdID)}
              onSavePrice={handleSavePrice}
              editingPriceId={editingPriceId}
              setEditingPriceId={setEditingPriceId}
              editingPriceValue={editingPriceValue}
              setEditingPriceValue={setEditingPriceValue}
            />
          ))
        )}

      </ScrollView>

      {totalPages > 1 && (
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
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
    color: '#1A1A1A',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F2F2F7',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginTop: 16,
  },
  emptySub: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 8,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F2F2F7',
    marginBottom: 16,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FCFCFC',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  orderId: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  infoRow: {
    marginBottom: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 1,
    marginBottom: 4,
  },
  valueText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  subText: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editIconBtn: {
    padding: 4,
  },
  editPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currency: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  priceInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    width: 100,
    fontSize: 14,
  },
  saveBtn: {
    backgroundColor: '#1A1A1A',
    padding: 6,
    borderRadius: 4,
  },
  cancelEditBtn: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    padding: 6,
    borderRadius: 4,
  },
  actions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  cancelBtn: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#F2F2F7',
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  dispatchBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#1A1A1A',
    gap: 8,
  },
  dispatchBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 1,
  },
  waitingBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#FFFBEB',
    gap: 8,
  },
  waitingBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F59E0B',
  },
});
