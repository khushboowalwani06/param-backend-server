import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator, Platform } from 'react-native';
import { sheetsService } from '../../services/sheetsService';
import { Mail, Building, Phone, Briefcase, Calendar } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { SearchFilter } from '../../components/SearchFilter';
import { useRealtime } from '../../hooks/useRealtime';
import { CardSkeleton } from '../../components/Skeleton';
import { Pagination } from '../../components/Pagination';
import { Picker } from '@react-native-picker/picker';
import { useLanguage } from '../../context/LanguageContext';

const districts = [
'Ahmedabad', 'Amreli', 'Anand', 'Aravalli', 'Banaskantha', 'Bharuch', 'Bhavnagar', 'Botad', 'Chhota Udaipur',
'Dahod', 'Dang', 'Devbhoomi Dwarka', 'Gandhinagar', 'Gir Somnath', 'Jamnagar', 'Junagadh', 'Kheda', 'Kutch',
'Mahisagar', 'Mehsana', 'Morbi', 'Narmada', 'Navsari', 'Panchmahal', 'Patan', 'Porbandar', 'Rajkot', 'Sabarkantha',
'Surat', 'Surendranagar', 'Tapi', 'Vadodara', 'Valsad'];


export const AdminTeam = () => {
  const { t, tDynamic } = useLanguage();
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('roles');
  const [refreshKey, setRefreshKey] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const [isCreating, setIsCreating] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    name: '', email: '', password: '', role: 'sales', company: '', phone: '', address: '', city: '', district: '', tehsil: ''
  });

  const [orders, setOrders] = useState([]);
  const [visits, setVisits] = useState([]);

  useRealtime(['profiles'], () => setRefreshKey((k) => k + 1));

  useEffect(() => {
    fetchUsers();
  }, [refreshKey]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeTab]);

  const fetchUsers = async () => {
    try {
      const [data, ordersData, visitsData] = await Promise.all([
      sheetsService.getAllUsers(user),
      sheetsService.getOrders(user),
      sheetsService.getVisits().catch(() => [])]
      );
      setUsers(data);
      setOrders(ordersData);
      setVisits(visitsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubmit = async () => {
    const { name, email, password, phone } = createFormData;
    if (!name.trim() || !email.trim() || !password.trim() || !phone.trim()) {
      return Alert.alert(t("Error"), t("Name, Email, Password, and Phone are required."));
    }
    if (phone.trim().length < 10) {
      return Alert.alert(t("Error"), t("Phone number must be at least 10 digits."));
    }
    setIsCreating(true);
    try {
      await sheetsService.adminCreateUser(user, createFormData);
      Alert.alert(t("Success"), t("User created successfully!"));
      setCreateFormData({ name: '', email: '', password: '', role: 'sales', company: '', phone: '', address: '', city: '', district: '', tehsil: '' });
      setActiveTab('roles');
      fetchUsers();
    } catch (err) {
      Alert.alert(t("Error"), 'Failed to create user: ' + err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    setUpdatingId(userId);
    try {
      await sheetsService.updateUserRole(user, userId, newRole);
      await fetchUsers();
    } catch (err) {
      Alert.alert(t("Error"), 'Failed to update role: ' + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleAssignmentChange = async (userId, newSalesRepId) => {
    setUpdatingId(userId);
    try {
      await sheetsService._fetch(`/users/${userId}/profile`, {
        method: 'PATCH',
        body: JSON.stringify({ AssignedSalesRep: newSalesRepId })
      });
      await fetchUsers();
    } catch (err) {
      Alert.alert(t("Error"), 'Failed to update assignment: ' + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) return <View style={{ padding: 16 }}><CardSkeleton /><CardSkeleton /></View>;

  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase();
    return (
      u.Name?.toLowerCase().includes(term) ||
      u.UserID?.toLowerCase().includes(term) ||
      u.Company?.toLowerCase().includes(term) ||
      u.Email?.toLowerCase().includes(term));

  });

  const salesReps = users.filter((u) => u.Role === 'sales');
  const customerUsers = users.filter((u) => ['customer', 'dealer', 'retailer'].includes(u.Role));

  const filteredCustomers = customerUsers.filter((u) => {
    const term = searchTerm.toLowerCase();
    const rep = salesReps.find((r) => r.UserID === u.AssignedSalesRep);
    const repName = rep ? rep.Name?.toLowerCase() : '';
    return (
      u.Name?.toLowerCase().includes(term) ||
      u.UserID?.toLowerCase().includes(term) ||
      u.Company?.toLowerCase().includes(term) ||
      repName?.includes(term));

  });

  const getRepMonthlyVolume = (repId) => {
    let thisMonthVolume = 0;
    const now = new Date();
    orders.forEach((o) => {
      let ts = o.OrderTimestamp;
      if (!ts) return;
      if (!ts.endsWith('Z') && !ts.includes('+')) ts += 'Z';

      const orderDate = new Date(ts);
      const isCurrentMonth = orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();

      const customer = users.find((u) => u.UserID === o.UserID);
      const isAssigned = customer && customer.AssignedSalesRep === repId;

      if (isCurrentMonth && (o.SalesApproverID === repId || isAssigned) && o.ApprovalStatus !== t("Sales Rejected") && o.ApprovalStatus !== t("Admin Rejected")) {
        const qty = Number(o.EstimateQty) || 0;
        thisMonthVolume += o.Unit === 'Bags' ? qty / 20 : qty;
      }
    });
    return Math.round(thisMonthVolume * 100) / 100;
  };

  const filteredVisits = visits.filter((v) => {
    const term = searchTerm.toLowerCase();
    const rep = salesReps.find((r) => r.UserID === (v.salesRepId || v.sales_rep_id));
    const repName = rep ? rep.Name?.toLowerCase() : '';
    return (
      v.retailerName?.toLowerCase().includes(term) ||
      repName?.includes(term) ||
      v.remarks?.toLowerCase().includes(term) ||
      (v.retailerId || v.retailer_id)?.toLowerCase().includes(term));

  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  const getPaginated = (list) => list.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const paginatedUsers = getPaginated(filteredUsers);
  const totalUserPages = Math.ceil(filteredUsers.length / itemsPerPage);

  const paginatedCustomers = getPaginated(filteredCustomers);
  const totalCustomerPages = Math.ceil(filteredCustomers.length / itemsPerPage);

  const paginatedVisits = getPaginated(filteredVisits);
  const totalVisitPages = Math.ceil(filteredVisits.length / itemsPerPage);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('Team & Assignments')}</Text>
        <Text style={styles.headerSub}>{t('Manage user access roles and territory sales representative assignments.')}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
        {['roles', 'assignments', 'visits', 'create'].map((tab) =>
        <TouchableOpacity
          key={tab}
          style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
          onPress={() => setActiveTab(tab)}>
          
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'roles' ? t("Role Access Control") :
            tab === 'assignments' ? t("Sales Assignments") :
            tab === 'visits' ? t("Sales Visits") : t("Create Member")}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {activeTab !== 'create' &&
      <View style={styles.searchWrapper}>
          <SearchFilter value={searchTerm} onChange={setSearchTerm} placeholder={t("Search...")} />
        </View>
      }

      <View style={styles.content}>
        {activeTab === 'roles' &&
        <View>
            {paginatedUsers.map((u) =>
          <View key={u.UserID} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.avatar}><Text style={styles.avatarText}>{u.Name?.charAt(0) || 'U'}</Text></View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.userName} numberOfLines={1}>{tDynamic(u.Name)}</Text>
                    <Text style={styles.userId} numberOfLines={1}>{t("ID:")} {u.UserID}</Text>
                    <View style={styles.iconRow}><Building size={12} color="#8E8E93" /><Text style={styles.iconText} numberOfLines={1}>{tDynamic(u.Company) || t("No Company")}</Text></View>
                  </View>
                </View>

                <View style={styles.cardDetails}>
                  <View style={styles.iconRow}><Mail size={14} color="#8E8E93" /><Text style={styles.iconText} numberOfLines={1}>{u.Email}</Text></View>
                  {u.Phone ? <View style={styles.iconRow}><Phone size={14} color="#8E8E93" /><Text style={styles.iconText} numberOfLines={1}>{u.Phone}</Text></View> : null}
                  {u.Role === 'sales' &&
              <View style={styles.iconRow}><Briefcase size={14} color="#0284C7" /><Text style={[styles.iconText, { color: '#0284C7', fontWeight: '600' }]} numberOfLines={1}>{t("MTD Vol:")} {getRepMonthlyVolume(u.UserID)} {t("/ 250 Tons")}</Text></View>
              }
                </View>

                <View>
                  <Text style={styles.pickerLabel}>{t('Access Role')}</Text>
                  <View style={styles.pickerContainer}>
                    {updatingId === u.UserID && <ActivityIndicator style={styles.loader} size="small" />}
                    <Picker
                  selectedValue={u.Role}
                  onValueChange={(val) => handleRoleChange(u.UserID, val)}
                  enabled={updatingId !== u.UserID}
                  style={{ height: Platform.OS === 'ios' ? 150 : 50, opacity: updatingId === u.UserID ? 0.5 : 1, color: '#1A1A1A' }}>
                  
                      <Picker.Item label={t("Customer / Retailer")} value="customer" />
                      <Picker.Item label={t("Sales Representative")} value="sales" />
                      <Picker.Item label={t("Accountant")} value="accountant" />
                      <Picker.Item label={t("Administrator")} value="admin" />
                    </Picker>
                  </View>
                </View>
              </View>
          )}
            {paginatedUsers.length === 0 && <Text style={styles.noData}>{t('No users found.')}</Text>}
            <Pagination currentPage={currentPage} totalPages={totalUserPages} onPageChange={setCurrentPage} />
          </View>
        }

        {activeTab === 'assignments' &&
        <View>
            {paginatedCustomers.map((u) =>
          <View key={u.UserID} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardInfo}>
                    <Text style={styles.userName} numberOfLines={1}>{tDynamic(u.Name)}</Text>
                    <Text style={styles.userId} numberOfLines={1}>{tDynamic(u.Company)} {t("(ID:")} {u.UserID})</Text>
                  </View>
                  <View style={styles.segmentBadge}><Text style={styles.segmentText}>{u.Segment || t("Trade")}</Text></View>
                </View>

                <View>
                  <Text style={styles.pickerLabel}>{t('Assigned Sales Rep')}</Text>
                  <View style={styles.pickerContainer}>
                    {updatingId === u.UserID && <ActivityIndicator style={styles.loader} size="small" />}
                    <Picker
                  selectedValue={u.AssignedSalesRep || ''}
                  onValueChange={(val) => handleAssignmentChange(u.UserID, val)}
                  enabled={updatingId !== u.UserID}
                  style={{ height: Platform.OS === 'ios' ? 150 : 50, opacity: updatingId === u.UserID ? 0.5 : 1, color: '#1A1A1A' }}>
                  
                      <Picker.Item label={t("-- Unassigned --")} value="" />
                      {salesReps.map((rep) => <Picker.Item key={rep.UserID} label={tDynamic(rep.Name)} value={rep.UserID} />)}
                    </Picker>
                  </View>
                </View>
              </View>
          )}
            {paginatedCustomers.length === 0 && <Text style={styles.noData}>{t('No customers found.')}</Text>}
            <Pagination currentPage={currentPage} totalPages={totalCustomerPages} onPageChange={setCurrentPage} />
          </View>
        }

        {activeTab === 'visits' &&
        <View>
            {paginatedVisits.map((v) => {
            const rep = salesReps.find((r) => r.UserID === (v.salesRepId || v.sales_rep_id));
            const retailer = users.find((u) => u.UserID === (v.retailerId || v.retailer_id));
            const retailerName = v.retailerName || retailer?.Name || retailer?.Company || t("Unknown Retailer");
            return (
              <View key={v.id} style={styles.visitCard}>
                  <View style={styles.visitHeader}>
                    <Text style={styles.visitTitle} numberOfLines={1}>{tDynamic(retailerName)}</Text>
                    <View style={styles.iconRow}><Calendar size={12} color="#8E8E93" /><Text style={styles.visitDate}>{new Date(v.date).toLocaleDateString()}</Text></View>
                  </View>
                  <Text style={styles.visitRep}>{t("Sales Rep:")} {tDynamic(rep?.Name || v.salesRepId || v.sales_rep_id)}</Text>
                  <Text style={styles.visitRetailerId}>{t("Retailer ID:")} {v.retailerId || v.retailer_id}</Text>
                  <Text style={styles.visitRemarks}>{v.remarks}</Text>
                </View>);

          })}
            {paginatedVisits.length === 0 && <Text style={styles.noData}>{t('No visits found.')}</Text>}
            <Pagination currentPage={currentPage} totalPages={totalVisitPages} onPageChange={setCurrentPage} />
          </View>
        }

        {activeTab === 'create' &&
        <View style={styles.formCard}>
            <Text style={styles.formTitle}>{t('Create New Member')}</Text>

            <View style={styles.field}><Text style={styles.label}>{t('Full Name')}</Text><TextInput style={styles.input} value={createFormData.name} onChangeText={(t) => setCreateFormData({ ...createFormData, name: t })} /></View>
            <View style={styles.field}><Text style={styles.label}>{t('Email (Login ID)')}</Text><TextInput style={styles.input} value={createFormData.email} onChangeText={(t) => setCreateFormData({ ...createFormData, email: t })} keyboardType="email-address" autoCapitalize="none" /></View>

            <View style={styles.field}><Text style={styles.label}>{t('Password')}</Text><TextInput style={styles.input} value={createFormData.password} onChangeText={(t) => setCreateFormData({ ...createFormData, password: t })} /></View>
            <View style={styles.field}>
              <Text style={styles.label}>{t('Role')}</Text>
              <View style={styles.pickerContainer}>
                <Picker selectedValue={createFormData.role} onValueChange={(t) => setCreateFormData({ ...createFormData, role: t })} style={{ height: Platform.OS === 'ios' ? 150 : 50, color: '#1A1A1A' }}>
                  <Picker.Item label={t("Sales Representative")} value="sales" />
                  <Picker.Item label={t("Accountant")} value="accountant" />
                  <Picker.Item label={t("Customer / Dealer")} value="customer" />
                </Picker>
              </View>
            </View>

            {createFormData.role === 'customer' &&
          <View style={styles.customerBox}>
                <Text style={styles.customerTitle}>{t('Customer Details')}</Text>
                <View style={styles.field}><Text style={styles.label}>{t('Company Name')}</Text><TextInput style={styles.input} value={createFormData.company} onChangeText={(t) => setCreateFormData({ ...createFormData, company: t })} /></View>
                <View style={styles.field}><Text style={styles.label}>{t('Phone Number')}</Text><TextInput style={styles.input} value={createFormData.phone} onChangeText={(t) => setCreateFormData({ ...createFormData, phone: t })} keyboardType="phone-pad" /></View>
                <View style={styles.field}><Text style={styles.label}>{t('City')}</Text><TextInput style={styles.input} value={createFormData.city} onChangeText={(t) => setCreateFormData({ ...createFormData, city: t })} /></View>

                <View style={styles.field}>
                  <Text style={styles.label}>{t('District')}</Text>
                  <View style={styles.pickerContainer}>
                    <Picker selectedValue={createFormData.district} onValueChange={(t) => setCreateFormData({ ...createFormData, district: t })} style={{ height: Platform.OS === 'ios' ? 150 : 50, color: '#1A1A1A' }}>
                      <Picker.Item label={t("- Select District -")} value="" />
                      {districts.map((d) => <Picker.Item key={d} label={d} value={d} />)}
                    </Picker>
                  </View>
                </View>

                <View style={styles.field}><Text style={styles.label}>{t('Tehsil (Optional)')}</Text><TextInput style={styles.input} value={createFormData.tehsil} onChangeText={(t) => setCreateFormData({ ...createFormData, tehsil: t })} /></View>
                <View style={styles.field}><Text style={styles.label}>{t('Full Address')}</Text><TextInput style={[styles.input, { height: 80 }]} value={createFormData.address} onChangeText={(t) => setCreateFormData({ ...createFormData, address: t })} multiline /></View>
              </View>
          }

            <TouchableOpacity style={styles.submitBtn} onPress={handleCreateSubmit} disabled={isCreating}>
              <Text style={styles.submitText}>{isCreating ? t("Creating Member...") : t("Create Member Account")}</Text>
            </TouchableOpacity>
          </View>
        }
      </View>
    </ScrollView>);

};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E5EA' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A1A' },
  headerSub: { fontSize: 14, color: '#8E8E93', marginTop: 4 },
  tabsContainer: { backgroundColor: '#FFF', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#E5E5EA' },
  tabBtn: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: '#1A1A1A' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#8E8E93' },
  tabTextActive: { color: '#1A1A1A' },
  searchWrapper: { padding: 16, paddingBottom: 0 },
  content: { padding: 16, paddingBottom: 40 },

  card: { backgroundColor: '#FFF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E5E5EA', marginBottom: 16 },
  cardHeader: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  avatar: { width: 48, height: 48, borderRadius: 8, backgroundColor: '#F2F2F7', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontWeight: '700', color: '#8E8E93' },
  cardInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: '600', color: '#1A1A1A', marginBottom: 4 },
  userId: { fontSize: 12, color: '#8E8E93', marginBottom: 4 },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  iconText: { fontSize: 12, color: '#8E8E93', flexShrink: 1 },
  cardDetails: { backgroundColor: '#F8F9FA', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E5E5EA', marginBottom: 16 },

  pickerLabel: { fontSize: 12, fontWeight: '600', color: '#8E8E93', textTransform: 'uppercase', marginBottom: 8 },
  pickerContainer: { borderWidth: 1, borderColor: '#1A1A1A', borderRadius: 8, backgroundColor: '#FFF', overflow: 'hidden', justifyContent: 'center' },
  loader: { position: 'absolute', right: 40, zIndex: 1 },

  segmentBadge: { backgroundColor: '#F2F2F7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  segmentText: { fontSize: 12, fontWeight: '500', color: '#475569', textTransform: 'capitalize' },

  visitCard: { backgroundColor: '#FFF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E5E5EA', marginBottom: 16 },
  visitHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  visitTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A1A', flex: 1 },
  visitDate: { fontSize: 12, color: '#8E8E93' },
  visitRep: { fontSize: 14, fontWeight: '600', color: '#0284C7', marginBottom: 4 },
  visitRetailerId: { fontSize: 12, color: '#8E8E93', marginBottom: 12 },
  visitRemarks: { fontSize: 14, color: '#1A1A1A', lineHeight: 20 },

  noData: { color: '#8E8E93', textAlign: 'center', marginTop: 20 },

  formCard: { backgroundColor: '#FFF', padding: 20, borderRadius: 12, borderWidth: 1, borderColor: '#E5E5EA' },
  formTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 20 },
  field: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#1A1A1A', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 8, padding: 12, fontSize: 14, backgroundColor: '#FFF' },
  customerBox: { backgroundColor: '#F8F9FA', padding: 16, borderRadius: 8, marginBottom: 16 },
  customerTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A1A', marginBottom: 16 },
  submitBtn: { backgroundColor: '#0284C7', paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  submitText: { color: '#FFF', fontSize: 16, fontWeight: '600' }
});