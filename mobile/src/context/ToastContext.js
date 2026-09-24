import React, { createContext, useContext, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Vibration, Platform } from 'react-native';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react-native';

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => {
      const newToasts = [...prev, { id, message, type }];
      return newToasts.slice(-3); // Limit to 3 toasts at a time
    });
    
    // Simple vibration instead of web audio
    if (Platform.OS !== 'web') {
      Vibration.vibrate(type === 'error' ? [0, 100, 100, 100] : 50);
    }
    
    // Auto remove after 4 seconds
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }, [removeToast]);

  const success = useCallback((msg) => addToast(msg, 'success'), [addToast]);
  const error = useCallback((msg) => addToast(msg, 'error'), [addToast]);
  const info = useCallback((msg) => addToast(msg, 'info'), [addToast]);

  return (
    <ToastContext.Provider value={{ success, error, info }}>
      {children}
      <View style={styles.toastContainer} pointerEvents="box-none">
        {toasts.map(toast => (
          <View key={toast.id} style={styles.toast}>
            {toast.type === 'success' && <CheckCircle size={20} color="#34C759" />}
            {toast.type === 'error' && <AlertCircle size={20} color="#FF3B30" />}
            {toast.type === 'info' && <Info size={20} color="#007AFF" />}
            
            <Text style={styles.toastText}>{toast.message}</Text>
            
            <TouchableOpacity onPress={() => removeToast(toast.id)} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
              <X size={16} color="#8E8E93" />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </ToastContext.Provider>
  );
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 8,
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 99,
    maxWidth: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  toastText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
  }
});
