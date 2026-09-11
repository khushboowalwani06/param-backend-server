import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, Switch, ActivityIndicator, Platform } from 'react-native';
import { sheetsService } from '../../services/sheetsService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SearchFilter } from '../../components/SearchFilter';
import { useRealtime } from '../../hooks/useRealtime';
import { CardSkeleton } from '../../components/Skeleton';
import { ExportButton } from '../../components/ExportButton';
import { Pagination } from '../../components/Pagination';
import { Picker } from '@react-native-picker/picker';

const isTrue = (val) => val === true || val === 'true';

export const CreditManagement = () => {
  const { user } = useAuth();
  const { success, error } = useToast();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [updatingIds, setUpdatingIds] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  useRealtime(['users'], () => setRefreshKey(k => k + 1));

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const data = await sheetsService.getAllUsers(user);
      setCustomers(data.filter(u => u.Role === 'customer' || u.Role === 'dealer'));
    } catch (err) {
      error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [user, refreshKey]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleUpdate = async (customerId, field, value) => {
    if (field === 'CreditLimit' && Number(value) < 0) {
      Alert.alert('Error', 'Credit limit cannot be negative.');
      loadCustomers();
      return;
    }

    const currentCustomer = customers.find(c => c.UserID === customerId);
    if (currentCustomer && currentCustomer[field] === value) {
      return; // Value hasn't changed, ignore
    }

    if (updatingIds.has(customerId)) return;
    setUpdatingIds(prev => new Set(prev).add(customerId));

    setCustomers(prev => prev.map(c =>
      c.UserID === customerId ? { ...c, [field]: value } : c
    ));

    try {
      await sheetsService.updateCustomerLimits(user, customerId, { [field]: value });
      success(`Successfully updated ${field}`);
      const data = await sheetsService.getAllUsers(user);
      setCustomers(data.filter(u => u.Role === 'customer' || u.Role === 'dealer'));
    } catch (err) {
      error(`Failed to update ${field}`);
      loadCustomers();
    } finally {
      setUpdatingIds(prev => {
        const next = new Set(prev);
        next.delete(customerId);
        return next;
      });
    }
  };

  const handleSweep = async () => {
    try {
      setLoading(true);
      const data = await sheetsService._fetch('/debit-notes/sweep', { method: 'POST' });
      success(`Successfully issued ${data.count} debit notes to overdue accounts.`);
      loadCustomers();
    } catch (err) {
      error(err.message || 'Failed to issue debit notes');
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(c => {
    const term = searchTerm.toLowerCase();
    return (
      c.Name?.toLowerCase().includes(term) ||
      c.Company?.toLowerCase().includes(term) ||
      c.UserID?.toLowerCase().includes(term)
    );
  });

  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const paginatedCustomers = filteredCustomers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (loading) return <View style={{ padding: 16 }}><CardSkeleton /><CardSkeleton /></View>;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Credit & Account Management</Text>
        <View style={styles.actionsRow}>
          <View style={{ flex: 1, minWidth: 200 }}><SearchFilter value={searchTerm} onChange={setSearchTerm} placeholder="Search customers..." /></View>
          <ExportButton data={filteredCustomers} filename="CreditManagement" />
          <TouchableOpacity style={styles.sweepBtn} onPress={handleSweep}>
            <Text style={styles.sweepText}>Issue Overdue Penalties</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        {paginatedCustomers.map(c => {
          const isBlocked = (isTrue(c.BlockedStatus) || Number(c.Bkt21_Above) > 0) && !isTrue(c.ManualUnlock);
          const isUpdating = updatingIds.has(c.UserID);

          return (
            <View key={c.UserID} style={styles.card}>
              {isUpdating && <View style={styles.overlay}><ActivityIndicator color="#0F172A" /></View>}

              <View style={styles.cardHeader}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.custName} numberOfLines={1}>{c.Name}</Text>
                  <Text style={styles.custCompany} numberOfLines={1}>{c.Company} (ID: {c.UserID})</Text>
                </View>
                <View style={[styles.statusBadge, isBlocked ? styles.statusBlocked : styles.statusActive]}>
                  <Text style={[styles.statusText, isBlocked ? styles.statusTextBlocked : styles.statusTextActive]}>
                    {isBlocked ? 'Blocked' : 'Active'}
                  </Text>
                </View>
              </View>

              <View style={styles.grid}>
                <View style={styles.gridItem}>
                  <Text style={styles.label}>Segment</Text>
                  <View style={styles.pickerWrapper}>
                    <Picker
                      selectedValue={c.Segment || 'Trade'}
                      onValueChange={(val) => handleUpdate(c.UserID, 'Segment', val)}
                      enabled={!isUpdating}
                      style={styles.picker}
                    >
                      <Picker.Item label="Trade" value="Trade" />
                      <Picker.Item label="Non-Trade" value="Non-Trade" />
                    </Picker>
                  </View>
                </View>

                <View style={styles.gridItem}>
                  <Text style={styles.label}>Non-Trade Access</Text>
                  <View style={{ height: 40, justifyContent: 'center', alignItems: 'flex-start' }}>
                    <Switch
                      value={isTrue(c.NonTradeActivated)}
                      onValueChange={(val) => handleUpdate(c.UserID, 'NonTradeActivated', val)}
                      disabled={isUpdating}
                      trackColor={{ false: '#E5E5EA', true: '#34C759' }}
                    />
                  </View>
                </View>

                <View style={styles.gridItem}>
                  <Text style={styles.label}>Credit Limit (₹)</Text>
                  <TextInput
                    style={styles.input}
                    defaultValue={String(c.CreditLimit || 0)}
                    onEndEditing={(e) => handleUpdate(c.UserID, 'CreditLimit', e.nativeEvent.text)}
                    keyboardType="numeric"
                    editable={!isUpdating}
                  />
                </View>

                <View style={styles.gridItem}>
                  <Text style={styles.label}>Allowed Days</Text>
                  <TextInput
                    style={styles.input}
                    defaultValue={String(c.AllowedPaymentDays || 21)}
                    onEndEditing={(e) => handleUpdate(c.UserID, 'AllowedPaymentDays', e.nativeEvent.text)}
                    keyboardType="numeric"
                    editable={!isUpdating}
                  />
                </View>

                <View style={styles.gridItem}>
                  <Text style={styles.label}>Outstanding</Text>
                  <Text style={styles.outAmt}>₹ {c.OutstandingAmount || 0}</Text>
                </View>
              </View>

              <View style={styles.actions}>
                {isBlocked ? (
                  <TouchableOpacity style={styles.unlockBtn} onPress={() => handleUpdate(c.UserID, 'ManualUnlock', true)}>
                    <Text style={styles.unlockText}>Unlock Account</Text>
                  </TouchableOpacity>
                ) : isTrue(c.ManualUnlock) ? (
                  <TouchableOpacity style={styles.revokeBtn} onPress={() => handleUpdate(c.UserID, 'ManualUnlock', false)}>
                    <Text style={styles.revokeText}>Revoke Unlock</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          );
        })}

        {filteredCustomers.length === 0 && (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Text style={{ color: '#8E8E93' }}>No customers found.</Text>
          </View>
        )}

        {filteredCustomers.length > 0 && (
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E5EA' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A1A', marginBottom: 16 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' },
  sweepBtn: { backgroundColor: '#DC2626', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  sweepText: { color: '#FFF', fontWeight: '600', fontSize: 14 },

  content: { padding: 16, gap: 16, paddingBottom: 40 },
  card: { backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E5EA', padding: 16, position: 'relative' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.7)', zIndex: 10, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F2F2F7', paddingBottom: 16 },
  custName: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  custCompany: { fontSize: 12, color: '#8E8E93', marginTop: 4 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  statusActive: { backgroundColor: '#DCFCE7' },
  statusBlocked: { backgroundColor: '#FEE2E2' },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  statusTextActive: { color: '#16A34A' },
  statusTextBlocked: { color: '#DC2626' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  gridItem: { width: '45%' },
  label: { fontSize: 12, fontWeight: '600', color: '#8E8E93', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 8, padding: 10, fontSize: 14, backgroundColor: '#F8F9FA' },
  pickerWrapper: { borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 8, backgroundColor: '#F8F9FA', overflow: 'hidden', justifyContent: 'center' },
  picker: { height: Platform.OS === 'ios' ? 150 : 50, color: '#1A1A1A' },
  outAmt: { fontSize: 16, fontWeight: '700', color: '#1A1A1A', marginTop: 8 },

  actions: { marginTop: 16, alignItems: 'flex-end' },
  unlockBtn: { backgroundColor: '#0F172A', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 },
  unlockText: { color: '#FFF', fontWeight: '600', fontSize: 12 },
  revokeBtn: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 },
  revokeText: { color: '#0F172A', fontWeight: '600', fontSize: 12 }
});
