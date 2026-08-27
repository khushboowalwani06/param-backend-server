import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, Modal, TextInput, Platform } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { sheetsService } from '../../services/sheetsService';
import { User, FileText, Eye, X, IndianRupee, Camera, Save } from 'lucide-react-native';
import { Picker } from '@react-native-picker/picker';

export default function CompetitorLog() {
  const { user } = useAuth();
  const [intelFeed, setIntelFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewImage, setViewImage] = useState(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    competitorName: '',
    ratePerBag: '',
    notes: '',
    photo_data: null
  });

  useEffect(() => {
    if (user?.Role === 'admin') {
      sheetsService.getCompetitorIntel()
        .then(data => setIntelFeed(data))
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user]);

  const handleSubmit = async () => {
    if (!formData.competitorName || !formData.ratePerBag) {
      alert("Please enter competitor name and rate");
      return;
    }
    
    setIsSubmitting(true);
    try {
      if (sheetsService.submitCompetitorIntel) {
        await sheetsService.submitCompetitorIntel({
          ...formData,
          sales_rep_id: user.UserID,
          sales_rep_name: user.Name || 'Sales Rep',
          created_at: new Date().toISOString()
        });
      }
      alert('Competitor data logged successfully.');
      setFormData({ competitorName: '', ratePerBag: '', notes: '', photo_data: null });
    } catch (err) {
      alert('Failed to log competitor data.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1A1A1A" />
      </View>
    );
  }

  // Admin View (Feed)
  if (user?.Role === 'admin') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Competitor Intel Feed</Text>
        </View>

        <ScrollView style={styles.feedContainer}>
          {intelFeed.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No competitor intel logged yet.</Text>
            </View>
          ) : (
            intelFeed.map((intel, index) => (
              <View key={intel.id || index} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.indexText}>{(index + 1).toString().padStart(2, '0')}.</Text>
                  <View style={styles.rateContainer}>
                    <IndianRupee size={16} color="#1A1A1A" />
                    <Text style={styles.rateText}>{intel.rate_per_bag}/bag</Text>
                  </View>
                </View>

                <View style={styles.cardBody}>
                  <Text style={styles.competitorName} numberOfLines={1}>{intel.competitor_name}</Text>
                  <View style={styles.salesRepRow}>
                    <User size={14} color="#64748B" />
                    <Text style={styles.salesRepName} numberOfLines={1}>{intel.sales_rep_name}</Text>
                  </View>
                  <Text style={styles.dateText}>{new Date(intel.created_at).toLocaleString()}</Text>
                </View>

                {intel.notes ? (
                  <View style={styles.notesBox}>
                    <FileText size={14} color="#64748B" />
                    <Text style={styles.notesText}>{intel.notes}</Text>
                  </View>
                ) : null}

                {intel.photo_data && (
                  <TouchableOpacity 
                    style={styles.viewImageBtn}
                    onPress={() => setViewImage(intel.photo_data)}
                  >
                    <Eye size={16} color="#FFF" />
                    <Text style={styles.viewImageText}>View Image</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </ScrollView>

        <Modal visible={!!viewImage} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <TouchableOpacity 
              style={styles.closeBtn}
              onPress={() => setViewImage(null)}
            >
              <X size={24} color="#FFF" />
            </TouchableOpacity>
            {viewImage && (
              <Image 
                source={{ uri: viewImage }} 
                style={styles.modalImage} 
                resizeMode="contain"
              />
            )}
          </View>
        </Modal>
      </View>
    );
  }

  // Sales View (Form)
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.formCard}>
        <Text style={styles.title}>Log Competitor Intel</Text>
        
        <View style={styles.formGroup}>
          <Text style={styles.label}>Competitor Brand Name</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={formData.competitorName}
              onValueChange={(val) => setFormData(prev => ({ ...prev, competitorName: val }))}
            >
              <Picker.Item label="Select a brand..." value="" />
              <Picker.Item label="UltraTech" value="UltraTech" />
              <Picker.Item label="Ambuja" value="Ambuja" />
              <Picker.Item label="ACC" value="ACC" />
              <Picker.Item label="Shree" value="Shree" />
              <Picker.Item label="Other" value="Other" />
            </Picker>
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Current Rate per Bag (₹)</Text>
          <View style={styles.inputContainer}>
            <IndianRupee size={16} color="#64748B" />
            <TextInput
              style={styles.input}
              placeholder="e.g. 350"
              keyboardType="numeric"
              value={formData.ratePerBag}
              onChangeText={(text) => setFormData(prev => ({ ...prev, ratePerBag: text }))}
            />
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Additional Notes</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Any schemes, bulk discounts, or context..."
            multiline
            numberOfLines={4}
            value={formData.notes}
            onChangeText={(text) => setFormData(prev => ({ ...prev, notes: text }))}
          />
        </View>

        <TouchableOpacity 
          style={[styles.submitBtn, isSubmitting && { opacity: 0.7 }]} 
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Save size={18} color="#FFF" />
              <Text style={styles.submitBtnText}>Submit Intel</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  header: {
    padding: 20,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  feedContainer: {
    padding: 16,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 16,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  indexText: {
    fontSize: 24,
    fontWeight: '300',
    color: '#E2E8F0',
  },
  rateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rateText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginLeft: 4,
  },
  cardBody: {
    marginBottom: 12,
  },
  competitorName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  salesRepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  salesRepName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginLeft: 6,
    flexShrink: 1,
  },
  dateText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  notesBox: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  notesText: {
    fontSize: 14,
    color: '#475569',
    marginLeft: 8,
    flex: 1,
  },
  viewImageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
    padding: 12,
    borderRadius: 8,
  },
  viewImageText: {
    color: '#FFF',
    fontWeight: '600',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  modalImage: {
    width: '90%',
    height: '80%',
  },
  // Form Styles
  formCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: '#1A1A1A',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1A1A1A',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  submitBtn: {
    backgroundColor: '#1A1A1A',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderRadius: 999,
    marginTop: 8,
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
