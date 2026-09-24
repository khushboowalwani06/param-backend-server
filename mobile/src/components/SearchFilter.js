import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Search, X } from 'lucide-react-native';

export const SearchFilter = ({ value, onChange, placeholder = "Search orders, customers..." }) => {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Search size={16} color="#8E8E93" />
      </View>
      <TextInput 
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#C7C7CC"
        style={styles.input}
      />
      {value ? (
        <TouchableOpacity 
          onPress={() => onChange('')}
          style={styles.clearButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <X size={16} color="#8E8E93" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
    maxWidth: 400,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  iconContainer: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1A1A1A',
  },
  clearButton: {
    marginLeft: 8,
  }
});
