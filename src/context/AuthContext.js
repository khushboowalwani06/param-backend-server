import React, { createContext, useContext, useState, useEffect } from 'react';
import { sheetsService } from '../services/sheetsService';
import { supabase } from '../lib/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, ActivityIndicator } from 'react-native';
import { DeviceEventEmitter } from 'react-native';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const u = await sheetsService.fetchProfile();
      setUser(u);
      await AsyncStorage.setItem('dms_user', JSON.stringify(u));
      return u;
    } catch (err) {
      console.error('Failed to refresh user profile:', err);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      let savedUser = null;
      try {
        savedUser = await AsyncStorage.getItem('dms_user');
        if (savedUser) {
          const parsed = JSON.parse(savedUser);
          const validRoles = ['admin', 'sales', 'customer', 'dealer', 'retailer'];
          if (!validRoles.includes(parsed.Role)) {
            await AsyncStorage.removeItem('dms_user');
            setUser(null);
          } else {
            setUser(parsed);
            refreshUser();
          }
        }
      } catch (err) {
        console.error('Failed to init auth:', err);
      } finally {
        setLoading(false);
      }

      const savedUserParsed = savedUser ? JSON.parse(savedUser) : null;
      const userId = savedUserParsed?.UserID;

      let channel;
      if (userId) {
        channel = supabase.channel(`profile-updates-${userId}-${Date.now()}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'profiles', filter: `user_id=eq.${userId}` },
            (payload) => {
              refreshUser();
            }
          )
          .subscribe();
      }

      const handleAuthExpired = async () => {
        setUser(null);
        await AsyncStorage.removeItem('dms_user');
      };

      const subscription = DeviceEventEmitter.addListener('auth-expired', handleAuthExpired);

      return () => {
        if (channel) supabase.removeChannel(channel);
        subscription.remove();
      };
    };

    initAuth();
  }, []);

  const login = async (email, password) => {
    try {
      const u = await sheetsService.login(email, password);

      const validRoles = ['admin', 'sales', 'customer', 'dealer', 'retailer'];
      if (!validRoles.includes(u.Role)) {
        await sheetsService.logout();
        throw new Error('COMING SOON: Mobile access for your role is currently under development!');
      }

      setUser(u);
      await AsyncStorage.setItem('dms_user', JSON.stringify(u));
      return u;
    } catch (err) {
      throw err;
    }
  };

  const register = async (userData) => {
    try {
      const u = await sheetsService.register(userData);
      setUser(u);
      await AsyncStorage.setItem('dms_user', JSON.stringify(u));
      return u;
    } catch (err) {
      throw err;
    }
  };

  const logout = async () => {
    await sheetsService.logout();
    setUser(null);
    await AsyncStorage.removeItem('dms_user');
  };

  const updateUser = async (updatedUser) => {
    setUser(updatedUser);
    await AsyncStorage.setItem('dms_user', JSON.stringify(updatedUser));
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 10 }}>Loading...</Text>
      </View>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, updateUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
