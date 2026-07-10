import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable, TouchableWithoutFeedback, ActivityIndicator } from 'react-native';
import { FuchsiaColors, FuchsiaFonts } from '@/constants/theme';

export interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
}

export function CustomAlert({
  visible,
  title,
  message,
  onCancel,
  onConfirm,
  confirmText = 'OK',
  cancelText = 'Cancel',
  isDestructive = false,
  isLoading = false,
}: CustomAlertProps) {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={styles.alertOverlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.alertBox}>
              <Text style={styles.alertTitle}>{title}</Text>
              <Text style={styles.alertMessage}>{message}</Text>
              
              <View style={styles.alertButtonsRow}>
                {onConfirm ? (
                  <>
                    <Pressable
                      style={styles.alertCancelButton}
                      onPress={onCancel}
                      disabled={isLoading}
                    >
                      <Text style={styles.alertCancelText}>{cancelText}</Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.alertConfirmButton, 
                        isDestructive ? styles.alertDestructiveButton : styles.alertVibrantButton
                      ]}
                      onPress={onConfirm}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.alertConfirmText}>{confirmText}</Text>
                      )}
                    </Pressable>
                  </>
                ) : (
                  <Pressable
                    style={[styles.alertConfirmButton, styles.alertVibrantButton, { flex: 1 }]}
                    onPress={onCancel}
                  >
                    <Text style={styles.alertConfirmText}>{confirmText}</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  alertOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.4)', // FuchsiaColors.deep with opacity
    zIndex: 200,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  alertBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    shadowColor: FuchsiaColors.deep,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
    borderColor: FuchsiaColors.mist,
  },
  alertTitle: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 22,
    fontWeight: '600',
    color: FuchsiaColors.ink,
    marginBottom: 8,
  },
  alertMessage: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 15,
    color: FuchsiaColors.slate,
    lineHeight: 22,
    marginBottom: 24,
  },
  alertButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  alertCancelButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: FuchsiaColors.mist,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertCancelText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 15,
    fontWeight: '600',
    color: FuchsiaColors.ink,
  },
  alertConfirmButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertDestructiveButton: {
    backgroundColor: '#E11D48',
  },
  alertVibrantButton: {
    backgroundColor: FuchsiaColors.vibrant,
  },
  alertConfirmText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});
