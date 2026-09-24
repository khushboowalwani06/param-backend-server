import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, ActivityIndicator, Alert, Modal } from 'react-native';
import { sheetsService } from '../../services/sheetsService';
import { useAuth } from '../../context/AuthContext';
import { useRealtime } from '../../hooks/useRealtime';
import { MapPin, Calendar, CheckSquare, Plus, Save, X } from 'lucide-react-native';
import { CardSkeleton } from '../../components/Skeleton';
import { Picker } from '@react-native-picker/picker';

export default function SalesVisits() {
  const { user } = useAuth();
  const [dealers, setDealers] = useState([]);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [isLoggingModalVisible, setIsLoggingModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDealer, setSelectedDealer] = useState('');
  const [visitDateStr, setVisitDateStr] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useRealtime(['visits'], () => setRefreshKey(k => k + 1));

  useEffect(() => {
    const initData = async () => {
      try {
        const allUsers = await sheetsService.getAllUsers(user);
        const onlyRetailers = allUsers.filter(u => u.Role === 'customer' || u.Role === 'dealer' || u.Role === 'retailer');
        setDealers(onlyRetailers);

        const storedVisits = await sheetsService.getVisits ? await sheetsService.getVisits().catch(() => []) : [];
        setVisits(storedVisits || []);
      } catch (err) {
        console.error('Failed to load retailers or visits.');
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, [user, refreshKey]);

  const todayStr = new Date().toISOString().split('T')[0];
  const visitsToday = visits.filter(v => v.date && v.date.startsWith(todayStr)).length;
  const targetVisits = 5;

  const handleSaveVisit = async () => {
    if (!selectedDealer || !visitDateStr || !remarks.trim()) {
      alert('Please fill in all fields.');
      return;
    }

    const dealerObj = dealers.find(d => d.UserID === selectedDealer);
    const dateStr = visitDateStr;

    const newVisit = {
      id: `VST-${Date.now()}`,
      salesRepId: user.UserID,
      retailerId: selectedDealer,
      retailerName: dealerObj?.Name || dealerObj?.Company || 'Unknown',
      date: dateStr,
      remarks,
      timestamp: new Date().toISOString()
    };

    try {
      setIsSubmitting(true);
      // Wait for addVisit if available, otherwise just mock it until backend is ready
      if (sheetsService.addVisit) {
        const response = await sheetsService.addVisit(newVisit);
        const savedVisit = response.visit || newVisit;
        setVisits([savedVisit, ...visits]);
      } else {
        setVisits([newVisit, ...visits]);
      }
      
      alert('Visit logged successfully!');
      setIsLoggingModalVisible(false);
      setSelectedDealer('');
      setRemarks('');
    } catch (err) {
      alert(err.message || 'Failed to save visit');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, padding: 16 }}>
        <CardSkeleton />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <MapPin size={24} color="#1A1A1A" />
            <Text style={styles.title}>My Retailer Visits</Text>
          </View>
          <Text style={styles.targetText}>
            Daily Target: <Text style={{ color: visitsToday >= targetVisits ? '#10B981' : '#F59E0B', fontWeight: '700' }}>{visitsToday} / {targetVisits}</Text>
          </Text>
        </View>

        <TouchableOpacity style={styles.addBtn} onPress={() => setIsLoggingModalVisible(true)}>
          <Plus size={20} color="#FFF" />
          <Text style={styles.addBtnText}>LOG NEW VISIT</Text>
        </TouchableOpacity>

        {visits.length === 0 ? (
          <View style={styles.emptyState}>
            <Calendar size={48} color="#E5E5EA" />
            <Text style={styles.emptyTitle}>No Visits Logged</Text>
            <Text style={styles.emptySub}>Start logging your field visits to track your daily progress.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {visits.sort((a, b) => new Date(b.date) - new Date(a.date)).map((visit, idx) => {
              const retailerId = visit.retailerId || visit.retailer_id;
              const matchedDealer = dealers.find(d => d.UserID === retailerId);
              const displayName = visit.retailerName || matchedDealer?.Name || matchedDealer?.Company || 'Unknown Retailer';
              
              return (
                <View key={visit.id || idx} style={styles.visitCard}>
                  <View style={styles.visitHeader}>
                    <Text style={styles.visitDealer} numberOfLines={1}>{displayName}</Text>
                    <View style={styles.visitDateBadge}>
                      <Text style={styles.visitDateText}>{new Date(visit.date).toLocaleDateString()}</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 8, marginTop: -4 }}>ID: {retailerId}</Text>
                  <Text style={styles.visitRemarks}>{visit.remarks}</Text>
                </View>
              );
            })}
          </View>
        )}

      </ScrollView>

      {/* Log Visit Modal */}
      <Modal visible={isLoggingModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Log Visit</Text>
              <TouchableOpacity onPress={() => setIsLoggingModalVisible(false)}>
                <X size={24} color="#1A1A1A" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Retailer / Dealer</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedDealer}
                onValueChange={(val) => setSelectedDealer(val)}
              >
                <Picker.Item label="Select a retailer..." value="" />
                {dealers.map(d => (
                  <Picker.Item key={d.UserID} label={`${d.Company || d.Name} (${d.UserID})`} value={d.UserID} />
                ))}
              </Picker>
            </View>

            <Text style={styles.label}>Visit Date (YYYY-MM-DD)</Text>
            <View style={styles.datePickerBtn}>
              <TextInput
                style={{ flex: 1, fontSize: 16, color: '#1A1A1A' }}
                value={visitDateStr}
                onChangeText={setVisitDateStr}
                placeholder="YYYY-MM-DD"
              />
              <Calendar size={18} color="#64748B" />
            </View>

            <Text style={styles.label}>Remarks / Summary</Text>
            <TextInput
              style={styles.remarksInput}
              placeholder="Discussed new credit limit, took order for 50 tons, etc..."
              value={remarks}
              onChangeText={setRemarks}
              multiline
              numberOfLines={4}
            />

            <TouchableOpacity 
              style={[styles.saveBtn, isSubmitting && { opacity: 0.7 }]} 
              onPress={handleSaveVisit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Save size={18} color="#FFF" />
                  <Text style={styles.saveBtnText}>SAVE VISIT</Text>
                </>
              )}
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
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  targetText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  addBtn: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  addBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F2F2F7',
    borderStyle: 'dashed',
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
  list: {
    gap: 12,
  },
  visitCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F2F2F7',
    padding: 16,
  },
  visitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  visitDealer: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    flex: 1,
  },
  visitDateBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  visitDateText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  visitRemarks: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
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
    minHeight: 500,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 1,
    marginBottom: 8,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    marginBottom: 20,
  },
  datePickerBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  dateText: {
    fontSize: 16,
    color: '#1A1A1A',
  },
  remarksInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#1A1A1A',
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 32,
  },
  saveBtn: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
