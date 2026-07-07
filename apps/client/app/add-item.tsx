import { View, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Keyboard, DeviceEventEmitter, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Camera, Image as ImageIcon, Sparkles, X, ChevronDown, ChevronUp, Check } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { FuchsiaColors, FuchsiaFonts } from '@/constants/theme';
import { CLOTHING_CATEGORIES } from '@/constants/categories';
import { createClothingItem, updateClothingItem, getClothingItem, getWardrobes, WardrobeResponse } from '@/api/client';

export default function AddOrEditItemScreen() {
  const { id, wardrobeId } = useLocalSearchParams<{ id?: string, wardrobeId?: string }>();
  const insets = useSafeAreaInsets();
  
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [color, setColor] = useState('');
  
  const [wardrobes, setWardrobes] = useState<WardrobeResponse[]>([]);
  const [selectedWardrobeIds, setSelectedWardrobeIds] = useState<string[]>(
    wardrobeId ? [wardrobeId as string] : []
  );
  

  
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(!!id);
  const [error, setError] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (id) {
      fetchItem();
    }
    
    // Fetch wardrobes for the selector
    getWardrobes()
      .then(setWardrobes)
      .catch(err => console.error('Failed to fetch wardrobes:', err));
  }, [id]);

  const fetchItem = async () => {
    try {
      const data = await getClothingItem(id!);
      setName(data.name || '');
      setCategory(data.category || '');
      setColor(data.color || '');
      setOriginalImage(data.image_url || null);
      if (data.wardrobes && data.wardrobes.length > 0) {
        setSelectedWardrobeIds(data.wardrobes.map(w => w.id));
      }
    } catch (err: any) {
      setError('Failed to fetch item details.');
    } finally {
      setIsFetching(false);
    }
  };

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
      mediaTypes: ['images'],
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
      if (id) {
        const updatedItem = await updateClothingItem(id, {
          name: name.trim(),
          category: category.trim() || undefined,
          color: color.trim() || undefined,
          wardrobe_ids: selectedWardrobeIds,
          imageUri: imageUri || undefined,
        });
        DeviceEventEmitter.emit('itemUpdated', updatedItem);
      } else {
        await createClothingItem({
          name: name.trim(),
          category: category.trim() || undefined,
          color: color.trim() || undefined,
          wardrobe_ids: selectedWardrobeIds.length > 0 ? selectedWardrobeIds : undefined,
          imageUri: imageUri || undefined,
        });
      }
      router.back();
    } catch (err: any) {
      setError(err.message || `Failed to ${id ? 'update' : 'add'} item`);
    } finally {
      setIsLoading(false);
    }
  };



  if (isFetching) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={FuchsiaColors.deep} />
      </View>
    );
  }

  const displayImage = imageUri || originalImage;

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
        <ThemedText style={styles.headerTitle}>{id ? 'Edit Item' : 'Add Item'}</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={{ paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        
        {/* Upload Area */}
        <View style={styles.uploadArea}>
          <View style={styles.uploadIconContainer}>
            <Camera size={28} color="#fff" />
          </View>
          <View style={{ alignItems: 'center' }}>
            <ThemedText style={styles.uploadTitle}>{id ? 'Replace photo' : 'Take a photo or upload'}</ThemedText>
            <ThemedText style={styles.uploadSubtitle}>
              {id ? 'Upload a new photo to replace the current one' : 'AI will auto-detect the item and remove the background'}
            </ThemedText>
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
        {displayImage && (
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <View style={styles.sparkleIcon}>
                <Sparkles size={12} color="#fff" />
              </View>
              <ThemedText style={styles.previewHeaderText}>
                {id && !imageUri ? 'CURRENT IMAGE' : 'AI DETECTED'}
              </ThemedText>
            </View>
            <View style={styles.previewRow}>
              <View style={styles.previewImageContainer}>
                <Image source={{ uri: displayImage }} style={styles.previewImage} contentFit="cover" />
              </View>
              <View style={styles.previewDetails}>
                <ThemedText style={styles.previewName}>{name || 'Item'}</ThemedText>
                <ThemedText style={styles.previewSubtext}>
                  {id && imageUri ? 'Will replace the current photo upon saving' : (id ? 'This is your current photo' : 'Ready to be added to your closet')}
                </ThemedText>
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
            <Pressable 
              style={[styles.input, { justifyContent: 'center' }]} 
              onPress={() => {
                const parentCat = CLOTHING_CATEGORIES.find(c => c.main === category || c.subs.includes(category || ''))?.main || null;
                setExpandedCategory(parentCat);
                setShowCategoryModal(true);
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <ThemedText style={{ color: category ? FuchsiaColors.ink : FuchsiaColors.mist, fontSize: 14 }}>
                  {category || 'Select a category'}
                </ThemedText>
                <ChevronDown size={20} color={FuchsiaColors.slate} />
              </View>
            </Pressable>
          </View>

          <View style={styles.formGroup}>
            <ThemedText style={styles.label}>Color</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="e.g. Blue"
              placeholderTextColor={FuchsiaColors.mist}
              value={color}
              onChangeText={setColor}
            />
          </View>
          
          {/* Wardrobes Selector */}
          {wardrobes.length > 0 && (
            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>Add to Wardrobe(s)</ThemedText>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
              >
                {wardrobes.map((w) => {
                  const isSelected = selectedWardrobeIds.includes(w.id);
                  return (
                    <Pressable
                      key={w.id}
                      style={[
                        styles.wardrobeCard,
                        isSelected && styles.wardrobeCardSelected
                      ]}
                      onPress={() => {
                        if (isSelected) {
                          setSelectedWardrobeIds(prev => prev.filter(id => id !== w.id));
                        } else {
                          setSelectedWardrobeIds(prev => [...prev, w.id]);
                        }
                      }}
                    >
                      {w.image_url ? (
                        <Image source={{ uri: w.image_url }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
                      ) : (
                        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: FuchsiaColors.mist }]} />
                      )}
                      <View style={styles.wardrobeCardOverlay}>
                        <ThemedText style={styles.wardrobeCardText} numberOfLines={2}>{w.name}</ThemedText>
                      </View>
                      {isSelected && (
                        <View style={styles.wardrobeCardCheckmark}>
                          <Check size={12} color="#fff" />
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}



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
            <ThemedText style={styles.saveButtonText}>{id ? 'Save Changes' : 'Save to Closet'}</ThemedText>
          )}
        </Pressable>
      </View>

      {/* Manual Android Keyboard Spacer */}
      {Platform.OS === 'android' && <View style={{ height: keyboardHeight }} />}
      {/* Category Selection Modal */}
      <Modal
        visible={showCategoryModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom || 24 }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Select Category</ThemedText>
              <Pressable onPress={() => setShowCategoryModal(false)} style={styles.modalCloseButton}>
                <X size={20} color={FuchsiaColors.slate} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}>
              {CLOTHING_CATEGORIES.map((section) => {
                const isExpanded = expandedCategory === section.main;
                const hasSubs = section.subs.length > 0;

                return (
                  <View key={section.main} style={styles.categorySection}>
                    <Pressable 
                      style={styles.categoryItem}
                      onPress={() => {
                        if (hasSubs) {
                          setExpandedCategory(isExpanded ? null : section.main);
                        } else {
                          setCategory(section.main);
                          setShowCategoryModal(false);
                        }
                      }}
                    >
                      <ThemedText style={[styles.categoryMainText, category === section.main && styles.categorySelectedText]}>
                        {section.main}
                      </ThemedText>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {category === section.main && !hasSubs && <Check size={18} color={FuchsiaColors.deep} />}
                        {hasSubs && (isExpanded ? <ChevronUp size={20} color={FuchsiaColors.slate} /> : <ChevronDown size={20} color={FuchsiaColors.slate} />)}
                      </View>
                    </Pressable>
                    
                    {hasSubs && isExpanded && (
                      <View style={styles.subCategoryContainer}>
                        <Pressable 
                          style={styles.categoryItem}
                          onPress={() => {
                            setCategory(section.main);
                            setShowCategoryModal(false);
                          }}
                        >
                          <ThemedText style={[styles.categorySubText, category === section.main && styles.categorySelectedText]}>
                            General {section.main}
                          </ThemedText>
                          {category === section.main && <Check size={18} color={FuchsiaColors.deep} />}
                        </Pressable>

                        {section.subs.map((sub) => (
                          <Pressable 
                            key={sub} 
                            style={styles.categoryItem}
                            onPress={() => {
                              setCategory(sub);
                              setShowCategoryModal(false);
                            }}
                          >
                            <ThemedText style={[styles.categorySubText, category === sub && styles.categorySelectedText]}>
                              {sub}
                            </ThemedText>
                            {category === sub && <Check size={18} color={FuchsiaColors.deep} />}
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

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

  wardrobeCard: {
    width: 150,
    height: 100,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: FuchsiaColors.cloud,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  wardrobeCardSelected: {
    borderColor: FuchsiaColors.deep,
  },
  wardrobeCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 26, 46, 0.4)',
    justifyContent: 'flex-end',
    padding: 10,
  },
  wardrobeCardText: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  wardrobeCardCheckmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: FuchsiaColors.deep,
    alignItems: 'center',
    justifyContent: 'center',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: FuchsiaColors.cloud,
  },
  modalTitle: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 18,
    fontWeight: '600',
    color: FuchsiaColors.ink,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalScrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  categorySection: {
    marginBottom: 8,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  subCategoryContainer: {
    marginLeft: 16,
    borderLeftWidth: 1,
    borderLeftColor: FuchsiaColors.mist,
    paddingLeft: 16,
    marginTop: 4,
  },
  categoryMainText: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 16,
    fontWeight: '600',
    color: FuchsiaColors.ink,
  },
  categorySubText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 15,
    color: FuchsiaColors.slate,
  },
  categorySelectedText: {
    color: FuchsiaColors.deep,
    fontWeight: '700',
  },
});
