import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Download } from 'lucide-react-native';
import { exportToExcel } from '../utils/exportToExcel';

export const ExportButton = ({ data, filename, sheetName }) => {
  return (
    <TouchableOpacity 
      style={styles.button}
      onPress={() => exportToExcel(data, filename, sheetName)}
      activeOpacity={0.7}
    >
      <Download size={16} color="#1A1A1A" />
      <Text style={styles.text}>Export Excel</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  }
});
