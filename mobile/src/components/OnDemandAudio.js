import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Play, Square, Volume2 } from 'lucide-react-native';

export const OnDemandAudio = ({ audioUrl, label = "Voice Note" }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleTogglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    
    // Mock loading and playing
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setIsPlaying(true);
      
      // Auto stop after 5 seconds
      setTimeout(() => {
        setIsPlaying(false);
      }, 5000);
    }, 600);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.playBtn} 
        onPress={handleTogglePlay}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#FFF" />
        ) : isPlaying ? (
          <Square size={16} color="#FFF" fill="#FFF" />
        ) : (
          <Play size={16} color="#FFF" fill="#FFF" />
        )}
      </TouchableOpacity>
      
      <View style={styles.info}>
        <View style={styles.header}>
          <Volume2 size={14} color="#64748B" />
          <Text style={styles.label}>{label}</Text>
        </View>
        <Text style={styles.status}>
          {isPlaying ? 'Playing...' : 'Ready to play'}
        </Text>
      </View>
      
      {isPlaying && (
        <View style={styles.visualizer}>
          <View style={[styles.bar, { height: 12 }]} />
          <View style={[styles.bar, { height: 20 }]} />
          <View style={[styles.bar, { height: 16 }]} />
          <View style={[styles.bar, { height: 8 }]} />
          <View style={[styles.bar, { height: 14 }]} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 8,
    gap: 12,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  status: {
    fontSize: 10,
    color: '#64748B',
  },
  visualizer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 24,
    paddingHorizontal: 8,
  },
  bar: {
    width: 3,
    backgroundColor: '#3B82F6',
    borderRadius: 2,
    opacity: 0.7,
  }
});
