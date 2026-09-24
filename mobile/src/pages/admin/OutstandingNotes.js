import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { sheetsService } from '../../services/sheetsService';
import { useAuth } from '../../context/AuthContext';
import { CardSkeleton } from '../../components/Skeleton';
import { FileText } from 'lucide-react-native';
import { Pagination } from '../../components/Pagination';

export const OutstandingNotes = () => {
  const { user } = useAuth();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const data = await sheetsService.getOutstandingNotes(user);
        setNotes(data || []);
      } catch (err) {
        console.error('Failed to load notes', err);
      } finally {
        setLoading(false);
      }
    };
    fetchNotes();
  }, [user]);

  const totalPages = Math.ceil(notes.length / itemsPerPage);
  const paginatedNotes = notes.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (loading) return <View style={{padding: 16}}><CardSkeleton /><CardSkeleton /></View>;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Outstanding Notes</Text>
        <Text style={styles.headerSub}>Log of all manual adjustments to outstanding balances and their mandatory reasons.</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          {notes.length === 0 ? (
            <View style={styles.emptyState}>
              <FileText size={48} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No Outstanding Notes Yet</Text>
              <Text style={styles.emptySub}>Manual adjustments will appear here.</Text>
            </View>
          ) : (
            <>
              {paginatedNotes.map(note => (
                <View key={note.adjustment_id} style={styles.noteItem}>
                  <View style={styles.noteHeader}>
                    <Text style={styles.noteDate}>{note.created_at ? new Date(note.created_at).toLocaleString() : 'N/A'}</Text>
                    <Text style={[styles.noteAmt, { color: Number(note.amount) > 0 ? '#DC2626' : '#16A34A' }]}>
                      {Number(note.amount) > 0 ? '+' : ''}₹{Number(note.amount).toLocaleString('en-IN')}
                    </Text>
                  </View>
                  <View style={styles.noteCustInfo}>
                    <Text style={styles.noteCustName}>{note.profiles?.name || 'Unknown'}</Text>
                    <Text style={styles.noteCustDetails}>{note.profiles?.company || note.profiles?.user_id}</Text>
                  </View>
                  <View style={styles.noteReasonBox}>
                    <Text style={styles.noteReason}>"{note.reason}"</Text>
                  </View>
                </View>
              ))}
              
              {notes.length > 0 && (
                <View style={styles.paginationBox}>
                  <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                </View>
              )}
            </>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E5EA' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  headerSub: { fontSize: 14, color: '#8E8E93', lineHeight: 20 },
  
  content: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: '#FFF', borderRadius: 16, borderWidth: 1, borderColor: '#E5E5EA', overflow: 'hidden' },
  
  emptyState: { padding: 48, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginTop: 16, marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#8E8E93' },
  
  noteItem: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E5EA' },
  noteHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  noteDate: { fontSize: 12, color: '#8E8E93', fontWeight: '500' },
  noteAmt: { fontSize: 16, fontWeight: '700' },
  noteCustInfo: { marginBottom: 12 },
  noteCustName: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  noteCustDetails: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
  noteReasonBox: { backgroundColor: '#F8F9FA', padding: 12, borderRadius: 8 },
  noteReason: { fontSize: 14, fontStyle: 'italic', color: '#1A1A1A' },
  
  paginationBox: { padding: 16 }
});
