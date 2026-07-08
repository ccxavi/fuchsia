import React from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { FuchsiaFonts } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ToastProps = {
  visible: boolean;
  message: string;
  fadeAnim: Animated.Value;
};

export function Toast({ visible, message, fadeAnim }: ToastProps) {
  const insets = useSafeAreaInsets();
  
  if (!visible) return null;

  return (
    <Animated.View style={[styles.toastContainer, { opacity: fadeAnim, bottom: (insets.bottom || 24) + 20 }]}>
      <Check size={16} color="#fff" />
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 100,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 400,
  },
  toastText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
});
