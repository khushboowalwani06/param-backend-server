import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, Platform } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { sheetsService } from '../../services/sheetsService';
import { useRealtime } from '../../hooks/useRealtime';
import { CardSkeleton } from '../../components/Skeleton';
import { ExportButton } from '../../components/ExportButton';
import { Picker } from '@react-native-picker/picker';
import { Calendar } from 'lucide-react-native';

export const ChallanTracking = () => {
  const { user } = useAuth();
  const { success, error } = useToast();
  
  const [challans, setChallans] = useState([]);
  const [dealers, setDealers] = useState([]);
  const [loading, setLoading] = useState(true);
  const loadingRef = useRef(false);

  const [formData, setFormData] = useState({
    UserID: '',
    Date: new Date().toISOString().split('T')[0],
    Depot: 'Main Godown',
    Grade: 'OPC',
    QuantityDeposited: ''
  });
  const [refreshKey, setRefreshKey] = useState(0);

  useRealtime(['challans'], () => setRefreshKey(k => k + 1));

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const allUsers = await sheetsService.getAllUsers(user);
      setDealers(allUsers.filter(u => u.Role === 'customer' || u.Role === 'dealer'));

      const data = await sheetsService._fetch('/challans');
      data.sort((a, b) => new Date(b.Date) - new Date(a.Date));
      setChallans(data);
    } catch (err) {
      error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user, refreshKey]);

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (loadingRef.current) return;
    
    if (!formData.UserID) return Alert.alert('Error', 'Please select a dealer.');
    if (!formData.QuantityDeposited || Number(formData.QuantityDeposited) <= 0) return Alert.alert('Error', 'Quantity must be greater than 0.');
    
    loadingRef.current = true;
    try {
      await sheetsService._fetch('/challans', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      
      success('Challan logged successfully');
      setFormData(prev => ({ ...prev, QuantityDeposited: '' }));
      await fetchData();
    } catch (err) {
      error(err.message);
    } finally {
      loadingRef.current = false;
    }
  };

  if (loading) return <View style={{padding: 16}}><CardSkeleton /><CardSkeleton /></View>;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.headerTitle} numberOfLines={2} adjustsFontSizeToFit>Challan & Deposit Tracking</Text>
          </View>
          <ExportButton data={challans} filename="ChallanLog" />
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Log New Challan</Text>
          
          <View style={styles.formRow}>
            <View style={styles.field}>
              <Text style={styles.label}>Dealer / Party</Text>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={formData.UserID}
                  onValueChange={(val) => handleChange('UserID', val)}
                  style={styles.picker}
                >
                  <Picker.Item label="Select Dealer" value="" />
                  {dealers.map(d => (
                    <Picker.Item key={d.UserID} label={`${d.Name} (${d.Company})`} value={d.UserID} />
                  ))}
                </Picker>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Date</Text>
              <View style={styles.dateInputWrapper}>
                <Calendar size={16} color="#8E8E93" style={styles.dateIcon} />
                <TextInput
                  style={styles.dateInput}
                  value={formData.Date}
                  onChangeText={val => handleChange('Date', val)}
                  placeholder="YYYY-MM-DD"
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Depot</Text>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={formData.Depot}
                  onValueChange={(val) => handleChange('Depot', val)}
                  style={styles.picker}
                >
                  <Picker.Item label="Main Godown" value="Main Godown" />
                  <Picker.Item label="Kathwada" value="Kathwada" />
                  <Picker.Item label="Bhakrol" value="Bhakrol" />
                  <Picker.Item label="Aslali" value="Aslali" />
                </Picker>
              </View>
            </View>

            <View style={styles.fieldHalf}>
              <Text style={styles.label}>Grade</Text>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={formData.Grade}
                  onValueChange={(val) => handleChange('Grade', val)}
                  style={styles.picker}
                >
                  <Picker.Item label="OPC" value="OPC" />
                  <Picker.Item label="BPC" value="BPC" />
                  <Picker.Item label="Plus" value="Plus" />
                </Picker>
              </View>
            </View>

            <View style={styles.fieldHalf}>
              <Text style={styles.label}>Qty Deposited</Text>
              <TextInput
                style={styles.input}
                value={formData.QuantityDeposited}
                onChangeText={val => handleChange('QuantityDeposited', val)}
                keyboardType="numeric"
                placeholder="e.g. 100"
              />
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
              <Text style={styles.submitText}>Log Challan</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Challan Log</Text>
          <View style={{ gap: 12 }}>
            {challans.map(c => {
              const d = dealers.find(x => x.UserID === c.UserID);
              return (
                <View key={c.ChallanID} style={styles.challanCard}>
                  <View style={styles.challanCardHeader}>
                    <Text style={styles.challanId}>{c.ChallanID}</Text>
                    <Text style={styles.challanDate}>{new Date(c.Date).toLocaleDateString()}</Text>
                  </View>
                  <Text style={styles.challanDealer} numberOfLines={1}>{d ? `${d.Name} (${d.Company})` : c.UserID}</Text>
                  <View style={styles.challanCardDetails}>
                    <View style={styles.challanDetailCol}>
                      <Text style={styles.challanDetailLabel}>Depot</Text>
                      <Text style={styles.challanDetailValue}>{c.Depot}</Text>
                    </View>
                    <View style={styles.challanDetailCol}>
                      <Text style={styles.challanDetailLabel}>Grade</Text>
                      <Text style={styles.challanDetailValue}>{c.Grade}</Text>
                    </View>
                    <View style={styles.challanDetailCol}>
                      <Text style={styles.challanDetailLabel}>Quantity</Text>
                      <Text style={styles.challanDetailValue}>{c.QuantityDeposited}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
            {challans.length === 0 && (
              <View style={{padding: 20, alignItems: 'center'}}>
                <Text style={{color: '#8E8E93'}}>No challans found</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E5EA' },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A1A' },
  
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#E5E5EA' },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 16 },
  
  formRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  field: { width: '100%' },
  fieldHalf: { width: '47%' },
  label: { fontSize: 14, fontWeight: '600', color: '#1A1A1A', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 8, padding: 12, fontSize: 14, backgroundColor: '#F8F9FA' },
  
  dateInputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 8, backgroundColor: '#F8F9FA', paddingHorizontal: 12 },
  dateIcon: { marginRight: 8 },
  dateInput: { flex: 1, paddingVertical: 12, fontSize: 14 },
  
  pickerWrapper: { borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 8, backgroundColor: '#F8F9FA', overflow: 'hidden' },
  picker: { height: Platform.OS === 'ios' ? 120 : 50 },
  
  submitBtn: { width: '100%', backgroundColor: '#1A1A1A', paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  submitText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  
  challanCard: { backgroundColor: '#F8F9FA', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E5EA' },
  challanCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  challanId: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  challanDate: { fontSize: 12, color: '#8E8E93', fontWeight: '500' },
  challanDealer: { fontSize: 14, color: '#1A1A1A', marginBottom: 12, fontWeight: '500' },
  challanCardDetails: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#E5E5EA', paddingTop: 12 },
  challanDetailCol: { flex: 1 },
  challanDetailLabel: { fontSize: 10, color: '#8E8E93', fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  challanDetailValue: { fontSize: 14, color: '#1A1A1A', fontWeight: '700' }
});
