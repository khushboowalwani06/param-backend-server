import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useLanguage } from '../context/LanguageContext';

export const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  const { t } = useLanguage();
  if (totalPages <= 1) return null;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, currentPage === 1 && styles.buttonDisabled]}
        onPress={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        <ChevronLeft size={16} color={currentPage === 1 ? '#C7C7CC' : '#1A1A1A'} />
        <Text style={[styles.buttonText, currentPage === 1 && styles.buttonTextDisabled]}>{t('Previous')}</Text>
      </TouchableOpacity>
      
      <Text style={styles.pageText}>
        Page {currentPage} of {totalPages}
      </Text>
      
      <TouchableOpacity
        style={[styles.button, currentPage === totalPages && styles.buttonDisabled]}
        onPress={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        <Text style={[styles.buttonText, currentPage === totalPages && styles.buttonTextDisabled]}>{t('Next')}</Text>
        <ChevronRight size={16} color={currentPage === totalPages ? '#C7C7CC' : '#1A1A1A'} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 4,
  },
  buttonDisabled: {
    backgroundColor: '#F2F2F7',
    borderColor: '#E5E5EA',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  buttonTextDisabled: {
    color: '#C7C7CC',
  },
  pageText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
  }
});
