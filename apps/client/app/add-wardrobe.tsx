import { View, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, DeviceEventEmitter, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Image as ImageIcon, Upload, Calendar, X, Camera } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { FuchsiaColors, FuchsiaFonts } from '@/constants/theme';
import { createWardrobe, getWardrobe, updateWardrobe } from '@/api/client';

export default function AddWardrobeScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isEditing = !!id;

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [name, setName] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(isEditing);
  const [error, setError] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      try {
        const data = await getWardrobe(id);
        setName(data.name);
        if (data.image_url) {
          setImageUri(data.image_url);
        }
      } catch (err) {
        console.error('Failed to load wardrobe', err);
        setError('Failed to load wardrobe data');
      } finally {
        setIsFetching(false);
      }
    }
    loadData();
  }, [id]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Sorry, we need camera roll permissions to make this work!');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
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
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };



  const handleSave = async () => {
    if (!name.trim()) {
      setError('Wardrobe name is required');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      if (isEditing) {
        // If imageUri is a remote URL (starts with http), it means it hasn't changed.
        // We only send imageUri if it's a new local file.
        const isNewImage = imageUri && !imageUri.startsWith('http');
        
        await updateWardrobe(id, {
          name: name.trim(),
          imageUri: isNewImage ? imageUri : undefined,
        });
        DeviceEventEmitter.emit('wardrobeUpdated', id);
        DeviceEventEmitter.emit('showGlobalToast', 'Wardrobe updated successfully');
      } else {
        await createWardrobe({
          name: name.trim(),
          quantity: 0,
          imageUri: imageUri || undefined,
        });
        DeviceEventEmitter.emit('showGlobalToast', 'Wardrobe created successfully');
      }
      router.back();
    } catch (err: any) {
      setError(err.message || 'Failed to save wardrobe');
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={FuchsiaColors.vibrant} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={20} color={FuchsiaColors.slate} />
        </Pressable>
        <ThemedText style={styles.headerTitle}>{isEditing ? 'Edit Wardrobe' : 'New Wardrobe'}</ThemedText>
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
            <View style={styles.uploadButtonsRow}>
              <Pressable style={styles.cameraButton} onPress={handleTakePhoto}>
                <Camera size={16} color="#fff" style={{ marginRight: 8 }} />
                <ThemedText style={styles.cameraButtonText}>Camera</ThemedText>
              </Pressable>
              <Pressable style={styles.galleryButton} onPress={handlePickImage}>
                <ImageIcon size={16} color={FuchsiaColors.ink} style={{ marginRight: 8 }} />
                <ThemedText style={styles.galleryButtonText}>Gallery</ThemedText>
              </Pressable>
            </View>
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

      {/* Manual Android Keyboard Spacer */}
      {Platform.OS === 'android' && <View style={{ height: keyboardHeight }} />}
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
  uploadButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  cameraButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FuchsiaColors.deep,
    borderRadius: 12,
    paddingHorizontal: 16,
    minHeight: 40,
  },
  cameraButtonText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  galleryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: FuchsiaColors.mist,
    borderRadius: 12,
    paddingHorizontal: 16,
    minHeight: 40,
  },
  galleryButtonText: {
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
