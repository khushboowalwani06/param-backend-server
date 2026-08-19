import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Bell } from 'lucide-react-native';

export default function HeaderRight() {
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.langSwitch}>
        <Text style={[styles.langText, styles.activeLang]}>EN</Text>
        <Text style={styles.langText}>GU</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.iconBtn}>
        <Bell size={20} color="#1A1A1A" />
        <View style={styles.badge} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    gap: 16,
  },
  langSwitch: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 999,
    padding: 2,
    ...Platform.select({
      web: { display: 'flex' }, // Hide on very small screens via CSS ideally, but here just show
      default: { display: 'flex' }
    })
  },
  langText: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  activeLang: {
    backgroundColor: '#1A1A1A',
    color: '#FFF',
    borderRadius: 999,
  },
  iconBtn: {
    padding: 8,
    position: 'relative',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 8,
    width: 8,
    height: 8,
    backgroundColor: '#EF4444',
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#FFF',
  },
});
