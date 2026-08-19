import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Modal, Image, ActivityIndicator, Animated } from 'react-native';
import { sheetsService } from '../../services/sheetsService';
import { useToast } from '../../context/ToastContext';
import { CheckSquare, XSquare, FileText, UserPlus, Eye, Download, X } from 'lucide-react-native';
import { CardSkeleton } from '../../components/Skeleton';
import { ExportButton } from '../../components/ExportButton';
import { useRealtime } from '../../hooks/useRealtime';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const RegistrationCard = ({ user, isDocLoading, userDocs, onLoadDocs, onApprove, onReject, actionLoading }) => {
  const flipAnim = useRef(new Animated.Value(0)).current;
  const [flippedDoc, setFlippedDoc] = useState(null);

  const flipToBack = (doc) => {
    setFlippedDoc(doc);
    Animated.spring(flipAnim, {
      toValue: 180,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start();
  };

  const flipToFront = () => {
    Animated.spring(flipAnim, {
      toValue: 0,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start(() => setFlippedDoc(null));
  };

  const frontInterpolate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg'],
  });
  const backInterpolate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['180deg', '360deg'],
  });

  const frontAnimatedStyle = { transform: [{ rotateY: frontInterpolate }] };
  const backAnimatedStyle = { transform: [{ rotateY: backInterpolate }] };

  const handleDownload = async (base64, label) => {
    try {
      const isPdf = base64.includes('application/pdf');
      const ext = isPdf ? '.pdf' : '.png';
      const cleanB64 = base64.split(',')[1] || base64;
      const fileUri = `${FileSystem.documentDirectory}${label.replace(/\s+/g, '_')}${ext}`;
      await FileSystem.writeAsStringAsync(fileUri, cleanB64, { encoding: FileSystem.EncodingType.Base64 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      }
    } catch (err) {
      console.error(err);
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
            <TouchableOpacity onPress={() => flipToBack({ label, data: docBase64 })} style={styles.docBtn}>
              <Eye size={14} color="#007AFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.cardContainer}>
      {/* Front Face */}
      <Animated.View style={[styles.cardFace, styles.cardFront, frontAnimatedStyle]}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.userName}>{user.Name}</Text>
            <Text style={styles.userCompany}>{user.Company || 'N/A'} | {user.Role}</Text>
          </View>
          <View style={styles.pendingBadge}><Text style={styles.pendingText}>PENDING</Text></View>
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

        <View style={styles.cardActions}>
          <TouchableOpacity 
            style={[styles.actionBtn, styles.rejectBtn, actionLoading && {opacity: 0.5}]} 
            onPress={onReject} 
            disabled={actionLoading}
          >
            <XSquare size={16} color="#DC2626" />
            <Text style={styles.rejectText}>{actionLoading ? 'Wait...' : 'Reject'}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionBtn, styles.approveBtn, actionLoading && {opacity: 0.5}]} 
            onPress={onApprove} 
            disabled={actionLoading}
          >
            <CheckSquare size={16} color="#FFF" />
            <Text style={styles.approveText}>{actionLoading ? 'Wait...' : 'Approve'}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Back Face (Document Viewer) */}
      <Animated.View style={[styles.cardFace, styles.cardBack, backAnimatedStyle]}>
        {flippedDoc && (
          <View style={{ flex: 1 }}>
            <View style={styles.previewHeader}>
              <View style={styles.previewTitleRow}>
                <FileText size={16} color="#007AFF" />
                <Text style={styles.previewTitle}>{flippedDoc.label}</Text>
              </View>
              <TouchableOpacity onPress={flipToFront} style={styles.closePreviewBtn}>
                <X size={16} color="#1A1A1A" />
              </TouchableOpacity>
            </View>
            <View style={styles.previewBody}>
              <Image source={{ uri: flippedDoc.data }} style={styles.previewImg} resizeMode="contain" />
            </View>
          </View>
        )}
      </Animated.View>
    </View>
  );
};

export const PendingRegistrations = () => {
  const { success, error } = useToast();
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [loadedDocuments, setLoadedDocuments] = useState({});
  const [loadingDocuments, setLoadingDocuments] = useState({});
  const [actionLoading, setActionLoading] = useState(null);
  
  const [rejectingUser, setRejectingUser] = useState(null);
  const [rejectionReasons, setRejectionReasons] = useState([]);
  const rejectionOptions = [
    'Aadhar Card', 'PAN Card', 'GST Certificate', 'Company PAN', 'Bank Cheque', 'Image is blurry/unreadable', 'Document name mismatch'
  ];
  
  const [refreshKey, setRefreshKey] = useState(0);

  useRealtime(['users'], () => setRefreshKey(k => k + 1));

  useEffect(() => {
    fetchPending();
  }, [refreshKey]);

  const fetchPending = async () => {
    try {
      setLoading(true);
      const allUsers = await sheetsService._fetch('/users?pendingOnly=true');
      setPendingUsers(allUsers);
    } catch (err) {
      error('Failed to load pending registrations');
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

  const handleAction = async (userId, action, reason = null) => {
    try {
      setActionLoading(userId);
      const body = { user_id: userId, action };
      if (reason) body.rejection_reason = reason;

      const res = await sheetsService._fetch('/admin/approve-user', {
        method: 'POST',
        body: JSON.stringify(body)
      });
      
      success(`User ${action}d successfully`);
      setRejectingUser(null);
      setRejectionReasons([]);
      fetchPending();
    } catch (err) {
      error(`Failed to ${action} user`);
    } finally {
      setActionLoading(null);
    }
  };

  const toggleReason = (reason) => {
    setRejectionReasons(prev => prev.includes(reason) ? prev.filter(r => r !== reason) : [...prev, reason]);
  };

  if (loading) return <View style={{padding: 16}}><CardSkeleton /><CardSkeleton /></View>;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerInfo}>
          <View style={styles.iconBox}><UserPlus size={24} color="#9333EA" /></View>
          <View>
            <Text style={styles.headerTitle}>Pending Registrations</Text>
            <Text style={styles.headerSub}>Review and approve new retailer accounts</Text>
          </View>
        </View>
        <ExportButton data={pendingUsers} filename="PendingRegistrations" />
      </View>

      <View style={styles.content}>
        {pendingUsers.length === 0 ? (
          <View style={styles.emptyBox}>
            <CheckSquare size={48} color="#D1D1D6" style={{marginBottom: 16}} />
            <Text style={styles.emptyTitle}>All Caught Up!</Text>
            <Text style={styles.emptySub}>There are no pending registrations at the moment.</Text>
          </View>
        ) : (
          pendingUsers.map(user => (
            <RegistrationCard
              key={user.UserID}
              user={user}
              userDocs={loadedDocuments[user.UserID]}
              isDocLoading={loadingDocuments[user.UserID]}
              onLoadDocs={() => loadUserDocuments(user.UserID)}
              onApprove={() => handleAction(user.UserID, 'approve')}
              onReject={() => setRejectingUser(user)}
              actionLoading={actionLoading === user.UserID}
            />
          ))
        )}
      </View>

      {/* Reject Modal */}
      <Modal visible={!!rejectingUser} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reject Registration</Text>
              <TouchableOpacity onPress={() => { setRejectingUser(null); setRejectionReasons([]); }}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              <Text style={styles.modalText}>
                Please select the reason(s) for rejecting <Text style={{fontWeight:'700'}}>{rejectingUser?.Name}</Text>'s registration. This will be shown to the customer.
              </Text>
              <View style={styles.reasonsList}>
                {rejectionOptions.map(r => (
                  <TouchableOpacity key={r} style={styles.reasonRow} onPress={() => toggleReason(r)}>
                    <View style={[styles.checkbox, rejectionReasons.includes(r) && styles.checkboxActive]}>
                      {rejectionReasons.includes(r) && <CheckSquare size={14} color="#FFF" />}
                    </View>
                    <Text style={styles.reasonText}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setRejectingUser(null); setRejectionReasons([]); }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.confirmRejectBtn, rejectionReasons.length === 0 && {opacity:0.5}]}
                disabled={rejectionReasons.length === 0 || actionLoading === rejectingUser?.UserID}
                onPress={() => handleAction(rejectingUser.UserID, 'reject', rejectionReasons.join(', '))}
              >
                <Text style={styles.confirmRejectText}>{actionLoading === rejectingUser?.UserID ? 'Processing...' : 'Confirm Rejection'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E5EA', flexWrap: 'wrap', gap: 12 },
  headerInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#F3E8FF', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#1A1A1A', marginBottom: 2 },
  headerSub: { fontSize: 12, color: '#8E8E93', fontWeight: '500' },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  emptyBox: { alignItems: 'center', padding: 40, backgroundColor: '#FFF', borderRadius: 16, borderWidth: 1, borderColor: '#E5E5EA' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#8E8E93', textAlign: 'center' },
  
  cardContainer: { position: 'relative', width: '100%', minHeight: 380, marginBottom: 16 },
  cardFace: { position: 'absolute', width: '100%', height: '100%', backgroundColor: '#FFF', borderRadius: 16, borderWidth: 1, borderColor: '#E5E5EA', overflow: 'hidden', elevation: 2, backfaceVisibility: 'hidden' },
  cardFront: {},
  cardBack: {},

  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F2F2F7' },
  userName: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  userCompany: { fontSize: 12, color: '#8E8E93', marginTop: 4 },
  pendingBadge: { backgroundColor: '#FEF2F2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  pendingText: { fontSize: 10, fontWeight: '700', color: '#DC2626' },
  cardBody: { padding: 16, gap: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoLabel: { fontSize: 14, color: '#8E8E93', fontWeight: '500' },
  infoVal: { fontSize: 14, color: '#1A1A1A', fontWeight: '600' },
  
  docsArea: { backgroundColor: '#F8F9FA', padding: 16, flex: 1 },
  docsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  docsTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  docRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 8, backgroundColor: '#FFF', borderRadius: 8, borderWidth: 1, borderColor: '#E5E5EA', marginBottom: 8 },
  docLabel: { fontSize: 12, fontWeight: '600', color: '#1A1A1A' },
  docActions: { flexDirection: 'row', gap: 8 },
  docBtn: { padding: 6, backgroundColor: '#F8F9FA', borderRadius: 6, borderWidth: 1, borderColor: '#E5E5EA' },
  noDocsText: { fontSize: 12, color: '#8E8E93' },
  loadDocsBtn: { backgroundColor: '#EFF6FF', paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#BFDBFE', alignItems: 'center' },
  loadDocsText: { color: '#2563EB', fontWeight: '600', fontSize: 14 },
  
  cardActions: { flexDirection: 'row', padding: 16, borderTopWidth: 1, borderTopColor: '#E5E5EA', backgroundColor: '#FFF', gap: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 8, gap: 8 },
  rejectBtn: { backgroundColor: '#FEF2F2' },
  rejectText: { color: '#DC2626', fontWeight: '600', fontSize: 14 },
  approveBtn: { backgroundColor: '#34C759' },
  approveText: { color: '#FFF', fontWeight: '600', fontSize: 14 },

  previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  previewTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewTitle: { fontSize: 16, fontWeight: '600', color: '#0F172A' },
  closePreviewBtn: { padding: 8, backgroundColor: '#F1F5F9', borderRadius: 8 },
  previewBody: { flex: 1, backgroundColor: '#F8FAFC', padding: 16, justifyContent: 'center', alignItems: 'center' },
  previewImg: { width: '100%', height: '100%', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.75)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFF', borderRadius: 12, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#0F172A' },
  modalBody: { padding: 20 },
  modalText: { fontSize: 14, color: '#475569', marginBottom: 16 },
  reasonsList: { gap: 12 },
  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkbox: { width: 20, height: 20, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: '#0284C7', borderColor: '#0284C7' },
  reasonText: { fontSize: 14, color: '#1E293B', fontWeight: '500' },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', padding: 16, backgroundColor: '#F8FAFC', borderTopWidth: 1, borderTopColor: '#E2E8F0', gap: 12 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 16, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 6 },
  cancelText: { color: '#475569', fontWeight: '600', fontSize: 14 },
  confirmRejectBtn: { paddingVertical: 10, paddingHorizontal: 16, backgroundColor: '#DC2626', borderRadius: 6 },
  confirmRejectText: { color: '#FFF', fontWeight: '600', fontSize: 14 }
});
