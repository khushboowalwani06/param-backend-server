import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet, SafeAreaView } from 'react-native';
import { MapPin, ChevronDown, X } from 'lucide-react-native';
import { useLanguage } from '../context/LanguageContext';

export const LocationFilter = ({ value, onChange, locations = [] }) => {
  const { t } = useLanguage();
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <View>
      <TouchableOpacity 
        style={styles.container} 
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
      >
        <MapPin size={16} color="#8E8E93" style={styles.iconLeft} />
        <Text style={[styles.text, !value && { color: '#C7C7CC' }]}>
          {value || 'All Locations'}
        </Text>
        <ChevronDown size={16} color="#8E8E93" style={styles.iconRight} />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('Select Location')}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={{top:10, bottom:10, left:10, right:10}}>
                <X size={20} color="#1A1A1A" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={['', ...locations]}
              keyExtractor={(item, index) => `${item}-${index}`}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[styles.optionItem, value === item && styles.optionItemSelected]}
                  onPress={() => {
                    onChange(item);
                    setModalVisible(false);
                  }}
                >
                  <Text style={[styles.optionText, value === item && styles.optionTextSelected]}>
                    {item === '' ? 'All Locations' : item}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minWidth: 200,
  },
  iconLeft: {
    marginRight: 8,
  },
  text: {
    flex: 1,
    fontSize: 14,
    color: '#1A1A1A',
  },
  iconRight: {
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  optionItem: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  optionItemSelected: {
    backgroundColor: '#F8F9FA',
  },
  optionText: {
    fontSize: 16,
    color: '#1A1A1A',
  },
  optionTextSelected: {
    fontWeight: '600',
    color: '#007AFF',
  }
});
