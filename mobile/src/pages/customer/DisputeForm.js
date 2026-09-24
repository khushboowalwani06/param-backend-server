import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Image, Modal, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useRoute } from '@react-navigation/native';
import { AlertCircle, X, ImageIcon, UploadCloud, Calendar as CalendarIcon } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../../context/AuthContext';
import { sheetsService } from '../../services/sheetsService';
import { useRealtime } from '../../hooks/useRealtime';
import { StatusBadge } from '../../components/StatusBadge';

export default function DisputeForm() {
  const { user } = useAuth();
  const route = useRoute();
  const initialOrderId = route.params?.order || '';
  
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('new'); // 'new' | 'history'
  
  const [formData, setFormData] = useState({
    OrdID: initialOrderId,
    IssueType: 'Missing Bags',
    DamagedQuantity: '',
    OtherIssueDescription: '',
    PhotoURL: ''
  });

  const [pastDisputes, setPastDisputes] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [dateRange, setDateRange] = useState({ start: null, end: null });
  const [showDatePicker, setShowDatePicker] = useState({ visible: false, type: 'start' });
  
  useRealtime(['orders', 'issues'], () => setRefreshKey(k => k + 1));

  useEffect(() => {
    const loadOrders = async () => {
      try {
        const data = await sheetsService.getOrders(user);
        setOrders(data);
      } catch (err) {
        console.error(err);
      }
    };
    loadOrders();
  }, [user, refreshKey]);

  const loadHistory = async () => {
    try {
      setHistoryLoading(true);
      const data = await sheetsService.getDisputes();
      data.sort((a, b) => new Date(b.CreatedAt || 0) - new Date(a.CreatedAt || 0));
      setPastDisputes(data);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to load past reports');
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab, refreshKey]);

  const handleFileUpload = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        const mimeType = file.uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
        setFormData({ ...formData, PhotoURL: `data:${mimeType};base64,${file.base64}` });
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleSubmit = async () => {
    try {
      if (!formData.OrdID) throw new Error('Please select an order for this dispute.');
      let finalIssueType = formData.IssueType;
      if (formData.IssueType === 'Other') {
        if (!formData.OtherIssueDescription.trim()) {
          throw new Error('Please describe the issue when "Other" is selected.');
        }
        finalIssueType = `Other - ${formData.OtherIssueDescription}`;
      }

      if (['Missing Bags', 'Torn Bags', 'Water-Damaged Bags'].includes(formData.IssueType)) {
        if (!formData.DamagedQuantity || Number(formData.DamagedQuantity) <= 0) {
          throw new Error('Please enter a valid quantity for this issue type.');
        }
      }
      if (!formData.PhotoURL) {
        throw new Error('Please upload photo evidence.');
      }
      
      setLoading(true);
      await sheetsService.reportDispute({
        ...formData,
        IssueType: finalIssueType,
        UserID: user.UserID
      });
      
      Alert.alert('Success', 'Dispute reported successfully.');
      setFormData({ OrdID: '', IssueType: 'Missing Bags', DamagedQuantity: '', OtherIssueDescription: '', PhotoURL: '' });
      setActiveTab('history'); // auto switch to history to show it
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to report dispute');
    } finally {
      setLoading(false);
    }
  };

  const deliveredOrders = orders.filter(o => ['Delivered', 'Closed'].includes(o.ApprovalStatus));

  const filteredDisputes = pastDisputes.filter(d => {
    const dDate = new Date(d.CreatedAt || Date.now());
    if (dateRange.start && dDate < dateRange.start) return false;
    if (dateRange.end) {
      const endOfDay = new Date(dateRange.end);
      endOfDay.setHours(23, 59, 59, 999);
      if (dDate > endOfDay) return false;
    }
    return true;
  });

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Report & Track Issues</Text>
          <Text style={styles.headerSub}>File disputes for orders and track their resolution status.</Text>
        </View>

        <View style={styles.tabsContainer}>
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'new' && styles.tabBtnActive]} 
            onPress={() => setActiveTab('new')}
          >
            <Text style={[styles.tabBtnText, activeTab === 'new' && styles.tabBtnTextActive]}>File New Issue</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'history' && styles.tabBtnActive]} 
            onPress={() => setActiveTab('history')}
          >
            <Text style={[styles.tabBtnText, activeTab === 'history' && styles.tabBtnTextActive]}>My Past Reports</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'new' && (
          <View style={styles.card}>
            
            <Text style={styles.inputLabel}>Select Order</Text>
            <View style={styles.pickerContainer}>
              <Picker selectedValue={formData.OrdID} onValueChange={(val) => setFormData({...formData, OrdID: val})}>
                <Picker.Item label="Select an order..." value="" />
                {deliveredOrders.map(o => (
                  <Picker.Item key={o.OrdID} label={`${o.OrdID} - ${o.Product}`} value={o.OrdID} />
                ))}
              </Picker>
            </View>

            <Text style={styles.inputLabel}>Issue Type</Text>
            <View style={styles.pickerContainer}>
              <Picker selectedValue={formData.IssueType} onValueChange={(val) => setFormData({...formData, IssueType: val})}>
                <Picker.Item label="Missing Bags" value="Missing Bags" />
                <Picker.Item label="Torn Bags" value="Torn Bags" />
                <Picker.Item label="Water-Damaged Bags" value="Water-Damaged Bags" />
                <Picker.Item label="Quality Issue" value="Quality Issue" />
                <Picker.Item label="Other" value="Other" />
              </Picker>
            </View>

            {formData.IssueType === 'Other' && (
              <>
                <Text style={styles.inputLabel}>Describe the Issue</Text>
                <TextInput 
                  style={[styles.input, { height: 80, textAlignVertical: 'top' }]} 
                  value={formData.OtherIssueDescription} 
                  onChangeText={(val) => setFormData({...formData, OtherIssueDescription: val})} 
                  placeholder="Explain the problem in detail..."
                  multiline
                />
              </>
            )}

            <Text style={styles.inputLabel}>Affected Quantity (Bags/Units)</Text>
            <TextInput 
              style={styles.input} 
              value={formData.DamagedQuantity} 
              onChangeText={(val) => setFormData({...formData, DamagedQuantity: val})} 
              keyboardType="numeric"
            />

            <Text style={styles.inputLabel}>Photo Evidence</Text>
            {formData.PhotoURL ? (
              <View style={styles.photoPreviewRow}>
                <Image source={{ uri: formData.PhotoURL }} style={styles.photoPreview} />
                <TouchableOpacity style={styles.removePhotoBtn} onPress={() => setFormData({...formData, PhotoURL: ''})}>
                  <Text style={styles.removePhotoText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.uploadBox} onPress={handleFileUpload}>
                <UploadCloud size={32} color="#94A3B8" />
                <Text style={styles.uploadText}>Tap to pick image</Text>
                <Text style={styles.uploadSub}>JPEG, PNG, JPG (Max 5MB)</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Submit Report</Text>}
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'history' && (
          <View style={styles.historyContainer}>
            
            <View style={styles.dateFilterContainer}>
              <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDatePicker({ visible: true, type: 'start' })}>
                <CalendarIcon size={16} color="#8E8E93" />
                <Text style={styles.dateBtnText}>{dateRange.start ? dateRange.start.toLocaleDateString() : 'Start Date'}</Text>
              </TouchableOpacity>
              <Text style={styles.dateTo}>to</Text>
              <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDatePicker({ visible: true, type: 'end' })}>
                <CalendarIcon size={16} color="#8E8E93" />
                <Text style={styles.dateBtnText}>{dateRange.end ? dateRange.end.toLocaleDateString() : 'End Date'}</Text>
              </TouchableOpacity>
              {(dateRange.start || dateRange.end) && (
                <TouchableOpacity onPress={() => setDateRange({ start: null, end: null })}>
                  <X size={20} color="#DC2626" />
                </TouchableOpacity>
              )}
            </View>

            {historyLoading ? (
              <ActivityIndicator size="large" color="#1A1A1A" style={{ marginTop: 40 }} />
            ) : filteredDisputes.length === 0 ? (
              <Text style={styles.emptyText}>No reports found for this period.</Text>
            ) : (
              filteredDisputes.map(d => (
                <View key={d.DisputeID} style={styles.historyCard}>
                  <View style={styles.historyHeader}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.historyId} numberOfLines={1}>{d.DisputeID}</Text>
                      <Text style={styles.historyDate}>{new Date(d.CreatedAt || Date.now()).toLocaleDateString()}</Text>
                    </View>
                    <StatusBadge status={d.Status} />
                  </View>
                  
                  <View style={styles.historyDetailsRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyOrdId}>{d.OrdID}</Text>
                      <View style={styles.issueTypeRow}>
                        <AlertCircle size={14} color="#DC2626" />
                        <Text style={styles.issueTypeText}>{d.IssueType} ({d.DamagedQuantity} units)</Text>
                      </View>
                    </View>
                  </View>

                  <TouchableOpacity style={styles.viewDetailsBtn} onPress={() => setSelectedReport(d)}>
                    <Text style={styles.viewDetailsText}>View Details & Photo</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Details Modal */}
      <Modal visible={!!selectedReport} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report: {selectedReport?.DisputeID}</Text>
              <TouchableOpacity onPress={() => setSelectedReport(null)}>
                <X size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              <View style={styles.modalGridRow}>
                <View style={styles.modalGridItem}>
                  <Text style={styles.modalLabel}>Order ID</Text>
                  <Text style={styles.modalVal}>{selectedReport?.OrdID}</Text>
                </View>
                <View style={styles.modalGridItem}>
                  <Text style={styles.modalLabel}>Date Reported</Text>
                  <Text style={styles.modalVal}>{new Date(selectedReport?.CreatedAt || Date.now()).toLocaleDateString()}</Text>
                </View>
              </View>
              
              <View style={styles.modalGridRow}>
                <View style={styles.modalGridItem}>
                  <Text style={styles.modalLabel}>Issue Type</Text>
                  <Text style={[styles.modalVal, { color: '#DC2626' }]}>{selectedReport?.IssueType}</Text>
                </View>
                <View style={styles.modalGridItem}>
                  <Text style={styles.modalLabel}>Quantity</Text>
                  <Text style={styles.modalVal}>{selectedReport?.DamagedQuantity} units</Text>
                </View>
              </View>
              
              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>Admin Notes</Text>
                <View style={styles.notesBox}>
                  {selectedReport?.AdminNotes ? (
                    <Text style={styles.notesText}>{selectedReport.AdminNotes}</Text>
                  ) : (
                    <Text style={styles.notesEmpty}>No notes yet.</Text>
                  )}
                </View>
              </View>

              {selectedReport?.PhotoURL && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Evidence</Text>
                  <Image source={{ uri: selectedReport.PhotoURL }} style={styles.modalImage} resizeMode="contain" />
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
      
      {showDatePicker.visible && (
        <DateTimePicker
          value={dateRange[showDatePicker.type] || new Date()}
          mode="date"
          display="default"
          onValueChange={(selectedDate) => {
            setShowDatePicker({ visible: false, type: 'start' });
            if (selectedDate) {
              setDateRange(prev => ({ ...prev, [showDatePicker.type]: selectedDate }));
            }
          }}
          onDismiss={() => setShowDatePicker({ visible: false, type: 'start' })}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  header: { marginBottom: 20 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  headerSub: { fontSize: 14, color: '#8E8E93' },

  tabsContainer: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', marginBottom: 24 },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: '#0056D2' },
  tabBtnText: { fontSize: 14, fontWeight: '600', color: '#8E8E93' },
  tabBtnTextActive: { color: '#0056D2' },

  card: { backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#1A1A1A', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 12, fontSize: 16, color: '#1A1A1A', marginBottom: 20 },
  pickerContainer: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, marginBottom: 20, backgroundColor: '#FFF' },
  
  uploadBox: { borderWidth: 2, borderColor: '#E2E8F0', borderStyle: 'dashed', borderRadius: 8, padding: 24, alignItems: 'center', marginBottom: 24 },
  uploadText: { fontSize: 14, fontWeight: '600', color: '#475569', marginTop: 8 },
  uploadSub: { fontSize: 12, color: '#94A3B8', marginTop: 4 },

  photoPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24 },
  photoPreview: { width: 100, height: 100, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  removePhotoBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6, backgroundColor: '#F2F2F7' },
  removePhotoText: { color: '#1A1A1A', fontWeight: '600', fontSize: 12 },

  submitBtn: { backgroundColor: '#1A1A1A', padding: 16, borderRadius: 8, alignItems: 'center' },
  submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  historyContainer: { gap: 16 },
  dateFilterContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, paddingHorizontal: 4 },
  dateBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', padding: 12, borderRadius: 8 },
  dateBtnText: { fontSize: 14, color: '#1A1A1A', fontWeight: '500' },
  dateTo: { color: '#8E8E93', fontSize: 14 },
  
  emptyText: { textAlign: 'center', color: '#8E8E93', fontSize: 16, marginTop: 40 },
  
  historyCard: { backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', padding: 16 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F2F2F7' },
  historyId: { fontSize: 16, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  historyDate: { fontSize: 12, color: '#8E8E93' },
  
  historyDetailsRow: { marginBottom: 16 },
  historyOrdId: { fontSize: 14, fontWeight: '600', color: '#1A1A1A', marginBottom: 4 },
  issueTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  issueTypeText: { fontSize: 12, color: '#DC2626', fontWeight: '500' },
  
  viewDetailsBtn: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 6, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  viewDetailsText: { fontSize: 12, fontWeight: '600', color: '#1A1A1A' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'center', padding: 16 },
  modalContent: { backgroundColor: '#FFF', borderRadius: 12, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  modalBody: { padding: 16 },
  modalGridRow: { flexDirection: 'row', marginBottom: 16 },
  modalGridItem: { flex: 1 },
  modalLabel: { fontSize: 12, color: '#8E8E93', marginBottom: 4 },
  modalVal: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  modalSection: { marginBottom: 20 },
  notesBox: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 8, minHeight: 60 },
  notesText: { fontSize: 14, color: '#1A1A1A' },
  notesEmpty: { fontSize: 14, color: '#8E8E93', fontStyle: 'italic' },
  modalImage: { width: '100%', height: 200, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' }
});
