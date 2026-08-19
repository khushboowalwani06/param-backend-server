import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, Modal, TextInput, Dimensions, Alert } from 'react-native';
import { sheetsService } from '../../services/sheetsService';
import { useAuth } from '../../context/AuthContext';
import { notificationEngine } from '../../services/notificationEngine';
import { AlertCircle, Image as ImageIcon, X } from 'lucide-react-native';
import { StatusBadge } from '../../components/StatusBadge';

const { width } = Dimensions.get('window');

export default function DisputesPanel() {
  const { user } = useAuth();
  
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [editingDispute, setEditingDispute] = useState(null);
  const [updateForm, setUpdateForm] = useState({ Status: '', AdminNotes: '' });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [allDisputes, allUsers] = await Promise.all([
        sheetsService.getDisputes(),
        sheetsService._fetch('/users').catch(() => [])
      ]);

      let enriched = allDisputes.map(d => {
        const customer = allUsers.find(u => u.UserID === d.UserID) || {};
        const salesRep = allUsers.find(u => u.UserID === customer.AssignedSalesRep) || {};
        return {
          ...d,
          CustomerName: customer.Name || 'Unknown',
          CustomerCompany: customer.Company || 'Unknown',
          AssignedSalesRep: customer.AssignedSalesRep,
          SalesRepName: salesRep.Name || 'Unassigned'
        };
      });

      enriched.sort((a, b) => new Date(b.CreatedAt || 0) - new Date(a.CreatedAt || 0));
      setDisputes(enriched);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleUpdateSubmit = async () => {
    try {
      await sheetsService.updateDispute(editingDispute.DisputeID, updateForm);
      
      // Notify the customer and affected personnel
      notificationEngine.sendNotification(
        [editingDispute.UserID, 'admin', 'sales'], 
        `Issue Update: ${editingDispute.DisputeID}`, 
        `Reported issue status changed to: ${updateForm.Status}${updateForm.AdminNotes ? `. Notes: ${updateForm.AdminNotes}` : ''}`
      ).catch(console.error);

      Alert.alert('Success', 'Dispute updated successfully');
      setEditingDispute(null);
      fetchData();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to update dispute');
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1A1A1A" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Reported Issues</Text>
        <Text style={styles.subtitle}>Manage and resolve customer disputes.</Text>
      </View>

      <ScrollView style={styles.list}>
        {disputes.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No disputes found.</Text>
          </View>
        ) : (
          disputes.map(d => (
            <View key={d.DisputeID} style={styles.card}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.disputeId}>{d.DisputeID}</Text>
                  <Text style={styles.dateText}>{new Date(d.CreatedAt || Date.now()).toLocaleDateString()}</Text>
                </View>
                <StatusBadge status={d.Status} />
              </View>

              <View style={styles.cardBody}>
                <View style={styles.row}>
                  <Text style={styles.label}>Customer:</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.valueBold}>{d.CustomerName} ({d.UserID})</Text>
                    <Text style={styles.value}>{d.CustomerCompany}</Text>
                    <Text style={[styles.value, { color: '#3B82F6', fontSize: 12, marginTop: 2 }]}>Rep: {d.SalesRepName}</Text>
                  </View>
                </View>

                <View style={styles.row}>
                  <Text style={styles.label}>Issue:</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.valueBold}>Ord: {d.OrdID}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <AlertCircle size={14} color="#EF4444" />
                      <Text style={[styles.value, { color: '#EF4444' }]}>{d.IssueType} ({d.DamagedQuantity} units)</Text>
                    </View>
                  </View>
                </View>
                
                <View style={styles.row}>
                  <Text style={styles.label}>Evidence:</Text>
                  {d.PhotoURL ? (
                    <TouchableOpacity 
                      style={styles.evidenceBtn}
                      onPress={() => setSelectedPhoto(d.PhotoURL)}
                    >
                      <ImageIcon size={14} color="#1A1A1A" />
                      <Text style={styles.evidenceText}>View Photo</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={[styles.value, { color: '#94A3B8' }]}>N/A</Text>
                  )}
                </View>
              </View>

              <View style={styles.cardFooter}>
                <TouchableOpacity 
                  style={styles.updateBtn}
                  onPress={() => {
                    setEditingDispute(d);
                    setUpdateForm({ Status: d.Status, AdminNotes: d.AdminNotes || '' });
                  }}
                >
                  <Text style={styles.updateText}>Update Issue</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Photo Modal */}
      <Modal visible={!!selectedPhoto} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.closeBtn}
            onPress={() => setSelectedPhoto(null)}
          >
            <X size={24} color="#FFF" />
          </TouchableOpacity>
          {selectedPhoto && (
            <Image 
              source={{ uri: selectedPhoto }} 
              style={styles.modalImage} 
              resizeMode="contain" 
            />
          )}
        </View>
      </Modal>

      {/* Update Modal */}
      <Modal visible={!!editingDispute} transparent animationType="slide">
        <View style={styles.modalOverlayDark}>
          <View style={styles.updateModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Issue</Text>
              <TouchableOpacity onPress={() => setEditingDispute(null)}>
                <X size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Status</Text>
              <View style={styles.statusButtonsRow}>
                {['Pending', 'Investigating', 'Resolved', 'Rejected'].map(st => (
                  <TouchableOpacity
                    key={st}
                    style={[styles.statusBtn, updateForm.Status === st && styles.statusBtnActive]}
                    onPress={() => setUpdateForm({ ...updateForm, Status: st })}
                  >
                    <Text style={[styles.statusBtnText, updateForm.Status === st && styles.statusBtnTextActive]}>{st}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Resolution Notes</Text>
              <TextInput 
                style={styles.textArea}
                value={updateForm.AdminNotes}
                onChangeText={(val) => setUpdateForm({ ...updateForm, AdminNotes: val })}
                placeholder="Internal notes or resolution details..."
                multiline
                numberOfLines={4}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#F1F5F9' }]} onPress={() => setEditingDispute(null)}>
                <Text style={[styles.modalBtnText, { color: '#64748B' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#1A1A1A' }]} onPress={handleUpdateSubmit}>
                <Text style={[styles.modalBtnText, { color: '#FFF' }]}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  list: {
    flex: 1,
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
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  disputeId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  dateText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  cardBody: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  label: {
    width: 80,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  value: {
    fontSize: 14,
    color: '#1A1A1A',
  },
  valueBold: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  evidenceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  evidenceText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 16,
    paddingTop: 16,
    alignItems: 'flex-end',
  },
  updateBtn: {
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  updateText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlayDark: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  closeBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
  },
  modalImage: {
    width: width * 0.9,
    height: '80%',
  },
  updateModalCard: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  formGroup: {
    marginBottom: 16,
  },
  statusButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  statusBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFF',
  },
  statusBtnActive: {
    backgroundColor: '#1A1A1A',
    borderColor: '#1A1A1A',
  },
  statusBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  statusBtnTextActive: {
    color: '#FFF',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    fontSize: 14,
    height: 100,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  modalBtnText: {
    fontWeight: '600',
    fontSize: 14,
  },
});
