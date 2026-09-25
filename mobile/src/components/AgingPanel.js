import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, Platform } from 'react-native';
import { Clock, Save, X } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { sheetsService } from '../services/sheetsService';
import { useLanguage } from '../context/LanguageContext';

export default function AgingPanel({ customer, onUpdate }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isReceivingPayment, setIsReceivingPayment] = useState(false);
  const [isAdjustingOutstanding, setIsAdjustingOutstanding] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [outstandingAdjustment, setOutstandingAdjustment] = useState('');
  const [outstandingReason, setOutstandingReason] = useState('');
  const [editReason, setEditReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const [editValues, setEditValues] = useState({
    Bkt0_1: '', Bkt2_4: '', Bkt5_5: '', Bkt6_7: '', Bkt8_15: '', Bkt16_20: '', Bkt21_Above: ''
  });

  useEffect(() => {
    if (customer) {
      setEditValues({
        Bkt0_1: String(customer.Bkt0_1 || ''),
        Bkt2_4: String(customer.Bkt2_4 || ''),
        Bkt5_5: String(customer.Bkt5_5 || ''),
        Bkt6_7: String(customer.Bkt6_7 || ''),
        Bkt8_15: String(customer.Bkt8_15 || ''),
        Bkt16_20: String(customer.Bkt16_20 || ''),
        Bkt21_Above: String(customer.Bkt21_Above || '')
      });
      setPaymentAmount('');
      setOutstandingAdjustment('');
      setOutstandingReason('');
    }
  }, [customer, isEditing, isReceivingPayment, isAdjustingOutstanding]);

  if (!customer) return null;

  const canEdit = user?.Role === 'admin' || user?.Role === 'accountant';
  // Fallback to 1,000,000 for testing if no credit limit is set
  const creditLimit = parseFloat(customer.CreditLimit) > 0 ? parseFloat(customer.CreditLimit) : 1000000;

  const projectedBuckets = { ...editValues };
  const dbOutstanding = parseFloat(customer.OutstandingAmount || 0);
  const currentTotal = dbOutstanding;
  const currentAbove21 = parseFloat(projectedBuckets.Bkt21_Above || customer.Bkt21_Above || 0);
  const currentHeadroom = Math.max(0, creditLimit - currentTotal);

  const bucketsConfig = [
    { key: 'Bkt0_1', label: 'Day 1' },
    { key: 'Bkt2_4', label: 'Days 2-4' },
    { key: 'Bkt5_5', label: 'Day 5' },
    { key: 'Bkt6_7', label: 'Days 6-7' },
    { key: 'Bkt8_15', label: 'Days 8-15' },
    { key: 'Bkt16_20', label: 'Days 16-20' }
  ];

  const handleSave = async () => {
    if (isReceivingPayment) {
      const amt = parseFloat(paymentAmount);
      if (!paymentAmount || isNaN(amt) || amt <= 0) {
        Alert.alert('Error', 'Please enter a valid payment amount greater than 0.');
        return;
      }
      if (Math.round(amt * 100) > Math.round(dbOutstanding * 100)) {
        Alert.alert('Error', `Payment ₹${amt.toLocaleString()} exceeds outstanding ₹${dbOutstanding.toLocaleString()}.`);
        return;
      }
      setIsSaving(true);
      try {
        await sheetsService.recordPayment(user, customer.UserID, amt);
        Alert.alert('Success', `Payment of ₹${amt.toLocaleString()} recorded successfully.`);
        setIsReceivingPayment(false);
        if (onUpdate) onUpdate();
      } catch (err) {
        Alert.alert('Error', err.message || 'Failed to record payment');
      } finally {
        setIsSaving(false);
      }
    } else {
      if (!editReason.trim()) {
         Alert.alert('Error', 'Please provide a reason for this manual adjustment.');
         return;
      }
      setIsSaving(true);
      try {
        const bucketMapping = {
          Bkt0_1: 'DAY_1', Bkt2_4: 'DAY_2_4', Bkt5_5: 'DAY_5', Bkt6_7: 'DAY_6_7',
          Bkt8_15: 'DAY_8_15', Bkt16_20: 'DAY_16_20', Bkt21_Above: 'DAY_21_ABOVE'
        };
        const adjustments = [];
        for (const [key, dbBucket] of Object.entries(bucketMapping)) {
          const oldVal = parseFloat(customer[key]) || 0;
          const newVal = parseFloat(editValues[key]) || 0;
          if (oldVal !== newVal) {
             adjustments.push({ bucket: dbBucket, amount: newVal - oldVal });
          }
        }
        if (adjustments.length > 0) {
           await sheetsService.recordAdjustment(user, customer.UserID, adjustments, editReason);
           Alert.alert('Success', 'Ageing buckets adjusted successfully.');
        } else {
           Alert.alert('Info', 'No changes were made to the buckets.');
        }
        setIsEditing(false);
        if (onUpdate) onUpdate();
      } catch (err) {
        Alert.alert('Error', err.message || 'Failed to update ageing buckets');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleAdjustOutstanding = async () => {
    const rawVal = parseFloat(outstandingAdjustment);
    if (isNaN(rawVal) || rawVal === 0) {
      Alert.alert('Error', 'Please enter a valid amount.');
      return;
    }
    const trimmedReason = outstandingReason.trim();
    if (!trimmedReason || trimmedReason.length < 15) {
      Alert.alert('Error', 'Please provide a reason (min 15 chars) for this adjustment.');
      return;
    }
    setIsSaving(true);
    try {
      await sheetsService.recordAdjustment(user, customer.UserID, [{ bucket: 'DAY_1', amount: rawVal }], trimmedReason);
      Alert.alert('Success', `Outstanding adjusted by ₹${Math.abs(rawVal).toLocaleString()}.`);
      setIsAdjustingOutstanding(false);
      if (onUpdate) onUpdate();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to adjust outstanding balance');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (key, val) => {
    setEditValues(prev => ({ ...prev, [key]: val }));
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Clock size={20} color="#1A1A1A" />
          <Text style={styles.title}>{t('Ageing & Credit Overview')}</Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t('Limit:')} <Text style={styles.summaryValue}>₹{creditLimit.toLocaleString()}</Text></Text>
          <Text style={styles.summaryLabel}>{t('Outstanding:')} <Text style={[styles.summaryValue, { color: currentTotal > creditLimit ? '#EF4444' : '#F59E0B' }]}>₹{currentTotal.toLocaleString()}</Text></Text>
          <Text style={styles.summaryLabel}>{t('Spendable:')} <Text style={[styles.summaryValue, { color: currentHeadroom === 0 ? '#EF4444' : '#10B981' }]}>₹{currentHeadroom.toLocaleString()}</Text></Text>
        </View>

        {canEdit && !isEditing && !isReceivingPayment && !isAdjustingOutstanding && (
          <View style={styles.actionButtons}>
            <TouchableOpacity onPress={() => setIsReceivingPayment(true)} style={[styles.btn, { backgroundColor: '#10B981' }]}>
              <Text style={styles.btnText}>{t('Record Payment')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIsAdjustingOutstanding(true)} style={[styles.btn, { backgroundColor: '#E2E8F0' }]}>
              <Text style={[styles.btnText, { color: '#1A1A1A' }]}>{t('Add Outstanding')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {isReceivingPayment && (
          <View style={styles.formRow}>
            <TextInput 
              style={styles.input}
              value={paymentAmount}
              onChangeText={setPaymentAmount}
              placeholder="₹ 0"
              keyboardType="numeric"
            />
            <TouchableOpacity onPress={() => setIsReceivingPayment(false)} style={[styles.iconBtn, { backgroundColor: '#E2E8F0' }]}>
              <X size={16} color="#1A1A1A" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} disabled={isSaving} style={[styles.iconBtn, { backgroundColor: '#1A1A1A' }]}>
              <Save size={16} color="#FFF" />
            </TouchableOpacity>
          </View>
        )}

        {isAdjustingOutstanding && (
          <View style={styles.formRow}>
            <TextInput 
              style={styles.input}
              value={outstandingAdjustment}
              onChangeText={setOutstandingAdjustment}
              placeholder="Amount"
              keyboardType="numbers-and-punctuation"
            />
            <TextInput 
              style={[styles.input, { flex: 2 }]}
              value={outstandingReason}
              onChangeText={setOutstandingReason}
              placeholder="Reason (min 15 chars)"
            />
            <TouchableOpacity onPress={() => setIsAdjustingOutstanding(false)} style={[styles.iconBtn, { backgroundColor: '#E2E8F0' }]}>
              <X size={16} color="#1A1A1A" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleAdjustOutstanding} disabled={isSaving} style={[styles.iconBtn, { backgroundColor: '#1A1A1A' }]}>
              <Save size={16} color="#FFF" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.bucketsContainer}>
        {bucketsConfig.map((b) => (
          <View key={b.key} style={styles.bucketCard}>
            <Text style={styles.bucketLabel}>{b.label}</Text>
            {isEditing ? (
              <TextInput 
                style={styles.bucketInput}
                value={editValues[b.key]}
                onChangeText={(val) => handleChange(b.key, val)}
                keyboardType="numeric"
              />
            ) : (
              <Text style={[styles.bucketValue, (Number(projectedBuckets[b.key]) || 0) === 0 && { color: '#94A3B8' }]}>
                ₹{(Number(projectedBuckets[b.key]) || 0).toLocaleString()}
              </Text>
            )}
          </View>
        ))}
        
        <View style={[styles.bucketCard, currentAbove21 > 0 ? styles.bucketCardDanger : null]}>
          <Text style={[styles.bucketLabel, currentAbove21 > 0 ? { color: '#EF4444' } : null]}>{t('Above 21 Days')}</Text>
          {isEditing ? (
            <TextInput 
              style={[styles.bucketInput, currentAbove21 > 0 ? { borderColor: '#EF4444', color: '#EF4444' } : null]}
              value={editValues.Bkt21_Above}
              onChangeText={(val) => handleChange('Bkt21_Above', val)}
              keyboardType="numeric"
            />
          ) : (
            <Text style={[styles.bucketValue, currentAbove21 > 0 ? { color: '#EF4444' } : { color: '#94A3B8' }]}>
              ₹{currentAbove21.toLocaleString()}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 16,
    overflow: 'hidden',
  },
  header: {
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  summaryValue: {
    fontWeight: '600',
    color: '#1A1A1A',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  btnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFF',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 4,
    fontSize: 14,
  },
  iconBtn: {
    padding: 6,
    borderRadius: 4,
  },
  bucketsContainer: {
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  bucketCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    flex: 1,
    minWidth: 80,
  },
  bucketCardDanger: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
  },
  bucketLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 8,
    textAlign: 'center',
  },
  bucketValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  bucketInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFF',
    padding: 4,
    borderRadius: 4,
    fontSize: 14,
    textAlign: 'center',
    width: '100%',
  },
});
