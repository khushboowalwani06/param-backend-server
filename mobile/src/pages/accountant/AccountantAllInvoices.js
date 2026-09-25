import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, FlatList, ActivityIndicator, Platform, Modal, Image, Dimensions, Alert } from 'react-native';
import { sheetsService } from '../../services/sheetsService';
import { useAuth } from '../../context/AuthContext';
import { X, FileText, Download, Search, Square, CheckSquare } from 'lucide-react-native';
import { SearchFilter } from '../../components/SearchFilter';
import { Pagination } from '../../components/Pagination';
import { ExportButton } from '../../components/ExportButton';
import { DateRangeFilter } from '../../components/DateRangeFilter';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, interpolate } from 'react-native-reanimated';
import * as Linking from 'expo-linking';
import JSZip from 'jszip';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useLanguage } from '../../context/LanguageContext';
const {
  width
} = Dimensions.get('window');
const StatusBadge = ({
  status
}) => {
  let color = '#64748B';
  let bgColor = '#F1F5F9';
  if (status === 'Closed') {
    color = '#10B981';
    bgColor = '#D1FAE5';
  } else if (status === 'Payment Pending') {
    color = '#F59E0B';
    bgColor = '#FEF3C7';
  } else if (status === 'Payment Sent') {
    color = '#3B82F6';
    bgColor = '#DBEAFE';
  } else if (status === 'Overdue') {
    color = '#EF4444';
    bgColor = '#FEE2E2';
  }
  return <View style={[styles.badge, {
    backgroundColor: bgColor
  }]}>
      <Text style={[styles.badgeText, {
      color
    }]}>{status || 'Unknown'}</Text>
    </View>;
};
const FlippableCard = ({
  order,
  isSelected,
  toggleSelect,
  onOpenInvoice
}) => {
  const {
    t,
    tDynamic
  } = useLanguage();
  const [flipped, setFlipped] = useState(false);
  const flipAnim = useSharedValue(0);
  const flipCard = () => {
    setFlipped(!flipped);
    flipAnim.value = withTiming(flipped ? 0 : 1, {
      duration: 400
    });
  };
  const frontStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(flipAnim.value, [0, 1], [0, 180]);
    return {
      transform: [{
        rotateY: `${rotateY}deg`
      }],
      backfaceVisibility: 'hidden'
    };
  });
  const backStyle = useAnimatedStyle(() => {



    const rotateY = interpolate(flipAnim.value, [0, 1], [180, 360]);
    return {
      transform: [{
        rotateY: `${rotateY}deg`
      }],
      backfaceVisibility: 'hidden',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0
    };
  });
  const receiptUrl = order.PaymentScreenshot || order.PaymentProofLink;
  return <View style={styles.cardContainer}>
      <Animated.View style={[styles.card, frontStyle]}>
        <View style={styles.cardHeader}>
          <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          flex: 1,
          paddingRight: 8
        }}>
            <TouchableOpacity onPress={toggleSelect} style={{
            marginRight: 8,
            padding: 4
          }}>
              {isSelected ? <CheckSquare size={20} color="#10B981" /> : <Square size={20} color="#CBD5E1" />}
            </TouchableOpacity>
            <View style={{
            flex: 1
          }}>
              <Text style={styles.ordId} numberOfLines={1}>{order.OrdID}</Text>
              <Text style={styles.dateText}>{order.OrderTimestamp ? new Date(order.OrderTimestamp).toLocaleDateString() : 'N/A'}</Text>
            </View>
          </View>
          <StatusBadge status={order.ApprovalStatus} />
        </View>

        <View style={styles.cardBody}>
          <View style={styles.row}>
            <Text style={styles.label}>{t('Customer:')}</Text>
            <Text style={styles.value}>{tDynamic(order.Company || order.Name)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t('Amount:')}</Text>
            <Text style={styles.valueBold}>₹{order.FinalInvoicedAmount ? Number(order.FinalInvoicedAmount).toLocaleString() : Number(order.EstimateAmt || 0).toLocaleString()}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t('Payment Info:')}</Text>
            <View style={{
            flex: 1
          }}>
              {order.TransactionID || order.PaymentReference ? <Text style={styles.value}>Txn: {order.TransactionID || order.PaymentReference}</Text> : <Text style={[styles.value, {
              color: '#94A3B8'
            }]}>{t('Pending')}</Text>}
            </View>
          </View>
        </View>

        <View style={styles.cardFooter}>
          {order.InvoicePdf || order.InvoicePdfLink ? <TouchableOpacity style={styles.invoiceBtn} onPress={() => onOpenInvoice(order.InvoicePdf || order.InvoicePdfLink)}>
              <FileText size={14} color="#1A1A1A" />
              <Text style={styles.invoiceText}>{t('View Invoice')}</Text>
            </TouchableOpacity> : <View style={[styles.invoiceBtn, {
          backgroundColor: '#F8FAFC',
          borderColor: '#E2E8F0',
          borderWidth: 1
        }]}>
              <FileText size={14} color="#9CA3AF" />
              <Text style={[styles.invoiceText, {
            color: '#9CA3AF'
          }]}>{t('No Invoice Yet')}</Text>
            </View>}

          {receiptUrl && <TouchableOpacity style={styles.receiptBtn} onPress={flipCard}>
              <FileText size={12} color="#16A34A" />
              <Text style={styles.receiptText}>{t('Receipt')}</Text>
            </TouchableOpacity>}
        </View>
      </Animated.View>

      <Animated.View style={[styles.card, styles.cardBack, backStyle]} pointerEvents={flipped ? 'auto' : 'none'}>
        <View style={styles.cardBackHeader}>
          <Text style={styles.cardBackTitle}>{t('Payment Receipt')}</Text>
          <TouchableOpacity onPress={flipCard} style={styles.closeFlipBtn}>
            <X size={20} color="#64748B" />
          </TouchableOpacity>
        </View>
        {receiptUrl ? <Image source={{
        uri: receiptUrl
      }} style={styles.receiptImage} resizeMode="contain" /> : <View style={styles.noReceiptContainer}>
            <Text style={styles.noReceiptText}>{t('No receipt available')}</Text>
          </View>}
      </Animated.View>
    </View>;
};
export default function AccountantAllInvoices() {
  const {
    t
  } = useLanguage();
  const {
    user
  } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const [isGeneratingZip, setIsGeneratingZip] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  useEffect(() => {
    fetchData();
  }, [user]);
  const fetchData = async () => {
    try {
      setLoading(true);
      const [data, accountsData] = await Promise.all([sheetsService.getOrders(user), sheetsService.getAllAccounts(user).catch(() => [])]);
      const invoicedOrders = data.filter((o) => o.ApprovalStatus === 'Payment Pending' || o.ApprovalStatus === 'Payment Sent' || o.ApprovalStatus === 'Closed' || o.ApprovalStatus === 'Overdue');
      const ordersWithAccounts = invoicedOrders.map((o) => {
        const acc = accountsData.find((a) => a.OrdID === o.OrdID) || {};
        return {
          ...o,
          ...acc
        };
      });
      ordersWithAccounts.sort((a, b) => new Date(b.OrderTimestamp) - new Date(a.OrderTimestamp));
      setOrders(ordersWithAccounts);
      setCurrentPage(1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const filteredOrders = orders.filter((o) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = o.OrdID?.toLowerCase().includes(term) || o.Company?.toLowerCase().includes(term) || o.Product?.toLowerCase().includes(term) || o.TransactionID && o.TransactionID.toLowerCase().includes(term);
    let matchesDate = true;
    if (dateRange.startDate && dateRange.endDate) {
      const orderDate = new Date(o.OrderTimestamp);
      const start = new Date(dateRange.startDate);
      const end = new Date(dateRange.endDate);
      end.setHours(23, 59, 59, 999);
      matchesDate = orderDate >= start && orderDate <= end;
    }
    return matchesSearch && matchesDate;
  });
  const toggleSelect = (ordId) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(ordId)) {
      newSelected.delete(ordId);
    } else {
      newSelected.add(ordId);
    }
    setSelectedOrders(newSelected);
  };
  const toggleSelectAll = () => {
    if (selectedOrders.size === filteredOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(filteredOrders.map((o) => o.OrdID)));
    }
  };
  const handleOpenInvoice = (url) => {



    if (url) {
      Linking.openURL(url).catch((err) => {
        Alert.alert('Error', 'Cannot open the invoice URL');
        console.error(err);
      });
    }
  };
  const generateBulkZip = async () => {



    if (selectedOrders.size === 0) return;
    setIsGeneratingZip(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder("Invoices");
      let csvContent = "OrderID,Date,Customer,Amount,Status,TransactionID\n";
      const selectedArr = filteredOrders.filter((o) => selectedOrders.has(o.OrdID));
      for (const order of selectedArr) {
        // Add to CSV
        const amt = order.FinalInvoicedAmount || order.EstimateAmt || 0;
        csvContent += `${order.OrdID},${new Date(order.OrderTimestamp).toLocaleDateString()},"${order.Company || order.Name}",${amt},${order.ApprovalStatus},${order.TransactionID || ''}\n`;

        // Add PDF if exists
        const pdfUrl = order.InvoicePdf || order.InvoicePdfLink;
        if (pdfUrl) {
          try {
            // Check if it's base64 or a remote URL
            if (pdfUrl.startsWith('data:application/pdf;base64,')) {
              const base64Data = pdfUrl.split(',')[1];
              folder.file(`${order.OrdID}_Invoice.pdf`, base64Data, {
                base64: true
              });
            } else {
              // Remote URL fetch - handle safely
              // In production we would fetch the remote PDF as blob and add it to zip
              // folder.file(`${order.OrdID}_Invoice.pdf`, blob);
              // For demonstration, we just write a text file with the link since fetching might run into CORS
              folder.file(`${order.OrdID}_Invoice_Link.txt`, `Invoice URL: ${pdfUrl}`);
            }
          } catch (e) {
            console.error(`Failed to process PDF for ${order.OrdID}`, e);
          }
        }
      }
      folder.file("Ledger.csv", csvContent);
      const base64Zip = await zip.generateAsync({
        type: "base64"
      });
      const fileUri = `${FileSystem.documentDirectory}Invoices_Bulk_${Date.now()}.zip`;
      await FileSystem.writeAsStringAsync(fileUri, base64Zip, {
        encoding: FileSystem.EncodingType.Base64
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "application/zip",
          dialogTitle: "Download Invoices ZIP"
        });
      } else {
        Alert.alert("Success", "ZIP file created but sharing is not available on this device.");
      }
    } catch (error) {
      console.error("ZIP Generation Error", error);
      Alert.alert("Error", "Failed to generate bulk ZIP download.");
    } finally {
      setIsGeneratingZip(false);
    }
  };
  if (loading) {
    return <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1A1A1A" />
      </View>;
  }
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const isAllSelected = selectedOrders.size > 0 && selectedOrders.size === filteredOrders.length;
  return <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('All Invoices')}</Text>
        <Text style={styles.subtitle}>{t('View and search all invoices generated across the system.')}</Text>
      </View>

      <View style={styles.filtersContainer}>
        <SearchFilter value={searchTerm} onChange={setSearchTerm} placeholder="Search by Order ID or Trans ID..." />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <DateRangeFilter startDate={dateRange.startDate} endDate={dateRange.endDate} onDateChange={setDateRange} onClear={() => setDateRange({
          startDate: '',
          endDate: ''
        })} />
          <ExportButton data={filteredOrders} filename="All_Invoices" sheetName="Invoices" />
        </ScrollView>
      </View>

      <View style={styles.actionsBar}>
        <TouchableOpacity onPress={toggleSelectAll} style={styles.selectAllBtn}>
          {isAllSelected ? <CheckSquare size={20} color="#10B981" /> : <Square size={20} color="#64748B" />}
          <Text style={styles.selectAllText}>{isAllSelected ? 'Deselect All' : 'Select All'}</Text>
        </TouchableOpacity>
        
        {selectedOrders.size > 0 && <TouchableOpacity style={styles.bulkDownloadBtn} onPress={generateBulkZip} disabled={isGeneratingZip}>
            {isGeneratingZip ? <ActivityIndicator size="small" color="#FFF" /> : <>
                <Download size={16} color="#FFF" />
                <Text style={styles.bulkDownloadText}>Download ({selectedOrders.size}) ZIP</Text>
              </>}
          </TouchableOpacity>}
      </View>

      <FlatList data={paginatedOrders} keyExtractor={(order) => order.OrdID} style={styles.listContainer} initialNumToRender={10} windowSize={5} ListEmptyComponent={<View style={styles.emptyState}>
            <FileText size={48} color="#CBD5E1" />
            <Text style={styles.emptyText}>{t('No Invoices Yet')}</Text>
          </View>} renderItem={({
      item: order
    }) => <FlippableCard order={order} isSelected={selectedOrders.has(order.OrdID)} toggleSelect={() => toggleSelect(order.OrdID)} onOpenInvoice={handleOpenInvoice} />} />

      {totalPages > 1 && <View style={{
      padding: 16
    }}>
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </View>}
    </View>;
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC'
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  header: {
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4
  },
  subtitle: {
    color: '#64748B',
    fontSize: 14
  },
  filtersContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: '#F8FAFC',
    gap: 12
  },
  filterScroll: {
    gap: 12,
    paddingBottom: 4
  },
  actionsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  selectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  selectAllText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B'
  },
  bulkDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8
  },
  bulkDownloadText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 16
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 16
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '500'
  },
  cardContainer: {
    marginBottom: 16,
    minHeight: 180
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 2
        },
        shadowOpacity: 0.05,
        shadowRadius: 4
      },
      android: {
        elevation: 2
      },
      web: {
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
      }
    })
  },
  cardBack: {
    backgroundColor: '#F8FAFC'
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16
  },
  ordId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A'
  },
  dateText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600'
  },
  cardBody: {
    gap: 12,
    marginBottom: 16
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  label: {
    width: 100,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500'
  },
  value: {
    flex: 1,
    fontSize: 14,
    color: '#1A1A1A'
  },
  valueBold: {
    flex: 1,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1A1A1A'
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 16
  },
  invoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6
  },
  invoiceText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A'
  },
  receiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6
  },
  receiptText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#16A34A'
  },
  cardBackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  cardBackTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1A1A'
  },
  closeFlipBtn: {
    padding: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 20
  },
  receiptImage: {
    width: '100%',
    height: 120,
    borderRadius: 8
  },
  noReceiptContainer: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8
  },
  noReceiptText: {
    color: '#64748B',
    fontSize: 14
  }
});