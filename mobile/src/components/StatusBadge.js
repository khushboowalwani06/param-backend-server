import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLanguage } from '../context/LanguageContext';

export const StatusBadge = ({ status }) => {
  const { tDynamic } = useLanguage();
  let badgeStyle = { backgroundColor: '#F2F2F7', color: '#475569' }; 
  const safeStatus = status || 'Unknown';
  
  if (safeStatus === 'Pending Sales Approval') {
    badgeStyle = { backgroundColor: '#fef3c7', color: '#d97706' }; 
  } else if (safeStatus === 'Pending Admin Approval') {
    badgeStyle = { backgroundColor: '#ffedd5', color: '#ea580c' }; 
  } else if (safeStatus === 'Ready for Dispatch') {
    badgeStyle = { backgroundColor: '#F2F2F7', color: '#475569' }; 
  } else if (safeStatus.includes('Dispatch') || safeStatus.includes('Transit')) {
    badgeStyle = { backgroundColor: '#dbeafe', color: '#2563eb' }; 
  } else if (safeStatus.includes('Delivered') || safeStatus.includes('Closed') || safeStatus.includes('Payment Verified') || safeStatus.includes('Verified')) {
    badgeStyle = { backgroundColor: '#dcfce7', color: '#16a34a' }; 
  } else if (safeStatus.includes('Rejected') || safeStatus.includes('Overdue')) {
    badgeStyle = { backgroundColor: '#fee2e2', color: '#dc2626' }; 
  } else if (safeStatus.includes('Payment Pending') || safeStatus.includes('Pending Invoice')) {
    badgeStyle = { backgroundColor: '#fef9c3', color: '#ca8a04' }; 
  }

  return (
    <View style={[styles.badge, { backgroundColor: badgeStyle.backgroundColor }]}>
      <Text style={[styles.text, { color: badgeStyle.color }]}>
        {tDynamic(safeStatus)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 9999,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  }
});
