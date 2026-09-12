import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, StyleSheet, ScrollView, Platform } from 'react-native';
import { X, Calculator } from 'lucide-react-native';
import { sheetsService } from '../services/sheetsService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Picker } from '@react-native-picker/picker';

export const EditOrderModal = ({ order, onClose, onUpdate, inline = false, visible = true }) => {
  const { success, error } = useToast();
  
  const [formData, setFormData] = useState({
    Product: order?.Product || '',
    EstimateQty: String(order?.EstimateQty || ''),
    Unit: order?.Unit || 'Bags',
    UnitPrice: String(order?.UnitPrice || ''),
    EstimateAmt: String(order?.EstimateAmt || '')
  });

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const prodData = await sheetsService.getProducts();
        setProducts(prodData);
      } catch (err) {
        console.error("Failed to load products", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const calculateAmount = () => {
    const qty = Number(formData.EstimateQty) || 0;
    const price = Number(formData.UnitPrice) || 0;
    setFormData(prev => ({ ...prev, EstimateAmt: String(qty * price) }));
  };

  const handleProductChange = (pName) => {
    setFormData(prev => ({ ...prev, Product: pName }));
    const p = products.find(prod => prod.ProductName === pName);
    if (p) {
      const defaultPrice = formData.Unit === 'Bags' ? p.BagPrice : p.TonPrice;
      setFormData(prev => ({ ...prev, UnitPrice: String(defaultPrice || '') }));
    }
  };

  const handleSubmit = async () => {
    try {
      await sheetsService._fetch(`/orders/${order.OrdID}`, {
        method: 'PATCH',
        body: JSON.stringify({
          Product: formData.Product,
          EstimateQty: Number(formData.EstimateQty),
          Unit: formData.Unit,
          UnitPrice: Number(formData.UnitPrice),
          EstimateAmt: Number(formData.EstimateAmt)
        })
      });
      success('Order updated successfully');
      if (onUpdate) onUpdate();
      if (onClose) onClose();
    } catch (err) {
      error(err.message || 'Failed to update order');
    }
  };

  const content = (
    <View style={inline ? styles.inlineContainer : styles.modalContainer}>
      {!inline && (
        <View style={styles.header}>
          <Text style={styles.title}>Edit Order {order?.OrdID}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{top:10, bottom:10, left:10, right:10}}>
            <X size={20} color="#8E8E93" />
          </TouchableOpacity>
        </View>
      )}

      {inline && (
        <View style={styles.inlineHeader}>
          <Text style={styles.inlineTitle}>Edit Mode</Text>
          <TouchableOpacity onPress={onClose}>
            <X size={18} color="#64748b" />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={styles.formContainer}>
        <View style={styles.field}>
          <Text style={styles.label}>Product Type</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={formData.Product}
              onValueChange={handleProductChange}
              enabled={!loading}
              style={styles.picker}
            >
              <Picker.Item label="Select Product..." value="" />
              {products.map(p => (
                <Picker.Item key={p.ProductID} label={p.ProductName || 'Unknown'} value={p.ProductName || ''} />
              ))}
            </Picker>
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Quantity</Text>
            <TextInput
              style={styles.input}
              value={formData.EstimateQty}
              onChangeText={val => handleChange('EstimateQty', val)}
              keyboardType="numeric"
            />
          </View>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Unit</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.Unit}
                onValueChange={val => handleChange('Unit', val)}
                style={styles.picker}
              >
                <Picker.Item label="Bags" value="Bags" />
                <Picker.Item label="Tons" value="Tons" />
              </Picker>
            </View>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Unit Price (₹)</Text>
          <TextInput
            style={styles.input}
            value={formData.UnitPrice}
            onChangeText={val => handleChange('UnitPrice', val)}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Estimate Amount (₹)</Text>
          <View style={styles.calcRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={formData.EstimateAmt}
              onChangeText={val => handleChange('EstimateAmt', val)}
              keyboardType="numeric"
            />
            <TouchableOpacity style={styles.calcBtn} onPress={calculateAmount}>
              <Calculator size={16} color="#475569" />
              <Text style={styles.calcText}>Auto Calculate</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.actions}>
          {!inline && (
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.saveBtn} onPress={handleSubmit}>
            <Text style={styles.saveText}>Save Changes</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );

  if (inline) return content;

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        {content}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContainer: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 10,
  },
  inlineContainer: {
    flex: 1,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderColor: '#e2e8f0',
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  inlineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  inlineTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  formContainer: {
    padding: 20,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D1D6',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1A1A1A',
    backgroundColor: '#FFF',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#D1D1D6',
    borderRadius: 8,
    backgroundColor: '#FFF',
    overflow: 'hidden',
  },
  picker: {
    height: Platform.OS === 'ios' ? 150 : 50,
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  calcRow: {
    flexDirection: 'row',
    gap: 12,
  },
  calcBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  calcText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#475569',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  saveBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#1A1A1A',
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  }
});
