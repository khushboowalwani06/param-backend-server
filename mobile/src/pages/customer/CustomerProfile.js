import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { User, Mail, Phone, MapPin, Briefcase, Save, Edit2, X } from 'lucide-react-native';
import { sheetsService } from '../../services/sheetsService';
import { useLanguage } from '../../context/LanguageContext';

export default function CustomerProfile() {
  const { t } = useLanguage();
  const { user, updateUser } = useAuth();
  
  const [formData, setFormData] = useState({
    Name: user?.Name || '',
    Email: user?.Email || '',
    Phone: user?.Phone || '',
    Company: user?.Company || user?.BusinessName || '',
    Address: user?.Address || user?.Region || ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const hasChanges = 
    formData.Name !== (user?.Name || '') ||
    formData.Email !== (user?.Email || '') ||
    formData.Phone !== (user?.Phone || '') ||
    formData.Company !== (user?.Company || user?.BusinessName || '') ||
    formData.Address !== (user?.Address || user?.Region || '');

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await sheetsService.updateProfile(user, {
        Name: formData.Name,
        Email: formData.Email,
        Phone: formData.Phone,
        Company: formData.Company,
        Address: formData.Address
      });
      
      const mergedUser = { ...user, ...formData };
      await updateUser(mergedUser);
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', err.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(user?.Name || user?.Email || 'U').charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{user?.Name || 'User Name'}</Text>
        <Text style={styles.role}>{user?.Role || 'Customer'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('Account Details')}</Text>
        
        <View style={styles.infoRow}>
          <User size={20} color="#64748B" />
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoLabel}>{t('Full Name')}</Text>
            <TextInput
              style={[styles.infoInput, !isEditing && styles.infoInputDisabled]}
              value={formData.Name}
              onChangeText={val => setFormData({ ...formData, Name: val })}
              placeholder="Enter your full name"
              placeholderTextColor="#94A3B8"
              editable={isEditing}
            />
          </View>
        </View>

        <View style={styles.infoRow}>
          <Mail size={20} color="#64748B" />
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoLabel}>{t('Email')}</Text>
            <TextInput
              style={[styles.infoInput, !isEditing && styles.infoInputDisabled]}
              value={formData.Email}
              onChangeText={val => setFormData({ ...formData, Email: val })}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#94A3B8"
              editable={isEditing}
            />
          </View>
        </View>
        
        <View style={styles.infoRow}>
          <Phone size={20} color="#64748B" />
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoLabel}>{t('Phone')}</Text>
            <TextInput
              style={[styles.infoInput, !isEditing && styles.infoInputDisabled]}
              value={formData.Phone}
              onChangeText={val => setFormData({ ...formData, Phone: val })}
              placeholder="Enter your phone number"
              keyboardType="phone-pad"
              placeholderTextColor="#94A3B8"
              editable={isEditing}
            />
          </View>
        </View>

        <View style={styles.infoRow}>
          <Briefcase size={20} color="#64748B" />
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoLabel}>{t('Company / Business')}</Text>
            <TextInput
              style={[styles.infoInput, !isEditing && styles.infoInputDisabled]}
              value={formData.Company}
              onChangeText={val => setFormData({ ...formData, Company: val })}
              placeholder="Enter your company name"
              placeholderTextColor="#94A3B8"
              editable={isEditing}
            />
          </View>
        </View>

        <View style={styles.infoRow}>
          <MapPin size={20} color="#64748B" />
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoLabel}>{t('Location / Region')}</Text>
            <TextInput
              style={[styles.infoInput, !isEditing && styles.infoInputDisabled]}
              value={formData.Address}
              onChangeText={val => setFormData({ ...formData, Address: val })}
              placeholder="Enter your address"
              placeholderTextColor="#94A3B8"
              editable={isEditing}
            />
          </View>
        </View>
      </View>

      {isEditing ? (
        <View style={styles.editActions}>
          <TouchableOpacity 
            style={[styles.cancelBtn]}
            onPress={() => {
              // Revert changes
              setFormData({
                Name: user?.Name || '',
                Email: user?.Email || '',
                Phone: user?.Phone || '',
                Company: user?.Company || user?.BusinessName || '',
                Address: user?.Address || user?.Region || ''
              });
              setIsEditing(false);
            }}
            disabled={isSaving}
          >
            <X size={20} color="#1A1A1A" />
            <Text style={styles.cancelBtnText}>{t('Cancel')}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.saveBtn, (!hasChanges || isSaving) && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!hasChanges || isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Save size={20} color="#FFF" />
                <Text style={styles.saveBtnText}>{t('Save')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity 
          style={styles.editBtn}
          onPress={() => setIsEditing(true)}
        >
          <Edit2 size={20} color="#FFF" />
          <Text style={styles.editBtnText}>{t('Edit Profile')}</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 30,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: 'bold',
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 5,
  },
  role: {
    fontSize: 16,
    color: '#64748B',
    textTransform: 'capitalize',
  },
  section: {
    backgroundColor: '#FFFFFF',
    margin: 15,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  infoTextContainer: {
    marginLeft: 15,
    flex: 1,
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    color: '#1E293B',
    fontWeight: '500',
  },
  infoInput: {
    fontSize: 15,
    color: '#1E293B',
    fontWeight: '500',
    padding: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 4,
  },
  infoInputDisabled: {
    borderBottomWidth: 0,
    color: '#475569',
  },
  editBtn: {
    backgroundColor: '#1A1A1A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 15,
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  editBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  editActions: {
    flexDirection: 'row',
    margin: 15,
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  cancelBtnText: {
    color: '#1A1A1A',
    fontSize: 16,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 2,
    backgroundColor: '#1A1A1A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  saveBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  }
});
