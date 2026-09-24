import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

const Skeleton = ({ width, height, borderRadius, style }) => {
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 800,
          useNativeDriver: true,
        })
      ])
    ).start();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width || '100%',
          height: height || 24,
          borderRadius: borderRadius || 4,
          backgroundColor: '#E5E5EA',
          opacity,
        },
        style
      ]}
    />
  );
};

export const CardSkeleton = () => (
  <View style={styles.card}>
    <View style={styles.header}>
      <Skeleton width="40%" height={28} />
      <Skeleton width="20%" height={24} borderRadius={12} />
    </View>
    <View style={styles.body}>
      <Skeleton width="100%" height={20} />
      <Skeleton width="80%" height={20} />
      <Skeleton width="90%" height={20} />
    </View>
    <View style={styles.footer}>
      <Skeleton width="100%" height={36} borderRadius={6} />
    </View>
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    flexDirection: 'column',
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  body: {
    flexDirection: 'column',
    gap: 12,
    marginTop: 8,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 16,
    flexDirection: 'row',
    gap: 8,
  }
});

export default Skeleton;
