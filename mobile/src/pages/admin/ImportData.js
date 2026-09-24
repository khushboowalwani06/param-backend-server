import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Upload, Users, Gift, Package, FileText, ShoppingCart, Database } from 'lucide-react-native';
import { useToast } from '../../context/ToastContext';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';
import { sheetsService } from '../../services/sheetsService';

export const ImportData = () => {
  const { success, error } = useToast();
  const [loadingType, setLoadingType] = useState(null);
  const [loadingMessage, setLoadingMessage] = useState('');

  const importOptions = [
    { id: 'customers', label: 'Import Customers', icon: <Users size={24} color="#3B82F6" />, active: true, desc: 'Import customer details and create accounts.' },
    { id: 'rewards', label: 'Import Customer Rewards', icon: <Gift size={24} color="#3B82F6" />, active: true, desc: 'Assign reward targets based on Cust Num.' },
    { id: 'inventory', label: 'Import Inventory', icon: <Package size={24} color="#9CA3AF" />, active: false, desc: 'Update products and stock levels (Coming Soon)' },
    { id: 'invoices', label: 'Import Invoices', icon: <FileText size={24} color="#9CA3AF" />, active: false, desc: 'Import generated invoices (Coming Soon)' },
    { id: 'orders', label: 'Import Orders', icon: <ShoppingCart size={24} color="#9CA3AF" />, active: false, desc: 'Bulk import previous orders (Coming Soon)' },
  ];

  const processCustomers = async (data) => {
    try {
      const formatted = data.map(row => ({
        custNum: row['Customer ID'],
        password: row['Password'],
        email: row['EmailId'],
        name: row['Name'],
        address: row['Invoice/Primary Address'],
        city: row['City'],
        tehsil: row['Tehsil'],
        district: row['District'],
        state: row['State'],
        zip_code: row['ZIP Code'],
        pan: row['PAN Number'] || row['PAN_Number'],
        gst: row['GST Number'] || row['GSTNumber'],
        phone: row['Mobile No'] ? String(row['Mobile No']) : null,
        segment: row['Trade/Non-Trade']
      })).filter(row => row.custNum && row.name);

      const total = formatted.length;
      let pushedCount = 0;
      const chunkSize = 50;

      for (let i = 0; i < total; i += chunkSize) {
        const chunk = formatted.slice(i, i + chunkSize);
        setLoadingMessage(`Pushing ${pushedCount} of ${total} customers to database...`);

        const result = await sheetsService._fetch('/admin/bulk-import-customers', {
          method: 'POST',
          body: JSON.stringify({ customers: chunk })
        });

        pushedCount += result.count || chunk.length;
        setLoadingMessage(`Pushing ${pushedCount} of ${total} customers to database...`);
      }

      success(`Successfully imported ${pushedCount} customers.`);
    } catch (err) {
      console.error(err);
      error(err.message || 'Error processing customers');
    }
  };

  const processRewards = async (data) => {
    try {
      const rawFormatted = data.map(row => {
         const keys = Object.keys(row);
         const itemKeys = keys.filter(k => k.startsWith('Item'));
         return {
           custNum: row['Cust Num'],
           target1: row["T 1 for Jul'26 to Mar'27"],
           item1: itemKeys[0] ? row[itemKeys[0]] : null,
           target2: row["T 2 for Jul'26 to Mar'27"],
           item2: itemKeys[1] ? row[itemKeys[1]] : null,
         };
      }).filter(r => r.custNum);

      const total = rawFormatted.length;
      let pushedCount = 0;
      const chunkSize = 50;

      for (let i = 0; i < total; i += chunkSize) {
        const chunk = rawFormatted.slice(i, i + chunkSize);
        setLoadingMessage(`Pushing rewards for ${pushedCount} of ${total} customers to database...`);

        const result = await sheetsService._fetch('/admin/bulk-import-rewards', {
          method: 'POST',
          body: JSON.stringify({ rewards: chunk })
        });

        pushedCount += result.count || chunk.length;
        setLoadingMessage(`Pushing rewards for ${pushedCount} of ${total} customers to database...`);
      }

      success(`Successfully imported rewards for ${pushedCount} customers.`);
    } catch (err) {
      console.error(err);
      error(err.message || 'Error processing rewards');
    }
  };

  const handleButtonClick = async (type) => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv'],
        copyToCacheDirectory: true
      });

      if (res.canceled) return;

      const fileUri = res.assets[0].uri;
      setLoadingType(type);
      setLoadingMessage('Reading and parsing Excel file...');
      
      const b64 = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64 });
      const workbook = XLSX.read(b64, { type: 'base64' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (type === 'customers') {
        await processCustomers(jsonData);
      } else if (type === 'rewards') {
        await processRewards(jsonData);
      } else {
        error('This import type is not yet fully implemented.');
      }
    } catch (err) {
      console.error(err);
      error('Failed to parse the Excel file.');
    } finally {
      setLoadingType(null);
      setLoadingMessage('');
    }
  };

  if (loadingType) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingCard}>
          <View style={styles.iconCircle}>
            <Database size={40} color="#3B82F6" />
            <View style={styles.spinnerWrapper}><ActivityIndicator color="#007AFF" /></View>
          </View>
          <Text style={styles.loadingTitle}>Process Ongoing</Text>
          <Text style={styles.loadingMsg}>{loadingMessage}</Text>
          <Text style={styles.loadingWarning}>Please do not close this window until the import is complete.</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Data Import Hub</Text>
        <Text style={styles.headerSub}>Bulk import your data using Excel spreadsheets</Text>
      </View>

      <View style={styles.grid}>
        {importOptions.map(option => (
          <View key={option.id} style={[styles.card, !option.active && {opacity: 0.6}]}>
            <View style={[styles.iconBox, !option.active && {backgroundColor: '#F3F4F6'}]}>
              {option.icon}
            </View>
            <Text style={styles.cardTitle}>{option.label}</Text>
            <Text style={styles.cardDesc}>{option.desc}</Text>
            
            <TouchableOpacity
              style={[styles.btn, !option.active && styles.btnDisabled]}
              disabled={!option.active}
              onPress={() => handleButtonClick(option.id)}
            >
              <Upload size={18} color={option.active ? '#FFF' : '#9CA3AF'} />
              <Text style={[styles.btnText, !option.active && styles.btnTextDisabled]}>
                {option.active ? 'Select File' : 'Coming Soon'}
              </Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { padding: 20, marginBottom: 8 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#1A1A1A', marginBottom: 4 },
  headerSub: { fontSize: 14, color: '#8E8E93', fontWeight: '500' },
  
  grid: { padding: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  card: { width: '100%', backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E5EA', padding: 20 },
  iconBox: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 8 },
  cardDesc: { fontSize: 14, color: '#6B7280', marginBottom: 24 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#007AFF', padding: 12, borderRadius: 8 },
  btnDisabled: { backgroundColor: '#E5E7EB' },
  btnText: { color: '#FFF', fontWeight: '600', fontSize: 16 },
  btnTextDisabled: { color: '#9CA3AF' },
  
  loadingContainer: { flex: 1, backgroundColor: '#F8F9FA', justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingCard: { backgroundColor: '#FFF', padding: 32, borderRadius: 16, borderWidth: 1, borderColor: '#E5E5EA', width: '100%', maxWidth: 400, alignItems: 'center' },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  spinnerWrapper: { position: 'absolute', top: -5, right: -5, backgroundColor: '#FFF', borderRadius: 16, padding: 4 },
  loadingTitle: { fontSize: 24, fontWeight: '800', color: '#1A1A1A', marginBottom: 12 },
  loadingMsg: { fontSize: 16, color: '#4B5563', textAlign: 'center', marginBottom: 12, fontWeight: '500' },
  loadingWarning: { fontSize: 12, color: '#9CA3AF', textAlign: 'center' }
});
