import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, FlatList, ActivityIndicator, TextInput, Platform, Modal, Image, Dimensions } from 'react-native';
import { sheetsService } from '../../services/sheetsService';
import { useAuth } from '../../context/AuthContext';
import { X, FileText, Download, Search } from 'lucide-react-native';
import { SearchFilter } from '../../components/SearchFilter';

const { width } = Dimensions.get('window');

const StatusBadge = ({ status }) => {
  let color = '#64748B';
  let bgColor = '#F1F5F9';
  if (status === 'Closed') { color = '#10B981'; bgColor = '#D1FAE5'; }
  else if (status === 'Payment Pending') { color = '#F59E0B'; bgColor = '#FEF3C7'; }
  else if (status === 'Payment Sent') { color = '#3B82F6'; bgColor = '#DBEAFE'; }
  else if (status === 'Overdue') { color = '#EF4444'; bgColor = '#FEE2E2'; }

  return (
    <View style={[styles.badge, { backgroundColor: bgColor }]}>
      <Text style={[styles.badgeText, { color }]}>{status || 'Unknown'}</Text>
    </View>
  );
};

export default function AccountantAllInvoices() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewReceiptUrl, setViewReceiptUrl] = useState(null);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [data, accountsData] = await Promise.all([
        sheetsService.getOrders(user),
        sheetsService.getAllAccounts(user).catch(() => [])
      ]);

      const invoicedOrders = data.filter(o =>
        o.ApprovalStatus === 'Payment Pending' ||
        o.ApprovalStatus === 'Payment Sent' ||
        o.ApprovalStatus === 'Closed' ||
        o.ApprovalStatus === 'Overdue'
      );

      const ordersWithAccounts = invoicedOrders.map(o => {
        const acc = accountsData.find(a => a.OrdID === o.OrdID) || {};
        return { ...o, ...acc };
      });

      ordersWithAccounts.sort((a, b) => new Date(b.OrderTimestamp) - new Date(a.OrderTimestamp));
      setOrders(ordersWithAccounts);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter(o => {
    const term = searchTerm.toLowerCase();
    return (
      o.OrdID?.toLowerCase().includes(term) ||
      o.Company?.toLowerCase().includes(term) ||
      o.Product?.toLowerCase().includes(term) ||
      (o.TransactionID && o.TransactionID.toLowerCase().includes(term))
    );
  });

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1A1A1A" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>All Invoices</Text>
        <Text style={styles.subtitle}>View and search all invoices generated across the system.</Text>
      </View>

      <View style={styles.actionsContainer}>
        <View style={{ flex: 1, minWidth: 200 }}>
          <SearchFilter 
            value={searchTerm} 
            onChange={setSearchTerm} 
            placeholder="Search by Order ID or Trans ID..." 
          />
        </View>
        <TouchableOpacity style={styles.exportBtn} onPress={() => alert('Export CSV not fully ported yet.')}>
          <FileText size={16} color="#1A1A1A" />
          <Text style={styles.exportText}>Export CSV</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredOrders}
        keyExtractor={order => order.OrdID}
        style={styles.listContainer}
        initialNumToRender={10}
        windowSize={5}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <FileText size={48} color="#CBD5E1" />
            <Text style={styles.emptyText}>No Invoices Yet</Text>
          </View>
        }
        renderItem={({ item: order }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.ordId}>{order.OrdID}</Text>
                <Text style={styles.dateText}>{order.OrderTimestamp ? new Date(order.OrderTimestamp).toLocaleDateString() : 'N/A'}</Text>
              </View>
              <StatusBadge status={order.ApprovalStatus} />
            </View>

            <View style={styles.cardBody}>
              <View style={styles.row}>
                <Text style={styles.label}>Customer:</Text>
                <Text style={styles.value}>{order.Company || order.Name}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Amount:</Text>
                <Text style={styles.valueBold}>₹{order.FinalInvoicedAmount ? Number(order.FinalInvoicedAmount).toLocaleString() : Number(order.EstimateAmt || 0).toLocaleString()}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Payment Info:</Text>
                <View style={{ flex: 1 }}>
                  {(order.TransactionID || order.PaymentReference) ? (
                    <>
                      <Text style={styles.value}>Txn: {order.TransactionID || order.PaymentReference}</Text>
                      {(order.PaymentScreenshot || order.PaymentProofLink) && (
                        <TouchableOpacity
                          style={styles.receiptBtn}
                          onPress={() => setViewReceiptUrl(order.PaymentScreenshot || order.PaymentProofLink)}
                        >
                          <FileText size={12} color="#16A34A" />
                          <Text style={styles.receiptText}>View Receipt</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  ) : (
                    <Text style={[styles.value, { color: '#94A3B8' }]}>Pending</Text>
                  )}
                </View>
              </View>
            </View>

            <View style={styles.cardFooter}>
              {order.InvoicePdf || order.InvoicePdfLink ? (
                <TouchableOpacity
                  style={styles.invoiceBtn}
                  onPress={() => alert('View Invoice functionality requires webview/pdf viewer')}
                >
                  <FileText size={14} color="#1A1A1A" />
                  <Text style={styles.invoiceText}>View Invoice</Text>
                </TouchableOpacity>
              ) : (
                <View style={[styles.invoiceBtn, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0', borderWidth: 1 }]}>
                  <FileText size={14} color="#9CA3AF" />
                  <Text style={[styles.invoiceText, { color: '#9CA3AF' }]}>No Invoice Yet</Text>
                </View>
              )}
            </View>
          </View>
        )}
      />

      {/* View Receipt Modal */}
      <Modal visible={!!viewReceiptUrl} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => setViewReceiptUrl(null)}
          >
            <X size={24} color="#FFF" />
          </TouchableOpacity>
          {viewReceiptUrl && (
            <Image
              source={{ uri: viewReceiptUrl }}
              style={styles.modalImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
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
  actionsContainer: {
    flexDirection: width > 768 ? 'row' : 'column',
    gap: 12,
    marginBottom: 20,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E5E5EA',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
    alignSelf: width > 768 ? 'center' : 'stretch',
    justifyContent: 'center',
  },
  exportText: {
    fontWeight: '600',
    fontSize: 14,
    color: '#1A1A1A',
  },
  listContainer: {
    flex: 1,
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
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
      android: { elevation: 2 },
      web: { boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }
    })
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  ordId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  dateText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
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
    gap: 12,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  label: {
    width: 100,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  value: {
    flex: 1,
    fontSize: 14,
    color: '#1A1A1A',
  },
  valueBold: {
    flex: 1,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  receiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  receiptText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16A34A',
  },
  cardFooter: {
    flexDirection: 'row',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 16,
  },
  invoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  invoiceText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
  },
  modalImage: {
    width: width * 0.9,
    height: '80%',
  },
});
