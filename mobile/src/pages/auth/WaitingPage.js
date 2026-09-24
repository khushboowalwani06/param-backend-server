import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { AlertCircle, Clock, LogOut, UploadCloud, CheckCircle } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { sheetsService } from '../../services/sheetsService';
import { useLanguage } from '../../context/LanguageContext';

export default function WaitingPage() {
  const { t } = useLanguage();
  const { user, logout, updateUser } = useAuth();
  const { showToast } = useToast();

  const [newDocuments, setNewDocuments] = useState({});
  const [newDocumentNames, setNewDocumentNames] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!user) return null;

  const isRejected = user.ApprovalStatus === 'Rejected';

  const documentLabels = {
    aadhar: 'Aadhar Card',
    pan: 'PAN Card',
    gst: 'GST Certificate',
    companyPan: 'Company PAN Card',
    bankCheque: 'Bank Cheque (Blank)'
  };

  const handleFileUpload = async (docType) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'] });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        if (file.size && file.size > 15 * 1024 * 1024) {
          return Alert.alert('Error', 'File is too large. Please upload an image/PDF under 15MB.');
        }
        
        let mimeType = 'image/jpeg';
        if (file.name.toLowerCase().endsWith('.png')) mimeType = 'image/png';
        if (file.name.toLowerCase().endsWith('.pdf')) mimeType = 'application/pdf';
        
        const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
        const dataUrl = `data:${mimeType};base64,${base64}`;

        setNewDocuments(prev => ({ ...prev, [docType]: dataUrl }));
        setNewDocumentNames(prev => ({ ...prev, [docType]: file.name }));
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to read file');
    }
  };

  const handleResubmit = async () => {
    if (Object.keys(newDocuments).length === 0) {
      Alert.alert('Error', 'Please upload at least one document before resubmitting.');
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      const token = sheetsService.token; // Directly accessing token, though using custom fetch wrapper would be better
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/user/resubmit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ documents: newDocuments })
      });
      
      if (!res.ok) throw new Error('Failed to resubmit');
      const data = await res.json();
      
      await updateUser(data);
      showToast('Documents resubmitted successfully!', 'success');
      setNewDocuments({});
      setNewDocumentNames({});
    } catch (err) {
      Alert.alert('Error', 'Failed to resubmit documents.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerBrand}>{t('PARAM MARKETING')}</Text>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <LogOut size={16} color="#64748B" />
          <Text style={styles.logoutText}>{t('Sign Out')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.card, isRejected && styles.cardRejected]}>
          <View style={[styles.iconContainer, isRejected ? styles.iconRejected : styles.iconPending]}>
            {isRejected ? <AlertCircle size={40} color="#DC2626" /> : <Clock size={40} color="#D97706" />}
          </View>
          
          <Text style={styles.title}>
            {isRejected ? 'Registration Declined' : 'Account Under Review'}
          </Text>
          
          <Text style={styles.subtitle}>
            {isRejected 
              ? `Your registration requires attention, ${user.Name}. The administration team has reviewed your documents and requested changes.`
              : `Thank you for registering, ${user.Name}. Your account is currently pending administrative approval.`}
          </Text>

          {isRejected && user.RejectionReason && (
            <View style={styles.reasonBox}>
              <Text style={styles.reasonTitle}>{t('Reason for Rejection:')}</Text>
              <Text style={styles.reasonText}>{user.RejectionReason}</Text>
            </View>
          )}

          {isRejected && (
            <View style={styles.resubmitSection}>
              <Text style={styles.resubmitTitle}>{t('Re-upload Documents')}</Text>
              <Text style={styles.resubmitDesc}>{t('Upload the corrected files below and resubmit your registration for review.')}</Text>
              
              {Object.entries(documentLabels).map(([key, label]) => {
                const hasDoc = !!newDocuments[key];
                return (
                  <TouchableOpacity 
                    key={key} 
                    style={[styles.uploadRow, hasDoc && styles.uploadRowSuccess]} 
                    onPress={() => handleFileUpload(key)}
                  >
                    <View style={styles.uploadRowLeft}>
                      {hasDoc ? <CheckCircle size={18} color="#10B981" /> : <UploadCloud size={18} color="#64748B" />}
                      <Text style={[styles.uploadLabel, hasDoc && styles.uploadLabelSuccess]} numberOfLines={1}>
                        {hasDoc ? newDocumentNames[key] : `Upload ${label}`}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity 
                style={[styles.submitBtn, (isSubmitting || Object.keys(newDocuments).length === 0) && styles.submitBtnDisabled]}
                onPress={handleResubmit}
                disabled={isSubmitting || Object.keys(newDocuments).length === 0}
              >
                <Text style={styles.submitBtnText}>{isSubmitting ? 'Submitting...' : 'Resubmit Registration'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingTop: 40 },
  headerBrand: { fontSize: 18, fontWeight: '800', color: '#1A1A1A' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 6 },
  logoutText: { fontSize: 14, fontWeight: '500', color: '#64748B' },
  scrollContent: { padding: 16, flexGrow: 1, justifyContent: 'center' },
  card: { backgroundColor: 'white', borderRadius: 16, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, borderWidth: 1, borderColor: '#E2E8F0' },
  cardRejected: { borderColor: '#FECACA', borderWidth: 2 },
  iconContainer: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  iconPending: { backgroundColor: '#FEF3C7' },
  iconRejected: { backgroundColor: '#FEE2E2' },
  title: { fontSize: 24, fontWeight: '700', color: '#0F172A', marginBottom: 12, textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#475569', textAlign: 'center', lineHeight: 24, marginBottom: 24 },
  reasonBox: { backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderWidth: 1, borderRadius: 12, padding: 16, width: '100%', marginBottom: 24 },
  reasonTitle: { fontSize: 16, fontWeight: '600', color: '#991B1B', marginBottom: 8 },
  reasonText: { fontSize: 15, color: '#7F1D1D', fontWeight: '500' },
  resubmitSection: { width: '100%', borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 24 },
  resubmitTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A', marginBottom: 8 },
  resubmitDesc: { fontSize: 14, color: '#64748B', marginBottom: 20 },
  uploadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', borderStyle: 'dashed', borderRadius: 8, marginBottom: 12 },
  uploadRowSuccess: { borderColor: '#10B981', borderStyle: 'solid', backgroundColor: '#ECFDF5' },
  uploadRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  uploadLabel: { fontSize: 14, color: '#64748B', flex: 1 },
  uploadLabelSuccess: { color: '#10B981', fontWeight: '600' },
  submitBtn: { backgroundColor: '#10B981', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: 'white', fontSize: 16, fontWeight: '600' }
});
