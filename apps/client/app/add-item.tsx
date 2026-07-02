import { View, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { ArrowLeft, Camera, Image as ImageIcon, Sparkles, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { FuchsiaColors, FuchsiaFonts } from '@/constants/theme';
import { createClothingItem, getWardrobes, WardrobeResponse } from '@/api/client';

export default function AddItemScreen() {
  const insets = useSafeAreaInsets();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [color, setColor] = useState('');
  const [season, setSeason] = useState('');
  
  const [tags, setTags] = useState<string[]>(['Casual', 'Denim']);
  const [tagInput, setTagInput] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Removed wardrobe fetching since we're using tags instead

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Sorry, we need camera roll permissions to make this work!');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 5],
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
      aspect: [4, 5],
      quality: 0.8,
    });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Item name is required');
      return;
    }
    setIsLoading(true);
    setError('');
    
    try {
      await createClothingItem({
        name: name.trim(),
        category: category.trim() || undefined,
        color: color.trim() || undefined,
        // Since API doesn't support tags/season yet, we won't send them
        imageUri: imageUri || undefined,
      });
      router.back();
    } catch (err: any) {
      setError(err.message || 'Failed to add item');
    } finally {
      setIsLoading(false);
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const addTag = () => {
    const newTag = tagInput.trim();
    if (newTag && !tags.includes(newTag)) {
      setTags([...tags, newTag]);
    }
    setTagInput('');
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={20} color={FuchsiaColors.slate} />
        </Pressable>
        <ThemedText style={styles.headerTitle}>Add Item</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        
        {/* Upload Area */}
        <View style={styles.uploadArea}>
          <View style={styles.uploadIconContainer}>
            <Camera size={28} color="#fff" />
          </View>
          <View style={{ alignItems: 'center' }}>
            <ThemedText style={styles.uploadTitle}>Take a photo or upload</ThemedText>
            <ThemedText style={styles.uploadSubtitle}>AI will auto-detect the item and remove the background</ThemedText>
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

        {/* Image Preview / AI Detection Mockup */}
        {imageUri && (
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <View style={styles.sparkleIcon}>
                <Sparkles size={12} color="#fff" />
              </View>
              <ThemedText style={styles.previewHeaderText}>AI DETECTED</ThemedText>
            </View>
            <View style={styles.previewRow}>
              <View style={styles.previewImageContainer}>
                <Image source={{ uri: imageUri }} style={styles.previewImage} contentFit="cover" />
              </View>
              <View style={styles.previewDetails}>
                <ThemedText style={styles.previewName}>{name || 'New Item'}</ThemedText>
                <ThemedText style={styles.previewSubtext}>Ready to be added to your closet</ThemedText>
              </View>
            </View>
          </View>
        )}

        {/* Editable Fields */}
        <View style={styles.detailsSection}>
          <ThemedText style={styles.sectionTitle}>Item Details</ThemedText>
          
          <View style={styles.formGroup}>
            <ThemedText style={styles.label}>Name</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="e.g. Denim Jacket"
              placeholderTextColor={FuchsiaColors.mist}
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.formGroup}>
            <ThemedText style={styles.label}>Category</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="e.g. Outerwear"
              placeholderTextColor={FuchsiaColors.mist}
              value={category}
              onChangeText={setCategory}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.formGroup, { flex: 1, marginRight: 6 }]}>
              <ThemedText style={styles.label}>Color</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="e.g. Blue"
                placeholderTextColor={FuchsiaColors.mist}
                value={color}
                onChangeText={setColor}
              />
            </View>
            
            <View style={[styles.formGroup, { flex: 1, marginLeft: 6 }]}>
              <ThemedText style={styles.label}>Season</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="e.g. All seasons"
                placeholderTextColor={FuchsiaColors.mist}
                value={season}
                onChangeText={setSeason}
              />
            </View>
          </View>

          {/* Tags */}
          <View style={styles.formGroup}>
            <ThemedText style={styles.label}>Tags</ThemedText>
            <View style={styles.tagsContainer}>
              {tags.map((tag) => (
                <View key={tag} style={styles.tagPill}>
                  <ThemedText style={styles.tagText}>{tag}</ThemedText>
                  <Pressable onPress={() => removeTag(tag)} style={{ marginLeft: 4, padding: 2 }}>
                    <X size={12} color={FuchsiaColors.deep} />
                  </Pressable>
                </View>
              ))}
              <TextInput
                style={styles.tagInput}
                placeholder="Add tag..."
                placeholderTextColor={FuchsiaColors.slate}
                value={tagInput}
                onChangeText={setTagInput}
                onSubmitEditing={addTag}
                returnKeyType="done"
                blurOnSubmit={false}
              />
            </View>
          </View>

          {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
        </View>
        <View style={{ height: 24 }} />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: (insets.bottom || 24) + 16 }]}>
        <Pressable 
          onPress={handleSave}
          disabled={!name.trim() || isLoading}
          style={({ pressed }) => [
            styles.saveButton,
            { transform: [{ scale: pressed ? 0.98 : 1 }] },
            (!name.trim() || isLoading) && styles.saveButtonDisabled
          ]}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={styles.saveButtonText}>Save to Closet</ThemedText>
          )}
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
    fontWeight: '500',
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
    marginBottom: 20,
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
  previewCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: FuchsiaColors.mist,
    padding: 16,
    marginBottom: 20,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sparkleIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: FuchsiaColors.deep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewHeaderText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: FuchsiaColors.deep,
    letterSpacing: 0.5,
  },
  previewRow: {
    flexDirection: 'row',
    gap: 12,
  },
  previewImageContainer: {
    width: 96,
    height: 96,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FuchsiaColors.mist,
    backgroundColor: FuchsiaColors.cloud,
    overflow: 'hidden',
  },
  previewImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  previewDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  previewName: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 16,
    fontWeight: '600',
    color: FuchsiaColors.ink,
    marginBottom: 4,
  },
  previewSubtext: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 12,
    color: FuchsiaColors.slate,
  },
  detailsSection: {
    gap: 12,
  },
  sectionTitle: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 16,
    color: FuchsiaColors.ink,
    marginBottom: 4,
  },
  formGroup: {
    marginBottom: 12,
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
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    minHeight: 44,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: FuchsiaColors.mist,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FuchsiaColors.blush,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tagText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 12,
    fontWeight: '500',
    color: FuchsiaColors.deep,
  },
  tagInput: {
    flex: 1,
    minWidth: 80,
    fontFamily: FuchsiaFonts.body,
    fontSize: 12,
    color: FuchsiaColors.ink,
    padding: 0,
  },
  errorText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 14,
    color: 'red',
    marginTop: 4,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  saveButton: {
    minHeight: 52,
    backgroundColor: FuchsiaColors.deep,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: FuchsiaColors.deep,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
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
