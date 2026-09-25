import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Square, CheckSquare, RefreshCw, Info, Mic, Trash2, Play } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { sheetsService } from '../../services/sheetsService';
import { useLanguage } from '../../context/LanguageContext';

export default function PlaceOrder() {
  const { t, tDynamic } = useLanguage();
  const { user } = useAuth();
  const navigation = useNavigation();
  const route = useRoute();
  
  const activeUser = React.useMemo(() => {
    if (route.params?.forCustomer) {
      try {
        return JSON.parse(route.params.forCustomer);
      } catch (e) {
        return user;
      }
    }
    return user;
  }, [route.params?.forCustomer, user]);
  
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);
  
  const [products, setProducts] = useState([]);
  const [zoneRates, setZoneRates] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [selectedProductObj, setSelectedProductObj] = useState(null);
  const [zoneMappings, setZoneMappings] = useState([]);
  const [userOrders, setUserOrders] = useState([]);
  const [lastOrder, setLastOrder] = useState(null);
  
  const [formData, setFormData] = useState({
    Product: '',
    EstimateTons: '',
    Unit: 'Tons',
    EstimateAmt: '',
    Notes: '',
  });

  const [useCustomDelivery, setUseCustomDelivery] = useState(false);
  const [customAddress, setCustomAddress] = useState('');
  const [customCity, setCustomCity] = useState('');
  const [customTehsil, setCustomTehsil] = useState('');
  const [customDistrict, setCustomDistrict] = useState('');
  const [customState, setCustomState] = useState('');
  const [customZip, setCustomZip] = useState('');
  const [availableDistricts, setAvailableDistricts] = useState([]);

  const [isBlocked, setIsBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState('');

  // Sub-retailer auto-fill logic
  useEffect(() => {
    if (route.params?.forCustomer) {
      try {
        const sub = JSON.parse(route.params.forCustomer);
        setUseCustomDelivery(true);
        setCustomAddress(sub.Address || '');
        setCustomCity(sub.City || '');
        setCustomDistrict(sub.District || '');
        setCustomState(sub.State || '');
        setCustomZip(sub.ZipCode || '');
        setCustomTehsil(sub.Tehsil || '');
      } catch (e) {}
    }
  }, [route.params?.forCustomer]);

  // Voice Note State
  const [isRecording, setIsRecording] = useState(false);
  const [audioData, setAudioData] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const startRecording = async () => {
    if (Platform.OS !== 'web') {
      alert("Voice note recording is only supported on the web platform currently.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          setAudioData(reader.result);
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Recording error:", err);
      alert("Failed to start recording. Please check microphone permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const playAudio = () => {
    if (Platform.OS === 'web' && audioData) {
      const audio = new Audio(audioData);
      audio.play();
    }
  };

  const clearAudio = () => {
    setAudioData(null);
  };

  useEffect(() => {
    const init = async () => {
      try {
        const prodData = await sheetsService.getProducts();
        setProducts(prodData);
        
        const rates = await sheetsService.getZoneRates();
        setZoneRates(rates || []);
        
        let mappings = [];
        try {
          if(sheetsService.getZoneMappings) mappings = await sheetsService.getZoneMappings();
        } catch (mErr) {}
        setZoneMappings(mappings || []);
        
        const history = await sheetsService.getOrders(user);
        const myOrders = history.filter(o => o.UserID === activeUser.UserID);
        myOrders.sort((a, b) => new Date(b.OrderTimestamp) - new Date(a.OrderTimestamp));
        setUserOrders(myOrders);

        if (myOrders.length > 0) {
          setLastOrder(myOrders[0]);
        }
      } catch (_err) {
        alert('Failed to load initial data.');
      }
    };
    init();

    if (activeUser) {
      const isBlockedByAdmin = activeUser.BlockedStatus === true || activeUser.BlockedStatus === 'true';
      const isManuallyUnlocked = activeUser.ManualUnlock === true || activeUser.ManualUnlock === 'true';
      if (isBlockedByAdmin && !isManuallyUnlocked) {
        setIsBlocked(true);
        setBlockReason("Your account is currently blocked. Please contact the administrator.");
      } else {
        setIsBlocked(false);
      }
    }
  }, [user, activeUser]);

  useEffect(() => {
    if(sheetsService.getAvailableDistricts) {
      sheetsService.getAvailableDistricts()
        .then(districts => {
          if (Array.isArray(districts)) setAvailableDistricts(districts);
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!products.length || !zoneRates.length || !activeUser) return;
    
    const segment = activeUser?.Segment ? activeUser.Segment : (activeUser?.NonTradeActivated === true || activeUser?.NonTradeActivated === 'true' ? 'Non-Trade' : 'Trade');
    
    let activeZone = activeUser?.Zone;

    if (!activeZone && activeUser?.District) {
      const d = activeUser.District.trim().toLowerCase();
      for (const mapping of zoneMappings) {
        if (!mapping.districts) continue;
        const mappedDistricts = mapping.districts.split(',').map(s => s.trim().toLowerCase());
        if (mappedDistricts.includes(d)) {
          activeZone = mapping.zone;
          break;
        }
      }
    }

    if (!activeZone && activeUser?.City) {
      const c = activeUser.City.trim().toLowerCase();
      for (const mapping of zoneMappings) {
        if (!mapping.districts) continue;
        const mappedDistricts = mapping.districts.split(',').map(s => s.trim().toLowerCase());
        if (mappedDistricts.includes(c)) {
          activeZone = mapping.zone;
          break;
        }
      }
    }

    if (useCustomDelivery && customDistrict) {
      const d = customDistrict.trim().toLowerCase();
      for (const mapping of zoneMappings) {
        if (!mapping.districts) continue;
        const mappedDistricts = mapping.districts.split(',').map(s => s.trim().toLowerCase());
        if (mappedDistricts.includes(d)) {
          activeZone = mapping.zone;
          break;
        }
      }
    }

    activeZone = activeZone || 'Unknown Zone';
    
    // Ultimate fallback if zone is still unknown and we have zone mappings
    if (activeZone === 'Unknown Zone' && zoneMappings && zoneMappings.length > 0) {
      activeZone = zoneMappings[0].zone || 'Unknown Zone';
    }

    const normalizedSegment = String(segment || '').trim().toLowerCase();
    const normalizedZone = String(activeZone || '').trim().toLowerCase();

    const baseRateRow = zoneRates.find(r => String(r.type || '').trim().toLowerCase() === normalizedSegment && String(r.grade || '').trim().toUpperCase() === 'BASE');
    const basePrice = baseRateRow ? Number(baseRateRow.formula) : 0;
    
    const mapped = products.map(p => {
      const productGrade = p.Grade || p.ProductName;
      const rateRow = zoneRates.find(r => {
        const typeMatch = String(r.type || '').trim().toLowerCase() === normalizedSegment;
        const rZone = String(r.zone || '').trim().toLowerCase();
        const zoneMatch = rZone === normalizedZone || rZone === 'all' || rZone === 'default';
        const gradeMatch = String(r.grade || '').trim().toUpperCase() === String(productGrade || '').trim().toUpperCase();
        const includesMatch = p.ProductName && r.grade && p.ProductName.toLowerCase().includes(String(r.grade).trim().toLowerCase());
        return typeMatch && zoneMatch && (gradeMatch || includesMatch);
      });
      
      let finalBagPrice = 0;
      if (rateRow && rateRow.is_available !== false && basePrice > 0) {
        try {
          const formula = rateRow.formula.toUpperCase().replace(/X/g, basePrice);
          finalBagPrice = Function(`'use strict'; return (${formula})`)();
        } catch (_e) {
          finalBagPrice = basePrice;
        }
      } else if (!rateRow && basePrice > 0) {
        // Fallback: If no specific zone rate is found for this product, just use the base price.
        finalBagPrice = basePrice;
      }
      return { ...p, calculatedBagPrice: finalBagPrice, calculatedTonPrice: finalBagPrice * 20 };
    }).filter(p => p.calculatedBagPrice > 0);

    console.log('PRODUCTS_DEBUG:', {
      productsLen: products.length,
      zoneRatesLen: zoneRates.length,
      segment: normalizedSegment,
      zone: normalizedZone,
      basePrice,
      mappedLen: mapped.length
    });
    setAvailableProducts(mapped);
  }, [products, zoneRates, zoneMappings, activeUser, useCustomDelivery, customDistrict]);

  const handleAutofill = () => {
    if (!lastOrder) return;
    const prod = availableProducts.find(p => p.ProductName === lastOrder.Product);
    if (prod) {
      setSelectedProductObj(prod);
      const qty = lastOrder.EstimateQty;
      const unit = lastOrder.Unit || 'Tons';
      const price = unit === 'Bags' ? prod.calculatedBagPrice : prod.calculatedTonPrice;
      const amt = Number(qty) * price;

      setFormData(prev => ({
        ...prev,
        Product: lastOrder.Product,
        EstimateTons: String(qty),
        Unit: unit,
        EstimateAmt: amt ? String(amt) : ''
      }));
    }
  };

  const handleProductChange = (val) => {
    const prod = availableProducts.find(p => p.ProductName === val);
    setSelectedProductObj(prod || null);
    
    const qty = Number(formData.EstimateTons);
    let amt = formData.EstimateAmt;
    if (prod && qty) {
      const unit = formData.Unit || 'Tons';
      const price = unit === 'Bags' ? prod.calculatedBagPrice : prod.calculatedTonPrice;
      amt = qty * price;
    }
    setFormData(prev => ({ ...prev, Product: val, EstimateAmt: amt ? String(amt) : '' }));
  };

  const handleQtyChange = (val) => {
    const newQty = val;
    let amt = '';
    if (selectedProductObj && newQty) {
      const price = formData.Unit === 'Bags' ? selectedProductObj.calculatedBagPrice : selectedProductObj.calculatedTonPrice;
      amt = Number(newQty) * price;
    }
    setFormData(prev => ({ ...prev, EstimateTons: newQty, EstimateAmt: amt ? String(amt) : '' }));
  };

  const handleUnitChange = (val) => {
    let amt = '';
    if (selectedProductObj && formData.EstimateTons) {
      const price = val === 'Bags' ? selectedProductObj.calculatedBagPrice : selectedProductObj.calculatedTonPrice;
      amt = Number(formData.EstimateTons) * price;
    }
    setFormData(prev => ({ ...prev, Unit: val, EstimateAmt: amt ? String(amt) : '' }));
  };

  const handleSubmit = async () => {
    if (loadingRef.current || isBlocked) return;
    
    // Fallback to 1,000,000 for testing if no credit limit is set
    const totalCreditLimit = activeUser?.CreditLimit > 0 ? activeUser.CreditLimit : 1000000;
    const outstandingBalance = activeUser?.OutstandingAmount || 0;
    const orderAmt = Number(formData.EstimateAmt);
    const segment = activeUser?.Segment ? activeUser.Segment : (activeUser?.NonTradeActivated === true || activeUser?.NonTradeActivated === 'true' ? 'Non-Trade' : 'Trade');
    const isNonTrade = segment === 'Non-Trade';
    
    if (!orderAmt || orderAmt <= 0) {
      return alert('Invalid order amount. Please check the product and pricing.');
    }
    if (!formData.EstimateTons || Number(formData.EstimateTons) <= 0) {
      return alert('Please enter a valid quantity.');
    }

    if (user.Role === 'customer' && !isNonTrade && outstandingBalance + orderAmt > totalCreditLimit) {
      return alert(`Credit Limit Exceeded. Your remaining limit is ₹${(totalCreditLimit - outstandingBalance).toLocaleString()}. Please make a payment.`);
    }

    if (useCustomDelivery && (!customAddress.trim() || !customCity.trim() || !customDistrict.trim() || !customState.trim())) {
      return alert('Please enter Address, City, District, and State for custom delivery location.');
    }

    loadingRef.current = true;
    setLoading(true);
    
    try {
      const finalAddress = useCustomDelivery ? customAddress : activeUser.Address;
      const finalCity = useCustomDelivery ? customCity : activeUser.City;
      const finalTehsil = useCustomDelivery ? customTehsil : activeUser.Tehsil;
      const finalDistrict = useCustomDelivery ? customDistrict : activeUser.District;
      const finalState = useCustomDelivery ? customState : activeUser.State;
      const finalZip = useCustomDelivery ? customZip : activeUser.ZipCode;

      const orderData = {
        Product: formData.Product,
        EstimateQty: Number(formData.EstimateTons),
        Unit: formData.Unit || 'Tons',
        EstimateAmt: orderAmt,
        BagPrice: selectedProductObj ? (isNonTrade ? selectedProductObj.NonTradeBagPrice : selectedProductObj.BagPrice) : null,
        TonPrice: selectedProductObj ? (isNonTrade ? selectedProductObj.NonTradeTonPrice : selectedProductObj.TonPrice) : null,
        Notes: formData.Notes,
        OrderName: activeUser.Name,
        OrderPhone: activeUser.Phone,
        OrderAddress: finalAddress,
        OrderCity: finalCity,
        OrderTehsil: finalTehsil,
        OrderDistrict: finalDistrict,
        OrderState: finalState,
        OrderZip: finalZip,
        Company: activeUser.Company,
        UserID: activeUser.UserID,
        Segment: segment,
        AudioData: audioData
      };
      
      await sheetsService.createOrder(user, orderData);
      alert('Order placed successfully!');
      
      if (user.Role === 'admin' || user.Role === 'sales' || user.Role === 'accountant') {
        navigation.goBack();
      } else {
        navigation.navigate('customer/orders');
      }
      
    } catch (err) {
      alert(err.message || 'Failed to place order.');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  };

  if (isBlocked) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <View style={styles.blockedCard}>
          <Text style={styles.blockedTitle}>{t('Order Placement Blocked')}</Text>
          <Text style={styles.blockedSub}>{blockReason}</Text>
          <TouchableOpacity style={styles.btnPrimary} onPress={() => navigation.navigate('customer/invoices')}>
            <Text style={styles.btnPrimaryText}>{t('Go to Invoices')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={styles.headerTitle}>
            {activeUser.UserID !== user.UserID ? `Place Order for ${activeUser.Name}` : 'Procurement Form'}
          </Text>
          <Text style={[styles.headerSub, { marginBottom: 0 }]}>
            {activeUser.UserID !== user.UserID ? `You are placing an order on behalf of ${activeUser.Company}.` : 'Request materials directly from your assigned distributor.'}
          </Text>
        </View>
        {(formData.Product || formData.EstimateTons || formData.Notes) ? (
          <TouchableOpacity 
            style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FEF2F2', borderRadius: 6, borderWidth: 1, borderColor: '#FCA5A5' }}
            onPress={() => setFormData({ Product: '', EstimateTons: '', Unit: 'Tons', EstimateAmt: '', Notes: '' })}
          >
            <Text style={{ color: '#DC2626', fontSize: 12, fontWeight: '700' }}>{t('CLEAR')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {lastOrder && !formData.Product && (
        <View style={styles.autofillCard}>
          <View>
            <Text style={styles.autofillLabel}>{t('LAST ORDER INFO')}</Text>
            <Text style={styles.autofillProd}>{lastOrder.Product}</Text>
            <Text style={styles.autofillDesc}>{lastOrder.EstimateQty} {lastOrder.Unit} on {new Date(lastOrder.OrderTimestamp).toLocaleDateString()}</Text>
          </View>
          <TouchableOpacity style={styles.autofillBtn} onPress={handleAutofill}>
            <RefreshCw size={14} color="#1A1A1A" />
            <Text style={styles.autofillBtnText}>{t('AUTOFILL')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Logistics & Delivery */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}><View style={styles.stepBadge}><Text style={styles.stepBadgeText}>1</Text></View> LOGISTICS & DELIVERY</Text>

        <TouchableOpacity style={styles.checkboxRow} onPress={() => setUseCustomDelivery(!useCustomDelivery)}>
          {useCustomDelivery ? <CheckSquare size={20} color="#1A1A1A" /> : <Square size={20} color="#8E8E93" />}
          <View style={{ flex: 1 }}>
            <Text style={styles.checkboxTitle}>{t('Custom Site Delivery')}</Text>
            <Text style={styles.checkboxSub}>{t('Deliver to a location other than default address.')}</Text>
          </View>
        </TouchableOpacity>

        {useCustomDelivery ? (
          <View style={styles.customDeliveryForm}>
            <Text style={styles.inputLabel}>{t('Site Street Address')}</Text>
            <TextInput style={styles.input} value={customAddress} onChangeText={setCustomAddress} placeholder="Enter street/site address" />
            
            <Text style={styles.inputLabel}>{t('City')}</Text>
            <TextInput style={styles.input} value={customCity} onChangeText={setCustomCity} placeholder="City name" />
            
            <Text style={styles.inputLabel}>{t('Tehsil (Optional)')}</Text>
            <TextInput style={styles.input} value={customTehsil} onChangeText={setCustomTehsil} placeholder="Tehsil name" />
            
            <Text style={styles.inputLabel}>{t('District')}</Text>
            <View style={styles.pickerContainer}>
              <Picker selectedValue={customDistrict} onValueChange={setCustomDistrict}>
                <Picker.Item label="Select District" value="" />
                {availableDistricts.map(d => (
                  <Picker.Item key={d} label={d} value={d} />
                ))}
              </Picker>
            </View>

            <Text style={styles.inputLabel}>{t('State')}</Text>
            <TextInput style={styles.input} value={customState} onChangeText={setCustomState} placeholder="State name" />

            <Text style={styles.inputLabel}>{t('ZIP Code (Optional)')}</Text>
            <TextInput style={styles.input} value={customZip} onChangeText={setCustomZip} placeholder="PIN code" keyboardType="numeric" />
          </View>
        ) : (
          <View style={styles.defaultAddressBox}>
            <Info size={16} color="#1D4ED8" />
            <Text style={styles.defaultAddressText}>
              Delivering to: <Text style={{ fontWeight: '700' }}>{activeUser.Address}, {activeUser.City}, {activeUser.District}, {activeUser.State}</Text>
            </Text>
          </View>
        )}

        <Text style={styles.inputLabel}>{t('Special Instructions (Optional)')}</Text>
        <TextInput 
          style={styles.textArea} 
          multiline 
          numberOfLines={3} 
          value={formData.Notes} 
          onChangeText={v => setFormData(prev => ({...prev, Notes: v}))} 
          placeholder="Type instructions here..."
        />

        <Text style={[styles.inputLabel, { marginTop: 16 }]}>{t('Voice Note (Optional)')}</Text>
        <View style={styles.voiceNoteContainer}>
          {audioData ? (
            <View style={styles.audioRecordedCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity onPress={playAudio} style={styles.iconBtnRound}>
                  <Play size={18} color="#FFF" fill="#FFF" />
                </TouchableOpacity>
                <Text style={styles.audioText}>{t('Voice Note Recorded')}</Text>
              </View>
              <TouchableOpacity onPress={clearAudio}>
                <Trash2 size={20} color="#FF3B30" />
              </TouchableOpacity>
            </View>
          ) : isRecording ? (
            <TouchableOpacity style={styles.recordBtnRecording} onPress={stopRecording}>
              <Square size={20} color="#FFF" fill="#FFF" />
              <Text style={styles.recordBtnTextRecording}>{t('Stop Recording...')}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.recordBtn} onPress={startRecording}>
              <Mic size={20} color="#1A1A1A" />
              <Text style={styles.recordBtnText}>{t('Record Audio Instructions')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Material Detail */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}><View style={[styles.stepBadge, { backgroundColor: '#E2E8F0' }]}><Text style={[styles.stepBadgeText, { color: '#1A1A1A' }]}>2</Text></View> MATERIAL DETAIL</Text>
        
        <Text style={styles.inputLabel}>{t('Select Product Catalog')}</Text>
        <View style={styles.pickerContainer}>
          <Picker selectedValue={formData.Product} onValueChange={handleProductChange}>
            <Picker.Item label="-- Choose a product --" value="" />
            {availableProducts.map(p => (
              <Picker.Item key={p.ProductID} label={`${p.ProductName} (₹${p.calculatedBagPrice}/bag | ₹${p.calculatedTonPrice}/ton)`} value={tDynamic(p.ProductName)} />
            ))}
          </Picker>
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={styles.inputLabel}>{t('Qty Required')}</Text>
              <View style={styles.unitPickerContainer}>
                <Picker style={styles.unitPicker} selectedValue={formData.Unit} onValueChange={handleUnitChange}>
                  <Picker.Item label="Tons" value="Tons" />
                  <Picker.Item label="Bags" value="Bags" />
                </Picker>
              </View>
            </View>
            <TextInput 
              style={[styles.input, !formData.Product && { backgroundColor: '#F8FAFC' }]}
              value={formData.EstimateTons}
              onChangeText={handleQtyChange}
              keyboardType="numeric"
              editable={!!formData.Product}
              placeholder={!formData.Product ? "Select product" : (formData.Unit === 'Bags' ? "e.g. 200 bags" : "e.g. 10 tons")}
            />
            {!!formData.EstimateTons && (
              <Text style={styles.convertText}>
                Convert: {formData.Unit === 'Bags' ? (Number(formData.EstimateTons) / 20).toFixed(2) + ' Tons' : (Number(formData.EstimateTons) * 20) + ' Bags'}
              </Text>
            )}
          </View>
          <View style={{ width: 16 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.inputLabel}>{t('Estimated Cost')}</Text>
            <View style={styles.costBox}>
              <Text style={styles.costText}>{formData.EstimateAmt ? `₹${Number(formData.EstimateAmt).toLocaleString()}` : '₹0'}</Text>
              {selectedProductObj && (
                <Text style={styles.costSub}>@ ₹{formData.Unit === 'Bags' ? selectedProductObj.calculatedBagPrice : selectedProductObj.calculatedTonPrice} / {formData.Unit === 'Bags' ? 'bag' : 'ton'}</Text>
              )}
            </View>
          </View>
        </View>
      </View>

      <TouchableOpacity style={[styles.btnPrimary, loading && { opacity: 0.7 }]} onPress={handleSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnPrimaryText}>{t('SUBMIT PROCUREMENT REQUEST')}</Text>}
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  headerSub: { fontSize: 14, color: '#8E8E93', marginBottom: 24 },
  
  autofillCard: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', borderStyle: 'dashed', padding: 16, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  autofillLabel: { fontSize: 10, fontWeight: '700', color: '#64748B', marginBottom: 4 },
  autofillProd: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  autofillDesc: { fontSize: 12, color: '#64748B' },
  autofillBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#1A1A1A', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 4 },
  autofillBtnText: { fontSize: 12, fontWeight: '700', color: '#1A1A1A' },

  sectionCard: { backgroundColor: '#FFF', borderWidth: 2, borderColor: '#1A1A1A', borderRadius: 12, padding: 20, marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1A', marginBottom: 20, flexDirection: 'row', alignItems: 'center' },
  stepBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#1A1A1A', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  stepBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  
  checkboxRow: { flexDirection: 'row', gap: 12, padding: 16, backgroundColor: '#F8FAFC', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 },
  checkboxTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  checkboxSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  
  customDeliveryForm: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed', padding: 16, borderRadius: 8, marginBottom: 16 },
  defaultAddressBox: { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: '#EFF6FF', borderRadius: 8, marginBottom: 16 },
  defaultAddressText: { fontSize: 12, color: '#1D4ED8', flex: 1 },

  inputLabel: { fontSize: 14, fontWeight: '600', color: '#1A1A1A', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 12, fontSize: 16, color: '#1A1A1A', marginBottom: 16 },
  textArea: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 12, fontSize: 16, color: '#1A1A1A', minHeight: 80, textAlignVertical: 'top' },
  pickerContainer: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, marginBottom: 16, backgroundColor: '#F8FAFC' },
  
  row: { flexDirection: 'row' },
  unitPickerContainer: { height: 30, width: 90, borderWidth: 0, justifyContent: 'center' },
  unitPicker: { color: '#0056D2', fontWeight: '700' },
  convertText: { fontSize: 12, color: '#8E8E93', textAlign: 'right', marginTop: 4 },
  
  costBox: { backgroundColor: '#F2F2F7', padding: 16, borderRadius: 8, alignItems: 'flex-start' },
  costText: { fontSize: 18, fontWeight: '700', color: '#34C759' },
  costSub: { fontSize: 10, color: '#8E8E93', fontWeight: '600', marginTop: 4 },

  btnPrimary: { backgroundColor: '#1A1A1A', padding: 20, borderRadius: 12, alignItems: 'center' },
  btnPrimaryText: { color: '#FFF', fontSize: 16, fontWeight: '700', letterSpacing: 1 },

  blockedCard: { backgroundColor: '#FEF2F2', padding: 24, borderRadius: 16, borderWidth: 1, borderColor: '#DC2626', width: '100%', alignItems: 'center' },
  blockedTitle: { fontSize: 20, fontWeight: '700', color: '#DC2626', marginBottom: 12 },
  blockedSub: { fontSize: 16, color: '#1A1A1A', textAlign: 'center', marginBottom: 24 },

  voiceNoteContainer: { marginBottom: 16 },
  recordBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, backgroundColor: '#F8FAFC', gap: 8 },
  recordBtnText: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  recordBtnRecording: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8, backgroundColor: '#EF4444', gap: 8 },
  recordBtnTextRecording: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  audioRecordedCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderWidth: 1, borderColor: '#22C55E', borderRadius: 8, backgroundColor: '#F0FDF4' },
  iconBtnRound: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#22C55E', alignItems: 'center', justifyContent: 'center' },
  audioText: { fontSize: 14, fontWeight: '600', color: '#15803D' },
});
