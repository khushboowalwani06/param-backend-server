import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, FlatList, ActivityIndicator, TextInput, Switch } from 'react-native';
import { sheetsService } from '../../services/sheetsService';
import { useAuth } from '../../context/AuthContext';
import AgingPanel from '../../components/AgingPanel';
import { Search, RefreshCw, Download, X } from 'lucide-react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const CustomerCard = React.memo(({ dealer, onUpdate }) => (
  <View style={styles.card}>
    <Text style={styles.customerName}>{dealer.Name}</Text>
    <Text style={styles.companyName}>{dealer.Company}</Text>
    <AgingPanel customer={dealer} onUpdate={onUpdate} />
  </View>
));


export default function CustomerAging() {
  const { user } = useAuth();
  const [dealers, setDealers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSegment, setActiveSegment] = useState('All Segments');
  const [hasOutstanding, setHasOutstanding] = useState(false);

  const loadCustomers = async (isBackground = false, isManualRefresh = false) => {
    try {
      if (isManualRefresh) setIsRefreshing(true);
      else if (!isBackground) setLoading(true);
      
      let data = [];
      if (user?.Role === 'customer') {
        const profile = await sheetsService.getCustomerProfile(user, user.UserID);
        if (profile) data = [profile];
      } else {
        data = await sheetsService.getAllUsers(user);
      }
      
      setDealers(data.filter(u => u.Role === 'customer' || u.Role === 'dealer'));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [user]);

  const filteredDealers = dealers.filter(d => {
    const segment = d.Segment ? d.Segment : (d.Role === 'dealer' || !d.NonTradeActivated ? 'Trade' : 'Non-Trade');
    if (activeSegment !== 'All Segments' && segment !== activeSegment) return false;
    
    const dbOutstanding = parseFloat(d.OutstandingAmount || 0);
    if (hasOutstanding && dbOutstanding <= 0) return false;

    const term = searchTerm.toLowerCase();
    return (
      d.Name?.toLowerCase().includes(term) ||
      d.Company?.toLowerCase().includes(term) ||
      d.UserID?.toLowerCase().includes(term)
    );
  });

  const handleUpdate = useCallback(() => {
    loadCustomers(true);
  }, []);

  const handleExportCSV = async () => {
    try {
      if (filteredDealers.length === 0) {
        alert('No data to export');
        return;
      }
      
      const header = ['ID,Name,Company,Segment,CreditLimit,Outstanding,0-1,2-4,5,6-7,8-15,16-20,21+'];
      const rows = filteredDealers.map(d => {
        return [
          d.UserID, d.Name, d.Company, d.Segment || (d.Role === 'dealer' || !d.NonTradeActivated ? 'Trade' : 'Non-Trade'),
          d.CreditLimit || 0, d.OutstandingAmount || 0,
          d.Bkt0_1 || 0, d.Bkt2_4 || 0, d.Bkt5_5 || 0, d.Bkt6_7 || 0, d.Bkt8_15 || 0, d.Bkt16_20 || 0, d.Bkt21_Above || 0
        ].map(String).map(s => `"${s.replace(/"/g, '""')}"`).join(',');
      });
      
      const csv = [...header, ...rows].join('\n');
      const filename = FileSystem.documentDirectory + 'Customer_Ageing_Report.csv';
      await FileSystem.writeAsStringAsync(filename, csv, { encoding: FileSystem.EncodingType.UTF8 });
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filename, { mimeType: 'text/csv', dialogTitle: 'Export Ageing Report' });
      } else {
        alert('Sharing is not available on this device');
      }
    } catch (e) {
      console.error('Export error:', e);
      alert('Failed to export CSV');
    }
  };

  const renderItem = useCallback(({ item: dealer }) => (
    <CustomerCard dealer={dealer} onUpdate={handleUpdate} />
  ), [handleUpdate]);

  if (loading && !isRefreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1A1A1A" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Customer Ageing & Balances</Text>
        <Text style={styles.subtitle}>Overview of outstanding balances and ageing buckets.</Text>
      </View>

      {user?.Role !== 'customer' && (
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
              placeholder="Search customers or company..."
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholderTextColor="#94A3B8"
            />
            {searchTerm.length > 0 && (
              <TouchableOpacity onPress={() => setSearchTerm('')}>
                <X size={20} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleText}>Has Outstanding</Text>
            <Switch 
              value={hasOutstanding} 
              onValueChange={setHasOutstanding}
              trackColor={{ false: '#E2E8F0', true: '#1A1A1A' }}
              thumbColor="#FFF"
            />
          </View>
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity 
          onPress={() => loadCustomers(false, true)} 
          disabled={isRefreshing}
          style={styles.refreshBtn}
        >
          {isRefreshing ? <ActivityIndicator size="small" color="#1A1A1A" /> : <RefreshCw size={16} color="#1A1A1A" />}
          <Text style={styles.refreshText}>{isRefreshing ? 'Refreshing...' : 'Refresh Data'}</Text>
        </TouchableOpacity>
        
        {user?.Role !== 'customer' && (
          <TouchableOpacity onPress={handleExportCSV} style={styles.exportBtn}>
            <Download size={16} color="#FFF" />
            <Text style={styles.exportText}>Export CSV</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filteredDealers}
        style={styles.list}
        initialNumToRender={5}
        windowSize={5}
        maxToRenderPerBatch={5}
        removeClippedSubviews={true}
        keyExtractor={(dealer, index) => dealer.UserID ? dealer.UserID.toString() : index.toString()}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No customers found.</Text>
          </View>
        }
        renderItem={renderItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F8FAFC',
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
    backgroundColor: '#FFF',
  },
  segmentBtnActive: {
    backgroundColor: '#1A1A1A',
    borderColor: '#1A1A1A',
  },
  segmentText: {
    fontSize: 14,
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
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  refreshBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 10,
    borderRadius: 8,
  },
  refreshText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  exportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    paddingVertical: 10,
    borderRadius: 8,
  },
  exportText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  list: {
    flex: 1,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  customerName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  companyName: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 8,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 16,
  },
});
