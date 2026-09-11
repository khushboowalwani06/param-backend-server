import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, Switch } from 'react-native';
import { sheetsService } from '../../services/sheetsService';
import { Plus, Edit2, Trash2, Tag, X, Upload, Save } from 'lucide-react-native';
import * as XLSX from 'xlsx';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useAuth } from '../../context/AuthContext';
import { CardSkeleton } from '../../components/Skeleton';
import { ExportButton } from '../../components/ExportButton';
import { useRealtime } from '../../hooks/useRealtime';
import { Pagination } from '../../components/Pagination';

export const AdminProducts = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [activePricingMode, setActivePricingMode] = useState('Trade');

  const [newProductName, setNewProductName] = useState('');
  const [newProductGrade, setNewProductGrade] = useState('');
  const [isAddingGrade, setIsAddingGrade] = useState(false);
  const [newGradeName, setNewGradeName] = useState('');

  const [editProductName, setEditProductName] = useState('');
  const [editBagPrice, setEditBagPrice] = useState('');
  const [editTonPrice, setEditTonPrice] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const [basePrice, setBasePrice] = useState('');
  const [zoneRates, setZoneRates] = useState([]);

  const [zoneMappings, setZoneMappings] = useState([]);
  const [isSavingMappings, setIsSavingMappings] = useState(false);

  const [isImporting, setIsImporting] = useState(false);

  useRealtime(['products'], () => setRefreshKey(k => k + 1));

  useEffect(() => {
    fetchProducts();
    fetchRates();
  }, [refreshKey]);

  useEffect(() => {
    const activeBase = zoneRates.find(r => r.grade === 'BASE' && r.type === activePricingMode);
    setBasePrice(activeBase ? activeBase.formula : '');
  }, [activePricingMode, zoneRates]);

  const fetchProducts = async () => {
    try {
      const data = await sheetsService.getProducts();
      setProducts(data);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to load products');
    } finally {
      setLoading(false);
      setCurrentPage(1);
    }
  };

  const fetchRates = async () => {
    try {
      const data = await sheetsService.getZoneRates();
      setZoneRates(data || []);
      const mappings = await sheetsService.getZoneMappings();
      setZoneMappings(mappings || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveMappings = async () => {
    setIsSavingMappings(true);
    try {
      await sheetsService.saveZoneMappings(zoneMappings);
      Alert.alert('Success', 'Zone mappings saved successfully');
    } catch (err) {
      Alert.alert('Error', 'Failed to save mappings');
    } finally {
      setIsSavingMappings(false);
    }
  };

  const handleFileUpload = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true,
      });

      if (res.canceled) return;
      const file = res.assets[0];

      setIsImporting(true);
      const b64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
      const workbook = XLSX.read(b64, { type: 'base64' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      let headerRowIndex = -1;
      for (let i = 0; i < rows.length; i++) {
        if (rows[i] && rows[i][0] && String(rows[i][0]).trim().toLowerCase() === 'grade') {
          headerRowIndex = i;
          break;
        }
      }

      if (headerRowIndex === -1) throw new Error("Could not find 'Grade' header row");

      const headers = rows[headerRowIndex];
      const rates = [];

      for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        const grade = row[0];
        if (!grade) continue;

        for (let j = 1; j < headers.length; j++) {
          const zone = headers[j];
          const formula = row[j];
          if (zone && formula) {
            rates.push({
              grade: String(grade).trim(),
              zone: String(zone).trim(),
              formula: String(formula).trim(),
              type: activePricingMode
            });
          }
        }
      }

      if (rates.length === 0) throw new Error("No valid rates found in sheet");

      await sheetsService.uploadZoneRates(rates, activePricingMode);
      Alert.alert('Success', `Successfully imported ${rates.length} ${activePricingMode} zone logic rules!`);
      fetchRates();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', `Failed to import zone rates: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleAddSubmit = async () => {
    if (!newProductName.trim()) return Alert.alert('Error', 'Product Name is required.');
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true; setIsSubmitting(true);
    try {
      const payload = {
        ProductID: `PRD-${Math.floor(1000 + Math.random() * 9000)}`,
        ProductName: newProductName.trim(),
        Grade: newProductGrade.trim() || newProductName.trim()
      };
      await sheetsService.addProduct(user, payload);
      setIsAdding(false);
      setNewProductName(''); setNewProductGrade('');
      await fetchProducts();
    } catch (err) {
      Alert.alert('Error', 'Failed to add product');
    } finally {
      isSubmittingRef.current = false; setIsSubmitting(false);
    }
  };

  const startEditing = (product) => {
    setEditingId(product.ProductID);
    setEditProductName(product.ProductName);
    if (activePricingMode === 'Trade') {
      setEditBagPrice(String(product.BagPrice || ''));
      setEditTonPrice(String(product.TonPrice || ''));
    } else {
      setEditBagPrice(String(product.NonTradeBagPrice || ''));
      setEditTonPrice(String(product.NonTradeTonPrice || ''));
    }
  };

  const handleEditSubmit = async (id) => {
    if (!editProductName.trim()) return Alert.alert('Error', 'Product Name is required.');
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true; setIsSubmitting(true);
    try {
      const payload = { ProductName: editProductName.trim() };
      if (activePricingMode === 'Trade') {
        payload.BagPrice = Number(editBagPrice); payload.TonPrice = Number(editTonPrice);
      } else {
        payload.NonTradeBagPrice = Number(editBagPrice); payload.NonTradeTonPrice = Number(editTonPrice);
      }
      await sheetsService.updateProduct(user, id, payload);
      setEditingId(null);
      await fetchProducts();
    } catch (err) {
      Alert.alert('Error', 'Failed to update product');
    } finally {
      isSubmittingRef.current = false; setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    Alert.alert('Confirm', 'Are you sure you want to delete this product?', [
      { text: 'Cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          isSubmittingRef.current = true; setIsSubmitting(true);
          try {
            await sheetsService.deleteProduct(user, id);
            await fetchProducts();
          } catch (err) {
            Alert.alert('Error', 'Failed to delete product');
          } finally {
            isSubmittingRef.current = false; setIsSubmitting(false);
          }
        }
      }
    ]);
  };

  const handleSaveBasePrice = async () => {
    if (Number(basePrice) <= 0) return Alert.alert('Error', 'Base price must be greater than 0.');
    try {
      setIsSubmitting(true);
      await sheetsService.saveBasePrice(Number(basePrice), activePricingMode);
      await fetchRates();
      Alert.alert('Success', 'Ahmedabad Base Price saved successfully!');
    } catch (err) {
      Alert.alert('Error', 'Failed to save base price');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateFormula = async (rateId, newFormula, oldFormula) => {
    if (!rateId || !newFormula || String(newFormula).toUpperCase() === String(oldFormula).toUpperCase()) return;
    try {
      await sheetsService.updateZoneRateCell(rateId, { formula: String(newFormula).toUpperCase() });
      fetchRates();
    } catch (err) {
      Alert.alert('Error', 'Failed to update formula');
    }
  };

  const toggleAvailable = async (rateId, isAvailable) => {
    if (!rateId) return;
    try {
      await sheetsService.updateZoneRateCell(rateId, { is_available: isAvailable });
      fetchRates();
    } catch (err) {
      Alert.alert('Error', 'Failed to update availability');
    }
  };

  const submitNewGrade = async () => {
    if (!newGradeName.trim()) {
      setIsAddingGrade(false);
      return;
    }
    try {
      setIsSubmitting(true);
      await sheetsService.addZoneRateGrade(newGradeName.trim(), activePricingMode);
      setNewGradeName('');
      setIsAddingGrade(false);
      fetchRates();
    } catch (err) { 
      Alert.alert('Error', 'Failed to add grade'); 
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteGrade = (grade) => {
    Alert.alert('Confirm Delete', `Are you sure you want to delete the entire grade "${grade}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            setIsSubmitting(true);
            await sheetsService.deleteZoneRateGrade(grade, activePricingMode);
            fetchRates();
          } catch (err) {
            Alert.alert('Error', 'Failed to delete grade');
          } finally {
            setIsSubmitting(false);
          }
        }
      }
    ]);
  };

  if (loading) return <View style={{ padding: 16 }}><CardSkeleton /><CardSkeleton /></View>;

  const totalPages = Math.ceil(products.length / itemsPerPage);
  const paginatedProducts = products.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const activeRates = zoneRates.filter(r => r.type === activePricingMode && r.grade !== 'BASE');
  const grades = Array.from(new Set(activeRates.map(r => r.grade)));
  const zones = Array.from(new Set(activeRates.map(r => r.zone)));

  const DEFAULT_ZONES = ['Saurashtra', 'South Gujarat', 'Vadodara', 'North Gujarat', 'Ahmedabad & Anand,Kheda'];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Inventory & Pricing</Text>
        <Text style={styles.headerSub}>Manage the product catalog available for ordering.</Text>

        <View style={styles.actionRow}>
          <View style={styles.tabsRow}>
            {['Trade', 'Non-Trade'].map(seg => (
              <TouchableOpacity key={seg} onPress={() => setActivePricingMode(seg)} style={[styles.tabBtn, activePricingMode === seg && styles.tabBtnActive]}>
                <Text style={[styles.tabText, activePricingMode === seg && styles.tabTextActive]}>{seg} Pricing</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.headerActions}>
            <ExportButton data={products} filename="Products" />
            <TouchableOpacity onPress={handleFileUpload} disabled={isImporting} style={styles.importBtn}>
              <Upload size={16} color="#1A1A1A" />
              <Text style={styles.importText}>{isImporting ? 'Importing...' : 'Import Rates'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIsAdding(!isAdding)} style={styles.addBtn}>
              {isAdding ? <X size={16} color="#FFF" /> : <Plus size={16} color="#FFF" />}
              <Text style={styles.addText}>{isAdding ? 'Cancel' : 'Add Product'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        {isAdding && (
          <View style={styles.addForm}>
            <View style={styles.formRow}>
              <View style={styles.field}><Text style={styles.label}>Product Name</Text><TextInput style={styles.input} value={newProductName} onChangeText={setNewProductName} /></View>
              <View style={styles.field}><Text style={styles.label}>Grade (optional)</Text><TextInput style={styles.input} value={newProductGrade} onChangeText={setNewProductGrade} /></View>
              <TouchableOpacity style={styles.saveBtn} onPress={handleAddSubmit} disabled={isSubmitting}><Text style={styles.saveText}>Save</Text></TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{activePricingMode} Zone Rates Pricing Matrix</Text>
          <Text style={styles.cardSub}>Set the Base Price (X) for Ahmedabad below. The matrix will automatically calculate prices for all other zones.</Text>
          <View style={styles.baseRow}>
            <View style={styles.field}>
              <Text style={styles.label}>Ahmedabad Base Price (X)</Text>
              <TextInput style={styles.input} value={basePrice} onChangeText={setBasePrice} keyboardType="numeric" placeholder="e.g. 300" />
            </View>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveBasePrice} disabled={isSubmitting}><Text style={styles.saveText}>Save Base Price</Text></TouchableOpacity>
          </View>

          {activeRates.length > 0 && (
            <ScrollView horizontal style={styles.tableScroll}>
              <View>
                <View style={[styles.tableRow, styles.tableHeader]}>
                  <Text style={[styles.tableCell, styles.headerCell, { width: 150 }]}>Grade</Text>
                  {zones.map(z => <Text key={z} style={[styles.tableCell, styles.headerCell]}>{z}</Text>)}
                </View>
                {grades.map(grade => (
                  <View key={grade} style={styles.tableRow}>
                    <View style={[styles.tableCell, { width: 150, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                      <Text style={{ fontWeight: '600' }}>{grade}</Text>
                      <TouchableOpacity onPress={() => deleteGrade(grade)} disabled={isSubmitting}>
                        <Trash2 size={16} color="#dc2626" />
                      </TouchableOpacity>
                    </View>
                    {zones.map(zone => {
                      const rate = activeRates.find(r => r.grade === grade && r.zone === zone);
                      let finalPrice = '-';
                      if (rate && basePrice && rate.formula) {
                        try {
                          const formula = String(rate.formula).toUpperCase().replace(/X/g, Number(basePrice));
                          // Safe eval workaround
                          finalPrice = eval(formula);
                        } catch (e) { finalPrice = 'Error'; }
                      }
                      const isAvail = rate?.is_available !== false;
                      return (
                        <View key={zone} style={[styles.tableCell, { backgroundColor: isAvail ? '#FFF' : '#F8F9FA' }]}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <Text style={{ fontSize: 10, color: '#8E8E93' }}>Available</Text>
                            <Switch value={isAvail} onValueChange={(val) => toggleAvailable(rate?.id, val)} style={{ transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] }} />
                          </View>
                          <TextInput
                            style={styles.formulaInput}
                            defaultValue={rate?.formula || ''}
                            onBlur={(e) => updateFormula(rate?.id, e.nativeEvent.text, rate?.formula)}
                            placeholder="Formula"
                          />
                          <View style={{ opacity: isAvail ? 1 : 0.4 }}>
                            <Text style={styles.priceLg}>{finalPrice !== '-' ? `₹ ${finalPrice}` : '-'}</Text>
                            {finalPrice !== '-' && <Text style={styles.priceSm}>₹ {finalPrice * 20} / ton</Text>}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ))}
                <View style={{ padding: 12 }}>
                  {isAddingGrade ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <TextInput 
                        style={[styles.input, { flex: 1, maxWidth: 200 }]} 
                        value={newGradeName} 
                        onChangeText={setNewGradeName} 
                        placeholder="Enter Grade (e.g. OPC53)" 
                        autoFocus 
                      />
                      <TouchableOpacity style={[styles.saveBtn, { paddingVertical: 8 }]} onPress={submitNewGrade} disabled={isSubmitting}>
                        <Text style={styles.saveText}>Save</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={{ padding: 8 }} onPress={() => { setIsAddingGrade(false); setNewGradeName(''); }}>
                        <X size={20} color="#8E8E93" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.addGradeBtn} onPress={() => setIsAddingGrade(true)}>
                      <Plus size={16} color="#1A1A1A" />
                      <Text style={styles.addGradeText}>Add New Grade</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </ScrollView>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Product Overrides</Text>
          <Text style={styles.cardSub}>If manual prices are set here, they will override the matrix calculations.</Text>
          {paginatedProducts.map(p => {
            const isEditing = editingId === p.ProductID;
            let currentBagPrice = activePricingMode === 'Trade' ? p.BagPrice : p.NonTradeBagPrice;
            let currentTonPrice = activePricingMode === 'Trade' ? p.TonPrice : p.NonTradeTonPrice;

            return (
              <View key={p.ProductID} style={styles.productRow}>
                <View style={{ width: '100%' }}>
                  {isEditing ? (
                    <TextInput style={[styles.input, { marginBottom: 8 }]} value={editProductName} onChangeText={setEditProductName} />
                  ) : (
                    <>
                      <Text style={styles.prodName} numberOfLines={2} ellipsizeMode="tail">{p.ProductName}</Text>
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                        <Text style={styles.prodId}>{p.ProductID}</Text>
                        {p.Grade && <View style={styles.gradeBadge}><Text style={styles.gradeText}>{p.Grade}</Text></View>}
                      </View>
                    </>
                  )}
                </View>
                <View style={{ width: '100%', flexDirection: 'row', gap: 16, justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  <View>
                    <Text style={styles.priceLabel}>Price / Bag</Text>
                    {isEditing ? <TextInput style={styles.editPrice} value={editBagPrice} onChangeText={setEditBagPrice} keyboardType="numeric" /> : <Text style={styles.priceVal}>₹ {currentBagPrice || '-'}</Text>}
                  </View>
                  <View>
                    <Text style={styles.priceLabel}>Price / Ton</Text>
                    {isEditing ? <TextInput style={styles.editPrice} value={editTonPrice} onChangeText={setEditTonPrice} keyboardType="numeric" /> : <Text style={styles.priceVal}>₹ {currentTonPrice || '-'}</Text>}
                  </View>
                  <View style={{ width: 60, flexDirection: 'row', justifyContent: 'flex-end' }}>
                    {isEditing ? (
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity onPress={() => handleEditSubmit(p.ProductID)}><Text style={{ color: '#0284C7', fontWeight: '600' }}>Save</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => setEditingId(null)}><X size={16} color="#8E8E93" /></TouchableOpacity>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', gap: 12 }}>
                        <TouchableOpacity onPress={() => startEditing(p)}><Edit2 size={16} color="#8E8E93" /></TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDelete(p.ProductID)}><Trash2 size={16} color="#EF4444" /></TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />

        <View style={styles.card}>
          <View style={styles.zoneConfigHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Zone Configuration</Text>
              <Text style={styles.cardSub}>Map districts to their respective zones. Separate multiple districts with a comma.</Text>
            </View>
            <TouchableOpacity style={styles.saveMappingsBtn} onPress={handleSaveMappings} disabled={isSavingMappings}>
              <Save size={16} color="#FFF" />
              <Text style={styles.saveMappingsText}>{isSavingMappings ? 'Saving...' : 'Save Mappings'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.zoneMappingsGrid}>
            {DEFAULT_ZONES.map(zone => {
              const mapping = zoneMappings.find(m => m.zone === zone) || { zone, districts: '' };
              return (
                <View key={zone} style={styles.mappingRow}>
                  <Text style={styles.mappingLabel}>{zone}</Text>
                  <TextInput
                    style={styles.mappingInput}
                    multiline
                    value={mapping.districts}
                    onChangeText={(text) => {
                      const newMappings = [...zoneMappings];
                      const idx = newMappings.findIndex(m => m.zone === zone);
                      if (idx >= 0) {
                        newMappings[idx].districts = text;
                      } else {
                        newMappings.push({ zone, districts: text });
                      }
                      setZoneMappings(newMappings);
                    }}
                    placeholder={`e.g. Rajkot, Jamnagar`}
                  />
                </View>
              );
            })}
          </View>
        </View>

      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E5EA' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A1A' },
  headerSub: { fontSize: 14, color: '#8E8E93', marginTop: 4, marginBottom: 16 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between' },
  tabsRow: { flexDirection: 'row', gap: 8 },
  tabBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: '#E5E5EA' },
  tabBtnActive: { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' },
  tabText: { fontSize: 12, fontWeight: '600', color: '#8E8E93' },
  tabTextActive: { color: '#FFF' },
  headerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  importBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#E5E5EA', gap: 6 },
  importText: { fontSize: 12, fontWeight: '600', color: '#1A1A1A' },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 6 },
  addText: { fontSize: 12, fontWeight: '600', color: '#FFF' },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  addForm: { backgroundColor: '#FFF', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E5E5EA' },
  formRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' },
  field: { flex: 1, minWidth: 120 },
  label: { fontSize: 12, fontWeight: '600', color: '#8E8E93', marginBottom: 4 },
  input: { backgroundColor: '#F8F9FA', borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 8, padding: 8, fontSize: 14 },
  saveBtn: { backgroundColor: '#1A1A1A', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  saveText: { color: '#FFF', fontWeight: '600', fontSize: 14 },
  card: { backgroundColor: '#FFF', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E5E5EA' },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A1A' },
  cardSub: { fontSize: 12, color: '#8E8E93', marginTop: 4, marginBottom: 16 },
  baseRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginBottom: 16, flexWrap: 'wrap' },
  tableScroll: { borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 8 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E5EA' },
  tableHeader: { backgroundColor: '#F8F9FA' },
  tableCell: { width: 140, padding: 12, borderRightWidth: 1, borderRightColor: '#E5E5EA' },
  headerCell: { fontWeight: '600', fontSize: 12, color: '#1A1A1A' },
  formulaInput: { borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 4, padding: 4, fontSize: 12, marginBottom: 8, backgroundColor: '#FFF' },
  priceLg: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  priceSm: { fontSize: 12, color: '#8E8E93' },
  addGradeBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8 },
  addGradeText: { fontSize: 12, fontWeight: '600', color: '#1A1A1A' },
  productRow: { flexDirection: 'row', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F2F2F7', flexWrap: 'wrap', gap: 8 },
  prodName: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  prodId: { fontSize: 12, color: '#8E8E93' },
  gradeBadge: { backgroundColor: '#F8F9FA', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#E5E5EA' },
  gradeText: { fontSize: 10, color: '#475569' },
  priceLabel: { fontSize: 10, color: '#8E8E93', marginBottom: 4 },
  priceVal: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  editPrice: { borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 4, padding: 4, width: 80, fontSize: 14 },
  zoneConfigHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  saveMappingsBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 6 },
  saveMappingsText: { color: '#FFF', fontWeight: '600', fontSize: 12 },
  zoneMappingsGrid: { gap: 16 },
  mappingRow: { gap: 8 },
  mappingLabel: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  mappingInput: { minHeight: 60, backgroundColor: '#F8F9FA', borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 8, padding: 12, fontSize: 14, textAlignVertical: 'top' }
});
