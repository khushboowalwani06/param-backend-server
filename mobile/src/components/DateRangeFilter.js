import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { Calendar, X } from 'lucide-react-native';
import { useLanguage } from '../context/LanguageContext';

export const DateRangeFilter = ({ startDate, endDate, onDateChange, onClear, style = {} }) => {
  const { t } = useLanguage();
  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconContainer}>
        <Calendar size={16} color="#8E8E93" />
      </View>
      
      <View style={styles.inputGroup}>
        <TextInput 
          value={startDate}
          onChangeText={(text) => onDateChange({ startDate: text, endDate })}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#C7C7CC"
          style={styles.input}
        />
        <Text style={styles.separator}>{t('to')}</Text>
        <TextInput 
          value={endDate}
          onChangeText={(text) => onDateChange({ startDate, endDate: text })}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#C7C7CC"
          style={styles.input}
        />
      </View>

      {(startDate || endDate) ? (
        <TouchableOpacity 
          onPress={onClear}
          style={styles.clearButton}
        >
          <X size={14} color="#8E8E93" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    backgroundColor: '#FFFFFF',
    padding: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  iconContainer: {
    paddingHorizontal: 8,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  input: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3A3A3C',
    backgroundColor: 'transparent',
    padding: 0,
    minWidth: 80,
  },
  separator: {
    color: '#8E8E93',
    fontSize: 12,
  },
  clearButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    marginLeft: 4,
  }
});
