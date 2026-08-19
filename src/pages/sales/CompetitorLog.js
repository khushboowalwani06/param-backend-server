import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, Modal, Dimensions } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { sheetsService } from '../../services/sheetsService';
import { User, FileText, Eye, X, IndianRupee } from 'lucide-react-native';

const { width } = Dimensions.get('window');

export default function CompetitorLog() {
  const { user } = useAuth();
  const [intelFeed, setIntelFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewImage, setViewImage] = useState(null);

  useEffect(() => {
    if (user?.Role === 'admin') {
      sheetsService.getCompetitorIntel()
        .then(data => setIntelFeed(data))
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [user]);

  if (user?.Role !== 'admin') {
    return (
      <View style={styles.centerContainer}>
        <Text style={{ fontSize: 16, color: '#64748B' }}>Only Admin can view the feed in this dashboard.</Text>
      </View>
    );
  }

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
        <Text style={styles.title}>Competitor Intel Feed</Text>
      </View>

      <ScrollView style={styles.feedContainer}>
        {intelFeed.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No competitor intel logged yet.</Text>
          </View>
        ) : (
          intelFeed.map((intel, index) => (
            <View key={intel.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.indexText}>{(index + 1).toString().padStart(2, '0')}.</Text>
                <View style={styles.rateContainer}>
                  <IndianRupee size={16} color="#1A1A1A" />
                  <Text style={styles.rateText}>{intel.rate_per_bag}/bag</Text>
                </View>
              </View>

              <View style={styles.cardBody}>
                <Text style={styles.competitorName}>{intel.competitor_name}</Text>
                <View style={styles.salesRepRow}>
                  <User size={14} color="#64748B" />
                  <Text style={styles.salesRepName}>{intel.sales_rep_name}</Text>
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

      {/* Image Modal */}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  feedContainer: {
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
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  indexText: {
    fontSize: 32,
    fontWeight: '300',
    color: '#E2E8F0',
  },
  rateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  cardBody: {
    gap: 4,
  },
  competitorName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  salesRepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  salesRepName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  dateText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  notesBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
  },
  notesText: {
    fontSize: 14,
    color: '#475569',
    flex: 1,
  },
  viewImageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1A1A1A',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 'auto',
  },
  viewImageText: {
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
});
