import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, DeviceEventEmitter, TextInput } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { Image } from 'expo-image';
import { ArrowLeft, Edit2, Trash2, Layers, Camera, X, Check, Plus } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';

import { FuchsiaColors, FuchsiaFonts } from '@/constants/theme';
import { getOutfit, deleteOutfit, updateOutfit, deleteOutfitImage, removeItemFromOutfit, removeWardrobeFromOutfit, OutfitWithWardrobesResponse } from '@/api/client';

export default function OutfitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const [outfit, setOutfit] = useState<OutfitWithWardrobesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [deleteAlertVisible, setDeleteAlertVisible] = useState(false);
  const [focusedPhotoId, setFocusedPhotoId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Edit Mode State
  const [isEditMode, setIsEditMode] = useState(false);
  const [editableName, setEditableName] = useState('');

  useEffect(() => {
    if (id) {
      fetchOutfit();
    }

    const subscription = DeviceEventEmitter.addListener('outfitUpdated', (updatedOutfit) => {
      if (updatedOutfit && updatedOutfit.id === id) {
        // Re-fetch to get full data with clothing_items
        fetchOutfit();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [id]);

  const fetchOutfit = async () => {
    try {
      const data = await getOutfit(id!);
      setOutfit(data);
      setEditableName(data.name);
      if (data.images && data.images.length > 0 && !focusedPhotoId) {
        setFocusedPhotoId(data.images[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch outfit:', err);
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = () => {
    setMenuVisible(false);
    setDeleteAlertVisible(true);
  };

  const handleAddPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0].uri) {
        setIsUploading(true);
        await updateOutfit(id!, { imageUri: result.assets[0].uri });
        
        // After upload, re-fetch outfit so the new image appears in the array
        const updatedData = await getOutfit(id!);
        setOutfit(updatedData);
        if (updatedData.images && updatedData.images.length > 0) {
          // Auto-focus the newly added image (which is at index 0 because the backend sorts descending)
          setFocusedPhotoId(updatedData.images[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to upload photo:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteOutfit(id!);
      router.back();
    } catch (err) {
      console.error('Failed to delete outfit:', err);
      setIsDeleting(false);
      setDeleteAlertVisible(false);
    }
  };

  const toggleEditMode = async () => {
    if (!outfit) return;

    if (isEditMode) {
      // Save changes
      if (editableName.trim() !== outfit.name && editableName.trim() !== '') {
        try {
          setIsLoading(true); // show loader during save
          await updateOutfit(id!, { name: editableName.trim() });
          await fetchOutfit();
        } catch (err) {
          console.error('Failed to update outfit name:', err);
        } finally {
          setIsLoading(false);
        }
      }
    }
    setIsEditMode(!isEditMode);
  };

  const handleDeleteImage = async (imageId: string) => {
    try {
      await deleteOutfitImage(imageId);
      if (focusedPhotoId === imageId) {
        setFocusedPhotoId(null);
      }
      await fetchOutfit();
    } catch (err) {
      console.error('Failed to delete image:', err);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    try {
      await removeItemFromOutfit(id!, itemId);
      await fetchOutfit();
    } catch (err) {
      console.error('Failed to remove item from outfit:', err);
    }
  };

  if (isLoading || !outfit) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={FuchsiaColors.vibrant} />
      </View>
    );
  }

  const createdDate = new Date(outfit.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerButton}>
          <ArrowLeft size={18} color={FuchsiaColors.slate} />
        </Pressable>
        <Text style={styles.headerTitle}>{isEditMode ? 'Edit Outfit' : 'Outfit Detail'}</Text>
        <Pressable 
          onPress={toggleEditMode} 
          style={[styles.headerButton, isEditMode && styles.headerButtonActive]}
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color={FuchsiaColors.slate} />
          ) : isEditMode ? (
            <Check size={18} color={FuchsiaColors.vibrant} />
          ) : (
            <Edit2 size={18} color={FuchsiaColors.slate} />
          )}
        </Pressable>
      </View>

      {/* Dropdown Menu Backdrop */}
      {menuVisible && (
        <Pressable
          style={[StyleSheet.absoluteFill, { zIndex: 100 }]}
          onPress={() => setMenuVisible(false)}
        />
      )}

      {/* Dropdown Menu */}
      {menuVisible && (
        <View style={[styles.dropdownMenu, { top: insets.top + 56 }]}>
          <Pressable
            style={({ pressed }) => [styles.dropdownItem, pressed && styles.dropdownItemPressed]}
            onPress={() => {
              setMenuVisible(false);
              router.push({ pathname: '/add-outfit', params: { id } });
            }}
          >
            <Edit2 size={16} color={FuchsiaColors.slate} />
            <Text style={styles.dropdownItemText}>Edit Outfit</Text>
          </Pressable>
          <View style={styles.dropdownDivider} />
          <Pressable
            style={({ pressed }) => [styles.dropdownItem, pressed && styles.dropdownItemPressed]}
            onPress={handleDelete}
          >
            <Trash2 size={16} color="#E11D48" />
            <Text style={[styles.dropdownItemText, { color: '#E11D48' }]}>Delete Outfit</Text>
          </Pressable>
        </View>
      )}

      {/* Delete Confirmation */}
      {deleteAlertVisible && (
        <View style={styles.alertOverlay}>
          <View style={styles.alertBox}>
            <Text style={styles.alertTitle}>Delete this outfit?</Text>
            <Text style={styles.alertMessage}>
              This action cannot be undone and will permanently remove this outfit.
            </Text>
            <View style={styles.alertButtonsRow}>
              <Pressable
                style={styles.alertCancelButton}
                onPress={() => setDeleteAlertVisible(false)}
                disabled={isDeleting}
              >
                <Text style={styles.alertCancelText}>Keep it</Text>
              </Pressable>
              <Pressable
                style={styles.alertDeleteButton}
                onPress={confirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.alertDeleteText}>Delete</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      )}

      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: (insets.bottom || 24) + 16 }}
      >
        {/* Outfit Name */}
        <View style={styles.nameSection}>
          {isEditMode ? (
            <TextInput
              style={styles.outfitNameInput}
              value={editableName}
              onChangeText={setEditableName}
              placeholder="Outfit Name"
            />
          ) : (
            <Text style={styles.outfitName}>{outfit.name}</Text>
          )}
          <View style={styles.tagsRow}>
            {outfit.is_ai_generated && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>AI Curated</Text>
              </View>
            )}
            <View style={styles.tag}>
              <Text style={styles.tagText}>
                {outfit.clothing_items.length} {outfit.clothing_items.length === 1 ? 'Item' : 'Items'}
              </Text>
            </View>
          </View>
        </View>

        {/* My Photos */}
        <View style={styles.card}>
          <View style={styles.myPhotosHeader}>
            <Text style={styles.cardLabel}>MY PHOTOS</Text>
            <Text style={styles.myPhotosCount}>
              {outfit.images ? outfit.images.length : 0} photos
            </Text>
          </View>
          
          {/* Main Focus Image */}
          {outfit.images && outfit.images.length > 0 && focusedPhotoId ? (
            <View style={styles.mainFocusContainer}>
              {outfit.images.map(img => (
                img.id === focusedPhotoId && (
                  <View key={img.id} style={StyleSheet.absoluteFillObject}>
                    <Image
                      source={{ uri: img.image_url }}
                      style={StyleSheet.absoluteFillObject}
                      contentFit="cover"
                      transition={300}
                    />
                    {img.date && (
                      <View style={styles.mainFocusDateBadge}>
                        <Text style={styles.mainFocusDateText}>
                          {new Date(img.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </Text>
                      </View>
                    )}
                  </View>
                )
              ))}
            </View>
          ) : null}

          {/* Thumbnail Carousel or Empty State */}
          {!outfit.images || outfit.images.length === 0 ? (
            <Pressable 
              style={styles.emptyPhotosContainer}
              onPress={isEditMode ? handleAddPhoto : undefined}
              disabled={isUploading || !isEditMode}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color={FuchsiaColors.slate} />
              ) : (
                <Text style={styles.emptyPhotosText}>
                  {isEditMode 
                    ? "No photos yet. Tap here to add a photo!" 
                    : "No photos yet. Tap Edit to add photos of you wearing this outfit."}
                </Text>
              )}
            </Pressable>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbnailCarousel}
            >
              {/* Add Photo Button (Only visible in edit mode) */}
              {isEditMode && (
                <Pressable
                  style={styles.addPhotoBtn}
                  onPress={handleAddPhoto}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <ActivityIndicator size="small" color={FuchsiaColors.slate} />
                  ) : (
                    <>
                      <Camera size={16} color={FuchsiaColors.slate} />
                      <Text style={styles.addPhotoBtnText}>Add</Text>
                    </>
                  )}
                </Pressable>
              )}

              {/* Existing Photos */}
              {outfit.images && outfit.images.map((img) => {
                const isFocused = img.id === focusedPhotoId;
                return (
                  <Pressable
                    key={img.id}
                    style={[styles.thumbnailBtn, isFocused && styles.thumbnailBtnFocused]}
                    onPress={() => setFocusedPhotoId(img.id)}
                  >
                    <Image source={{ uri: img.image_url }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
                    {isFocused && (
                      <View style={styles.thumbnailOverlay} />
                    )}
                    {isEditMode && (
                      <Pressable 
                        style={styles.photoDeleteBtn}
                        onPress={() => handleDeleteImage(img.id)}
                      >
                        <X size={10} color="#fff" />
                      </Pressable>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* All Pieces */}
        <View style={styles.card}>
          <View style={styles.myPhotosHeader}>
            <Text style={styles.cardLabel}>
              {outfit.clothing_items.length} {outfit.clothing_items.length === 1 ? 'Item' : 'Items'}
            </Text>
          </View>

          {outfit.clothing_items.length === 0 ? (
            <View style={styles.emptyItems}>
              <Layers size={24} color={FuchsiaColors.mist} />
              <Text style={styles.emptyItemsText}>No items in this outfit yet</Text>
            </View>
          ) : (
            <ScrollView 
              style={[styles.itemsList, { maxHeight: 290 }]}
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={true}
            >
              {outfit.clothing_items.map((item, index) => (
                <Pressable
                  key={item.id}
                  style={[
                    styles.itemRow,
                    index < outfit.clothing_items.length - 1 && styles.itemRowBorder,
                  ]}
                  onPress={() => router.push(`/item/${item.id}`)}
                >
                  <View style={styles.itemThumb}>
                    {item.image_url ? (
                      <Image
                        source={{ uri: item.image_url }}
                        style={StyleSheet.absoluteFillObject}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: FuchsiaColors.cloud, alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={{ fontSize: 8, color: FuchsiaColors.mist }}>{item.name[0]}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.itemDetails}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemCategory}>{item.category || 'Item'}</Text>
                  </View>
                  {isEditMode ? (
                    <Pressable 
                      style={styles.itemDeleteBtn}
                      onPress={() => handleRemoveItem(item.id)}
                    >
                      <Trash2 size={16} color={FuchsiaColors.vibrant} />
                    </Pressable>
                  ) : (
                    <View style={styles.itemBadge}>
                      <Text style={styles.itemBadgeText}>{item.category || 'Item'}</Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </ScrollView>
          )}
          
          {isEditMode && (
            <Pressable 
              style={styles.addMoreItemsBtn}
              onPress={() => router.push(`/outfit/${outfit.id}/select-items`)}
            >
              <Plus size={16} color={FuchsiaColors.slate} />
              <Text style={styles.addMoreItemsText}>Add More Items</Text>
            </Pressable>
          )}
        </View>

        {/* Wardrobes */}
        {(isEditMode || (outfit.wardrobes && outfit.wardrobes.length > 0)) && (
          <View style={[styles.card, { paddingRight: 0 }]}>
            <View style={[styles.myPhotosHeader, { paddingRight: 20 }]}>
              <Text style={styles.cardLabel}>In Wardrobes</Text>
              {isEditMode && (
                <Pressable onPress={() => router.push(`/outfit/${outfit.id}/select-wardrobes`)}>
                  <Text style={styles.addItemText}>Add to Wardrobe</Text>
                </Pressable>
              )}
            </View>

            {(!outfit.wardrobes || outfit.wardrobes.length === 0) ? (
              <View style={[styles.emptyItems, { marginRight: 20 }]}>
                <Layers size={24} color={FuchsiaColors.mist} />
                <Text style={styles.emptyItemsText}>Not saved in any wardrobes yet</Text>
              </View>
            ) : (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.wardrobesCarousel}
              >
                {outfit.wardrobes.map(w => (
                  <Pressable
                    key={w.id}
                    style={styles.wardrobeCard}
                    onPress={() => router.push(`/wardrobe/${w.id}`)}
                  >
                    {w.image_url ? (
                      <Image source={{ uri: w.image_url }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
                    ) : (
                      <LinearGradient
                        colors={['#D4145A', '#86003C']}
                        style={StyleSheet.absoluteFillObject}
                      />
                    )}
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.8)']}
                      style={styles.wardrobeCardGradient}
                    />
                    <Text style={styles.wardrobeCardName} numberOfLines={2}>{w.name}</Text>
                    {isEditMode && (
                      <Pressable 
                        style={styles.photoDeleteBtn}
                        onPress={async () => {
                          try {
                            setIsLoading(true);
                            await removeWardrobeFromOutfit(outfit.id, w.id);
                            DeviceEventEmitter.emit('outfitUpdated', outfit.id);
                            fetchOutfit();
                          } catch (err) {
                            console.error('Failed to remove wardrobe from outfit', err);
                            setIsLoading(false);
                          }
                        }}
                      >
                        <X size={10} color="#fff" />
                      </Pressable>
                    )}
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* Wear History */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Wear History</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Times worn</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>—</Text>
              <Text style={styles.statLabel}>Last worn</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{createdDate}</Text>
              <Text style={styles.statLabel}>Created</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: FuchsiaColors.cloud,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: FuchsiaColors.cloud,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FuchsiaColors.mist,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 18,
    fontWeight: '600',
    color: FuchsiaColors.ink,
  },
  // Dropdown menu
  dropdownMenu: {
    position: 'absolute',
    right: 20,
    zIndex: 200,
    backgroundColor: '#fff',
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
    minWidth: 180,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  dropdownItemPressed: {
    backgroundColor: FuchsiaColors.cloud,
  },
  dropdownItemText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 14,
    fontWeight: '500',
    color: FuchsiaColors.ink,
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: FuchsiaColors.cloud,
  },
  // Alert overlay
  alertOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    zIndex: 300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertBox: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 15,
  },
  alertTitle: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 28,
    fontWeight: '700',
    color: FuchsiaColors.deep,
    marginBottom: 8,
    textAlign: 'center',
  },
  alertMessage: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 14,
    color: FuchsiaColors.slate,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  alertButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  alertCancelButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FuchsiaColors.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertCancelText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: FuchsiaColors.ink,
  },
  alertDeleteButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#E11D48',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertDeleteText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  // Name section
  nameSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  outfitName: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 22,
    color: FuchsiaColors.ink,
  },
  outfitNameInput: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 28,
    fontWeight: '700',
    color: FuchsiaColors.deep,
    marginBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: FuchsiaColors.vibrant,
    paddingVertical: 4,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  tag: {
    backgroundColor: '#FDF2F8',
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 10,
    fontWeight: '600',
    color: FuchsiaColors.deep,
  },
  // Outfit image
  outfitImageSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  outfitImageContainer: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: 20,
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: FuchsiaColors.cloud,
    overflow: 'hidden',
  },
  myPhotosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  myPhotosCount: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 10,
    fontWeight: '500',
    color: FuchsiaColors.slate,
  },
  mainFocusContainer: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: FuchsiaColors.cloud,
    borderWidth: 1,
    borderColor: FuchsiaColors.mist,
    marginBottom: 12,
  },
  mainFocusDateBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  mainFocusDateText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 12,
    fontWeight: '500',
    color: '#fff',
  },
  thumbnailCarousel: {
    gap: 8,
    paddingBottom: 4,
  },
  addPhotoBtn: {
    width: 64,
    height: 64,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: FuchsiaColors.mist,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(253, 242, 248, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addPhotoBtnText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 8,
    fontWeight: '600',
    textTransform: 'uppercase',
    color: FuchsiaColors.slate,
  },
  thumbnailBtn: {
    width: 64,
    height: 64,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: FuchsiaColors.cloud,
  },
  thumbnailBtnFocused: {
    borderColor: FuchsiaColors.vibrant,
  },
  thumbnailOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  photoDeleteBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPhotosContainer: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: FuchsiaColors.cloud,
    borderStyle: 'dashed',
    marginBottom: 8,
  },
  emptyPhotosText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 13,
    color: FuchsiaColors.slate,
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 20,
  },
  // Card sections
  card: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: FuchsiaColors.mist,
    backgroundColor: '#fff',
    padding: 16,
  },
  cardLabel: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: FuchsiaColors.slate,
    marginBottom: 12,
  },
  // Items list
  emptyItems: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 24,
  },
  emptyItemsText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 13,
    color: FuchsiaColors.mist,
  },
  itemsList: {
    gap: 0,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  itemRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: FuchsiaColors.mist,
  },
  itemThumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: FuchsiaColors.mist,
    backgroundColor: '#fff',
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: FuchsiaColors.ink,
  },
  itemCategory: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 12,
    color: FuchsiaColors.slate,
    marginTop: 2,
  },
  itemBadge: {
    backgroundColor: '#FDF2F8',
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  itemBadgeText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 10,
    fontWeight: '500',
    color: FuchsiaColors.deep,
  },
  // Wardrobes
  wardrobesCarousel: {
    paddingRight: 20,
    gap: 12,
  },
  wardrobeCard: {
    width: 140,
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: FuchsiaColors.cloud,
  },
  wardrobeCardGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
  },
  wardrobeCardName: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    fontFamily: FuchsiaFonts.heading,
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: FuchsiaColors.cloud,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: FuchsiaFonts.data,
    fontSize: 18,
    fontWeight: '500',
    color: FuchsiaColors.deep,
  },
  statLabel: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 10,
    color: FuchsiaColors.slate,
    marginTop: 4,
  },
  headerButtonActive: {
    backgroundColor: FuchsiaColors.blush,
    borderColor: FuchsiaColors.mist,
  },
  itemDeleteBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addItemText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: FuchsiaColors.vibrant,
  },
  addMoreItemsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: FuchsiaColors.mist,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(253, 242, 248, 0.5)',
  },
  addMoreItemsText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: FuchsiaColors.slate,
  },
});
