import { View, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import { router } from 'expo-router';
import { ArrowLeft, Image as ImageIcon, Upload, Calendar, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { FuchsiaColors, FuchsiaFonts } from '@/constants/theme';
import { createWardrobe } from '@/api/client';

export default function AddWardrobeScreen() {
  const insets = useSafeAreaInsets();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [name, setName] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Sorry, we need camera roll permissions to make this work!');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      alert('Sorry, we need camera permissions to make this work!');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const pickImage = () => {
    import('react-native').then(({ Alert }) => {
      Alert.alert(
        'Cover Photo',
        'Choose a photo source',
        [
          { text: 'Take Photo', onPress: handleTakePhoto },
          { text: 'Choose from Gallery', onPress: handlePickImage },
          { text: 'Cancel', style: 'cancel' },
        ],
        { cancelable: true }
      );
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Wardrobe name is required');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      await createWardrobe({
        name: name.trim(),
        quantity: 0,
      });
      router.back();
    } catch (err: any) {
      setError(err.message || 'Failed to create wardrobe');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={20} color={FuchsiaColors.slate} />
        </Pressable>
        <ThemedText style={styles.headerTitle}>New Wardrobe</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        
        {/* Cover Photo Upload Area */}
        {imageUri ? (
          <View style={styles.previewContainer}>
            <Image source={{ uri: imageUri }} style={styles.previewImage} contentFit="cover" />
            <Pressable style={styles.removeImageButton} onPress={() => setImageUri(null)}>
              <X size={16} color="#fff" />
            </Pressable>
          </View>
        ) : (
          <View style={styles.uploadArea}>
            <View style={styles.uploadIconContainer}>
              <ImageIcon size={28} color="#fff" />
            </View>
            <View style={{ alignItems: 'center' }}>
              <ThemedText style={styles.uploadTitle}>Cover Photo</ThemedText>
              <ThemedText style={styles.uploadSubtitle}>Add a photo to represent this wardrobe or trip</ThemedText>
            </View>
            <Pressable style={styles.uploadButton} onPress={pickImage}>
              <Upload size={16} color={FuchsiaColors.ink} style={{ marginRight: 8 }} />
              <ThemedText style={styles.uploadButtonText}>Upload</ThemedText>
            </Pressable>
          </View>
        )}

        <View style={styles.divider} />

        {/* Editable Fields */}
        <View style={styles.formGroup}>
          <ThemedText style={styles.label}>Wardrobe Name</ThemedText>
          <TextInput
            style={styles.input}
            placeholder="e.g. Trip to Japan, Fall Basics..."
            placeholderTextColor={FuchsiaColors.slate}
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (error) setError('');
            }}
          />
        </View>

        {/* Spacer before error text */}
        <View style={{ height: 8 }} />

        {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: (insets.bottom || 24) + 16 }]}>
        <Pressable 
          onPress={handleSave}
          disabled={!name.trim() || isLoading}
          style={({ pressed }) => [
            { transform: [{ scale: pressed ? 0.98 : 1 }] },
            (!name.trim() || isLoading) && styles.saveButtonDisabled
          ]}
        >
          <LinearGradient
            colors={['#86003C', '#B5004D', '#D4145A']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.saveButton}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.saveButtonText}>Save Wardrobe</ThemedText>
            )}
          </LinearGradient>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: FuchsiaColors.cloud,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 18,
    fontWeight: '600',
    color: FuchsiaColors.ink,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FuchsiaColors.mist,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  previewContainer: {
    height: 180,
    marginBottom: 24,
    position: 'relative',
    backgroundColor: FuchsiaColors.cloud,
    borderRadius: 16,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  removeImageButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  uploadArea: {
    alignItems: 'center',
    backgroundColor: FuchsiaColors.blush,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(244, 114, 182, 0.5)',
    borderStyle: 'dashed',
    paddingVertical: 40,
    paddingHorizontal: 24,
    gap: 16,
    marginBottom: 24,
  },
  uploadIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: FuchsiaColors.deep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadTitle: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: FuchsiaColors.ink,
  },
  uploadSubtitle: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 12,
    color: FuchsiaColors.slate,
    marginTop: 4,
    textAlign: 'center',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: FuchsiaColors.mist,
    borderRadius: 12,
    paddingHorizontal: 24,
    minHeight: 40,
  },
  uploadButtonText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: FuchsiaColors.ink,
  },
  divider: {
    height: 1,
    backgroundColor: FuchsiaColors.mist,
    marginBottom: 24,
  },
  formGroup: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
  },
  label: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 12,
    fontWeight: '500',
    color: FuchsiaColors.slate,
    marginBottom: 6,
  },
  input: {
    minHeight: 44,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: FuchsiaColors.mist,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontFamily: FuchsiaFonts.body,
    fontSize: 14,
    color: FuchsiaColors.ink,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: FuchsiaColors.mist,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  inputInner: {
    flex: 1,
    fontFamily: FuchsiaFonts.body,
    fontSize: 14,
    color: FuchsiaColors.ink,
    padding: 0,
  },
  errorText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 14,
    color: 'red',
    marginTop: 8,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  saveButton: {
    minHeight: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
