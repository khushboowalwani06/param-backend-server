import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Modal, ActivityIndicator, Alert, Image } from 'react-native';
import { sheetsService } from '../../services/sheetsService';
import { useToast } from '../../context/ToastContext';
import { CheckSquare, FileText, UserPlus, Eye, Download, X } from 'lucide-react-native';
import { CardSkeleton } from '../../components/Skeleton';
import { useRealtime } from '../../hooks/useRealtime';
import { SearchFilter } from '../../components/SearchFilter';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Pagination } from '../../components/Pagination';

const DocumentCard = ({ user, userDocs, isDocLoading, onLoadDocs, onPreview }) => {
  const handleDownload = async (base64, label) => {
    try {
      const isPdf = base64.includes('application/pdf') || base64.endsWith('.pdf');
      const ext = isPdf ? '.pdf' : '.png';
      const fileUri = `${FileSystem.documentDirectory}${label.replace(/\s+/g, '_')}${ext}`;
      
      if (base64.startsWith('http')) {
        await FileSystem.downloadAsync(base64, fileUri);
      } else {
        let rawB64 = (base64.split(',')[1] || base64).replace(/\s+/g, '');
        try { rawB64 = decodeURIComponent(rawB64); } catch (e) {}
        await FileSystem.writeAsStringAsync(fileUri, rawB64, { encoding: 'base64' });
      }
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Download Error', err.message || String(err));
    }
  };

  const DocumentRow = ({ docBase64, label }) => {
    if (!docBase64) return null;
    const isPdf = docBase64.includes('application/pdf');
    return (
      <View style={styles.docRow}>
        <Text style={styles.docLabel}>{label}</Text>
        <View style={styles.docActions}>
          <TouchableOpacity onPress={() => handleDownload(docBase64, label)} style={styles.docBtn}>
            <Download size={14} color="#007AFF" />
          </TouchableOpacity>
          {!isPdf && (
            <TouchableOpacity onPress={() => onPreview({ label, data: docBase64 })} style={styles.docBtn}>
              <Eye size={14} color="#007AFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.userName} numberOfLines={1}>{user.Name}</Text>
          <Text style={styles.userCompany} numberOfLines={1}>{user.Company || 'N/A'} | {user.Role}</Text>
        </View>
        <View style={styles.approvedBadge}><Text style={styles.approvedText}>APPROVED</Text></View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Email</Text><Text style={styles.infoVal}>{user.Email}</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Phone</Text><Text style={styles.infoVal}>{user.Phone || 'N/A'}</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>GSTIN</Text><Text style={styles.infoVal}>{user.BPID || 'N/A'}</Text></View>
      </View>

      <View style={styles.docsArea}>
        <View style={styles.docsTitleRow}>
          <FileText size={16} color="#1A1A1A" />
          <Text style={styles.docsTitle}>Attached Documents</Text>
        </View>
        
        {userDocs ? (
          <View>
            <DocumentRow docBase64={userDocs.aadhar} label="Aadhar Card" />
            <DocumentRow docBase64={userDocs.pan} label="PAN Card" />
            <DocumentRow docBase64={userDocs.gst} label="GST Certificate" />
            <DocumentRow docBase64={userDocs.companyPan} label="Company PAN" />
            <DocumentRow docBase64={userDocs.bankCheque} label="Bank Cheque" />
            {!Object.values(userDocs).some(Boolean) && <Text style={styles.noDocsText}>No documents uploaded.</Text>}
          </View>
        ) : isDocLoading ? (
          <ActivityIndicator color="#2563EB" style={{ marginVertical: 10 }} />
        ) : (
          <TouchableOpacity onPress={onLoadDocs} style={styles.loadDocsBtn}>
            <Text style={styles.loadDocsText}>Load Documents</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export const CustomerDocuments = () => {
  const { error } = useToast();
  const [approvedUsers, setApprovedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [previewDoc, setPreviewDoc] = useState(null);
  
  const [loadedDocuments, setLoadedDocuments] = useState({});
  const [loadingDocuments, setLoadingDocuments] = useState({});
  const [refreshKey, setRefreshKey] = useState(0);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useRealtime(['users'], () => setRefreshKey(k => k + 1));

  useEffect(() => {
    fetchApproved();
  }, [refreshKey]);

  const fetchApproved = async () => {
    try {
      setLoading(true);
      const allUsers = await sheetsService._fetch('/users');
      const approvedCustomers = allUsers.filter(u => 
        (u.Role === 'customer' || u.Role === 'retailer' || u.Role === 'dealer') && 
        u.ApprovalStatus !== 'Pending' && u.ApprovalStatus !== 'Rejected'
      );
      setApprovedUsers(approvedCustomers);
      setCurrentPage(1);
    } catch (err) {
      error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const loadUserDocuments = async (userId) => {
    try {
      setLoadingDocuments(prev => ({ ...prev, [userId]: true }));
      const response = await sheetsService.getUserDocuments(userId);
      if (response && response.documents) {
        setLoadedDocuments(prev => ({ ...prev, [userId]: response.documents }));
      }
    } catch (err) {
      error('Failed to load documents for this customer');
    } finally {
      setLoadingDocuments(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handlePreview = async (doc) => {
    try {
      if (doc.data && doc.data.startsWith('data:')) {
        const isPdf = doc.data.includes('application/pdf');
        const ext = isPdf ? '.pdf' : '.png';
        let rawB64 = (doc.data.split(',')[1] || doc.data).replace(/\s+/g, '');
        try { rawB64 = decodeURIComponent(rawB64); } catch (e) {}
        const cleanB64 = rawB64;
        const fileUri = `${FileSystem.cacheDirectory}preview_${Date.now()}${ext}`;
        await FileSystem.writeAsStringAsync(fileUri, cleanB64, { encoding: 'base64' });
        setPreviewDoc({ ...doc, data: fileUri });
      } else {
        setPreviewDoc(doc);
      }
    } catch (err) {
      console.error('Failed to prepare preview:', err);
      Alert.alert('Preview Error', err.message || String(err));
      setPreviewDoc(doc);
    }
  };

  if (loading) return <View style={{padding: 16}}><CardSkeleton /><CardSkeleton /></View>;

  const filteredUsers = approvedUsers.filter(user => {
    const term = searchTerm.toLowerCase();
    return (
      user.Name?.toLowerCase().includes(term) ||
      user.Company?.toLowerCase().includes(term) ||
      user.Email?.toLowerCase().includes(term) ||
      user.BPID?.toLowerCase().includes(term) ||
      user.UserID?.toLowerCase().includes(term)
    );
  });

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerInfo}>
          <View style={styles.iconBox}><UserPlus size={24} color="#9333EA" /></View>
          <View>
            <Text style={styles.headerTitle}>Customer Documents</Text>
            <Text style={styles.headerSub}>View submitted documents</Text>
          </View>
        </View>
      </View>

      <View style={styles.searchWrapper}>
        <SearchFilter value={searchTerm} onChange={setSearchTerm} placeholder="Search customers..." />
      </View>

      <View style={styles.content}>
        {filteredUsers.length === 0 ? (
          <View style={styles.emptyBox}>
            <CheckSquare size={48} color="#D1D1D6" style={{marginBottom: 16}} />
            <Text style={styles.emptyTitle}>No Customers Found</Text>
            <Text style={styles.emptySub}>{searchTerm ? 'No customers match your search.' : 'There are no approved customers at the moment.'}</Text>
          </View>
        ) : (
          paginatedUsers.map(user => (
            <DocumentCard
              key={user.UserID}
              user={user}
              userDocs={loadedDocuments[user.UserID]}
              isDocLoading={loadingDocuments[user.UserID]}
              onLoadDocs={() => loadUserDocuments(user.UserID)}
              onPreview={handlePreview}
            />
          ))
        )}
      </View>

      {totalPages > 1 && (
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
      )}

      <Modal visible={!!previewDoc} transparent animationType="slide">
        <View style={styles.previewOverlay}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewTitle}>{previewDoc?.label}</Text>
            <TouchableOpacity onPress={() => setPreviewDoc(null)} style={styles.closePreviewBtn}>
              <X size={20} color="#1A1A1A" />
            </TouchableOpacity>
          </View>
          <View style={styles.previewBody}>
            {previewDoc && (
              <Image source={{ uri: previewDoc.data.replace(/\s+/g, '') }} style={styles.previewImg} resizeMode="contain" />
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E5EA' },
  headerInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#F3E8FF', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#1A1A1A', marginBottom: 2 },
  headerSub: { fontSize: 12, color: '#8E8E93', fontWeight: '500' },
  searchWrapper: { padding: 16, backgroundColor: '#F8F9FA' },
  content: { padding: 16, paddingTop: 0, gap: 16, paddingBottom: 40 },
  
  emptyBox: { alignItems: 'center', padding: 40, backgroundColor: '#FFF', borderRadius: 16, borderWidth: 1, borderColor: '#E5E5EA' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#8E8E93', textAlign: 'center' },
  
  card: { backgroundColor: '#FFF', borderRadius: 16, borderWidth: 1, borderColor: '#E5E5EA', overflow: 'hidden', elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F2F2F7' },
  userName: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  userCompany: { fontSize: 12, color: '#8E8E93', marginTop: 4 },
  approvedBadge: { backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  approvedText: { fontSize: 10, fontWeight: '700', color: '#059669' },
  cardBody: { padding: 16, gap: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoLabel: { fontSize: 14, color: '#8E8E93', fontWeight: '500' },
  infoVal: { fontSize: 14, color: '#1A1A1A', fontWeight: '600' },
  
  docsArea: { backgroundColor: '#F8F9FA', padding: 16 },
  docsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  docsTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  docRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 8, backgroundColor: '#FFF', borderRadius: 8, borderWidth: 1, borderColor: '#E5E5EA', marginBottom: 8 },
  docLabel: { fontSize: 12, fontWeight: '600', color: '#1A1A1A' },
  docActions: { flexDirection: 'row', gap: 8 },
  docBtn: { padding: 6, backgroundColor: '#F8F9FA', borderRadius: 6, borderWidth: 1, borderColor: '#E5E5EA' },
  noDocsText: { fontSize: 12, color: '#8E8E93' },
  loadDocsBtn: { backgroundColor: '#EFF6FF', paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#BFDBFE', alignItems: 'center' },
  loadDocsText: { color: '#2563EB', fontWeight: '600', fontSize: 14 },
  
  previewOverlay: { flex: 1, backgroundColor: '#FFF' },
  previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  previewTitle: { fontSize: 16, fontWeight: '600', color: '#0F172A' },
  closePreviewBtn: { padding: 8, backgroundColor: '#F1F5F9', borderRadius: 8 },
  previewBody: { flex: 1, backgroundColor: '#F8FAFC', padding: 16 },
  previewImg: { width: '100%', height: '100%' }
});
