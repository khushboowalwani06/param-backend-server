import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, ActivityIndicator, Alert, Modal } from 'react-native';
import { sheetsService } from '../../services/sheetsService';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../../components/StatusBadge';
import { useRealtime } from '../../hooks/useRealtime';
import { SearchFilter } from '../../components/SearchFilter';
import { ExportButton } from '../../components/ExportButton';
import { Pagination } from '../../components/Pagination';
import DateRangeFilter from '../../components/DateRangeFilter';
import { Archive, Search, Filter, Download, Edit3, Check, X } from 'lucide-react-native';
import { CardSkeleton } from '../../components/Skeleton';
import { Picker } from '@react-native-picker/picker';

const HistoryCard = ({ order, onSavePrice, editingPriceId, setEditingPriceId, editingPriceValue, setEditingPriceValue }) => {
  const isEditing = editingPriceId === order.OrdID;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.orderId}>{order.OrdID}</Text>
        <StatusBadge status={order.ApprovalStatus} />
      </View>

      <View style={styles.content}>
        <View style={styles.infoRow}>
          <Text style={styles.label}>DATE</Text>
          <Text style={styles.valueText}>{order.OrderTimestamp ? new Date(order.OrderTimestamp).toLocaleDateString() : 'N/A'}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>CUSTOMER</Text>
          <Text style={styles.valueText}>{order.Name}</Text>
          <Text style={styles.subText}>{order.Company}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>ITEMS</Text>
          <Text style={styles.valueText}>{order.EstimateQty} {order.Unit || 'Bags'} • {order.Product}</Text>
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

        {order.RejectionReason ? (
          <View style={styles.rejectReasonBox}>
            <Text style={styles.label}>REJECTION REASON</Text>
            <Text style={styles.rejectReasonText}>{order.RejectionReason}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
};

export default function SalesHistory() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [activeProductFilter, setActiveProductFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [editingPriceValue, setEditingPriceValue] = useState('');
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);

  useRealtime(['orders', 'payments'], () => setRefreshKey(k => k + 1));

  const fetchOrders = async () => {
    try {
      const data = await sheetsService.getOrders(user);
      const history = data.filter(o => 
        o.SalesApproverID === user.UserID && o.ApprovalStatus !== 'Pending Admin Approval'
      );
      history.sort((a, b) => new Date(b.OrderTimestamp) - new Date(a.OrderTimestamp));
      setOrders(history);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [user, refreshKey]);

  const handleSavePrice = async (ordId) => {
    try {
      await sheetsService.updateOrderPrice(user, ordId, Number(editingPriceValue));
      setEditingPriceId(null);
      await fetchOrders();
      alert('Price updated successfully');
    } catch (err) {
      alert(err.message);
    }
  };

  const uniqueProducts = ['All', ...new Set(orders.map(o => o.Product).filter(Boolean))];

  const filteredOrders = orders.filter(o => {
    if (activeProductFilter !== 'All' && o.Product !== activeProductFilter) return false;
    
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

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        o.OrdID?.toLowerCase().includes(term) ||
        o.Company?.toLowerCase().includes(term) ||
        o.Product?.toLowerCase().includes(term) ||
        o.Name?.toLowerCase().includes(term)
      );
    }
    return true;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeProductFilter, startDate, endDate]);

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
          <Text style={styles.title}>Sales Registry</Text>
          <Text style={styles.subtitle}>Historical logs of your approvals, rejections, and closures.</Text>
        </View>

        <View style={styles.tools}>
          <SearchFilter value={searchTerm} onChange={setSearchTerm} placeholder="Search history..." />
          <TouchableOpacity style={styles.filterBtn} onPress={() => setIsFilterModalVisible(true)}>
            <Filter size={18} color="#1A1A1A" />
          </TouchableOpacity>
          <ExportButton data={filteredOrders} filename="sales_history" />
        </View>

        {filteredOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <Archive size={48} color="#E5E5EA" />
            <Text style={styles.emptyTitle}>No Records Found</Text>
            <Text style={styles.emptySub}>Try adjusting your filters or search term.</Text>
          </View>
        ) : (
          paginatedOrders.map(order => (
            <HistoryCard
              key={order.OrdID}
              order={order}
              onSavePrice={handleSavePrice}
              editingPriceId={editingPriceId}
              setEditingPriceId={setEditingPriceId}
              editingPriceValue={editingPriceValue}
              setEditingPriceValue={setEditingPriceValue}
            />
          ))
        )}

        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        )}

      </ScrollView>

      {/* Filters Modal */}
      <Modal visible={isFilterModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter History</Text>
              <TouchableOpacity onPress={() => setIsFilterModalVisible(false)}>
                <X size={24} color="#1A1A1A" />
              </TouchableOpacity>
            </View>

            <Text style={styles.filterLabel}>Product Type</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={activeProductFilter}
                onValueChange={(val) => setActiveProductFilter(val)}
              >
                {uniqueProducts.map(p => (
                  <Picker.Item key={p} label={p} value={p} />
                ))}
              </Picker>
            </View>

            <Text style={styles.filterLabel}>Date Range</Text>
            <DateRangeFilter
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
            />

            <TouchableOpacity style={styles.applyBtn} onPress={() => setIsFilterModalVisible(false)}>
              <Text style={styles.applyBtnText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
  tools: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
    zIndex: 10,
  },
  filterBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
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
  rejectReasonBox: {
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#DC2626',
  },
  rejectReasonText: {
    color: '#991B1B',
    fontSize: 13,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    minHeight: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
    marginTop: 16,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    marginBottom: 16,
  },
  applyBtn: {
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 32,
  },
  applyBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
});
