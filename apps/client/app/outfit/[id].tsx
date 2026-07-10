import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, DeviceEventEmitter, TextInput, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { Image } from 'expo-image';
import { ArrowLeft, Edit2, Trash2, Layers, Camera, X, Check, Plus, MoreHorizontal, Info, Calendar } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { CustomDatePicker } from '@/components/ui/CustomDatePicker';
import { CustomAlert } from '@/components/ui/CustomAlert';

import { FuchsiaColors, FuchsiaFonts } from '@/constants/theme';
import { getOutfit, deleteOutfit, updateOutfit, deleteOutfitImage, addItemToOutfit, removeItemFromOutfit, addWardrobeToOutfit, removeWardrobeFromOutfit, createCalendarOutfit, OutfitWithWardrobesResponse } from '@/api/client';

export default function OutfitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  // Outfit State
  const [outfit, setOutfit] = useState<OutfitWithWardrobesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [focusedPhotoId, setFocusedPhotoId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (id) {
      fetchOutfit();
    }

    const subscription = DeviceEventEmitter.addListener('outfitUpdated', (payload) => {
      const updatedId = typeof payload === 'string' ? payload : payload?.id;
      if (updatedId === id) {
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
    DeviceEventEmitter.emit('showGlobalAlert', {
      title: 'Delete this outfit?',
      message: 'This action cannot be undone and will permanently remove this outfit.',
      confirmText: 'Delete',
      cancelText: 'Keep it',
      isDestructive: true,
      onConfirm: confirmDelete,
    });
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
    DeviceEventEmitter.emit('showGlobalAlert', {
      title: 'Deleting...',
      message: 'Please wait while we delete this outfit.',
      isLoading: true,
    });
    try {
      await deleteOutfit(id!);
      DeviceEventEmitter.emit('hideGlobalAlert');
      DeviceEventEmitter.emit('showGlobalToast', 'Outfit deleted successfully');
      DeviceEventEmitter.emit('outfitUpdated');
      router.back();
    } catch (err) {
      console.error('Failed to delete outfit:', err);
      DeviceEventEmitter.emit('hideGlobalAlert');
    }
  };

  const promptDeleteImage = (imageId: string) => {
    setPhotoToDelete(imageId);
    DeviceEventEmitter.emit('showGlobalAlert', {
      title: 'Delete this photo?',
      message: 'Are you sure you want to remove this photo from the outfit?',
      confirmText: 'Remove',
      cancelText: 'Keep it',
      isDestructive: true,
      onConfirm: () => confirmDeletePhoto(imageId),
    });
  };

  const confirmDeletePhoto = async (imageId: string) => {
    DeviceEventEmitter.emit('showGlobalAlert', {
      title: 'Deleting...',
      message: 'Please wait while we remove this photo.',
      isLoading: true,
    });
    try {
      await deleteOutfitImage(imageId);
      if (focusedPhotoId === imageId) {
        setFocusedPhotoId(null);
      }
      await fetchOutfit();
      DeviceEventEmitter.emit('hideGlobalAlert');
    } catch (err) {
      console.error('Failed to delete image:', err);
      DeviceEventEmitter.emit('hideGlobalAlert');
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
        <Text style={styles.headerTitle}>Outfit Detail</Text>
        <Pressable 
          onPress={() => setMenuVisible(true)} 
          style={styles.headerButton}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color={FuchsiaColors.slate} />
          ) : (
            <MoreHorizontal size={18} color={FuchsiaColors.slate} />
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
              handleAddPhoto();
            }}
          >
            <Camera size={16} color={FuchsiaColors.slate} />
            <Text style={styles.dropdownItemText}>Add Photo</Text>
          </Pressable>
          <View style={styles.dropdownDivider} />
          <Pressable
            style={({ pressed }) => [styles.dropdownItem, pressed && styles.dropdownItemPressed]}
            onPress={() => {
              setMenuVisible(false);
              router.push(`/add-outfit?id=${outfit.id}`);
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

      {/* Custom Date Picker */}
      <CustomDatePicker
        visible={showDatePicker}
        value={new Date()}
        onClose={() => setShowDatePicker(false)}
        onChange={async (event, date) => {
          setShowDatePicker(false);
          if (date && outfit) {
            try {
              await createCalendarOutfit({
                outfit_id: outfit.id,
                date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
              });
              DeviceEventEmitter.emit('showGlobalToast', 'Outfit scheduled successfully!');
            } catch (err: any) {
              console.error('Failed to schedule outfit:', err);
              if (err.message && err.message.includes('400')) {
                DeviceEventEmitter.emit('showGlobalAlert', {
                  title: 'Duplicate',
                  message: 'This outfit is already scheduled on that day!',
                  confirmText: 'Got it',
                });
              } else {
                DeviceEventEmitter.emit('showGlobalAlert', {
                  title: 'Error',
                  message: 'Failed to schedule outfit',
                });
              }
            }
          }
        }}
      />




      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: (insets.bottom || 24) + 16 }}
      >
        {/* Outfit Name */}
        <View style={styles.nameSection}>
          <View style={{ flex: 1, paddingRight: 16 }}>
            <Text style={styles.outfitName} numberOfLines={1}>{outfit.name}</Text>
          </View>
          <Text style={styles.outfitSubtitle}>
            {outfit.is_ai_generated ? 'AI Curated  ·  ' : ''}
            {outfit.clothing_items.length} {outfit.clothing_items.length === 1 ? 'Item' : 'Items'}
          </Text>
        </View>

        {/* My Photos */}
        <View style={styles.card}>
          <View style={styles.myPhotosHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.cardLabel, { marginBottom: 0 }]}>MY PHOTOS</Text>
              {outfit.images && outfit.images.length > 0 && (
                <Pressable 
                  onPress={() => {
                    DeviceEventEmitter.emit('showGlobalAlert', {
                    title: 'Managing Photos',
                    message: 'To delete a photo, simply tap and hold on the photo you wish to remove.',
                    confirmText: 'Got it',
                  });}} 
                  hitSlop={8}
                >
                  <Info size={14} color={FuchsiaColors.slate} />
                </Pressable>
              )}
            </View>
            <Text style={styles.myPhotosCount}>
              {outfit.images ? outfit.images.length : 0} photos
            </Text>
          </View>
          
          {/* Main Focus Image */}
          {outfit.images && outfit.images.length > 0 && focusedPhotoId ? (
            <View style={styles.mainFocusContainer}>
              {outfit.images.map(img => (
                img.id === focusedPhotoId && (
                  <Pressable 
                    key={img.id} 
                    style={StyleSheet.absoluteFillObject}
                    onLongPress={() => promptDeleteImage(img.id)}
                  >
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
                  </Pressable>
                )
              ))}
            </View>
          ) : null}

          {/* Thumbnail Carousel or Empty State */}
          {!outfit.images || outfit.images.length === 0 ? (
            <View style={styles.emptyPhotosContainer}>
              <Text style={styles.emptyPhotosText}>
                No photos yet. You can add one from the menu!
              </Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbnailCarousel}
            >
              {/* Existing Photos */}

              {/* Existing Photos */}
              {outfit.images && outfit.images.map((img) => {
                const isFocused = img.id === focusedPhotoId;
                return (
                  <Pressable
                    key={img.id}
                    style={[styles.thumbnailBtn, isFocused && styles.thumbnailBtnFocused]}
                    onPress={() => setFocusedPhotoId(img.id)}
                    onLongPress={() => promptDeleteImage(img.id)}
                  >
                    <Image source={{ uri: img.image_url }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
                    {isFocused && (
                      <View style={styles.thumbnailOverlay} />
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
            <Text style={styles.cardLabel}>ITEMS</Text>
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
                  <View style={styles.itemBadge}>
                    <Text style={styles.itemBadgeText}>{item.category || 'Item'}</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={[styles.card, { paddingRight: 0 }]}>
            <View style={[styles.myPhotosHeader, { paddingRight: 20 }]}>
              <Text style={[styles.cardLabel, { marginBottom: 0 }]}>In Wardrobes</Text>
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
                  <View key={w.id} style={{ position: 'relative', marginRight: 12 }}>
                    <Pressable
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
                  </Pressable>
                </View>
                ))}
              </ScrollView>
            )}
          </View>

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

        {/* Schedule Button */}
        <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
          <Pressable 
            style={{ borderRadius: 16, overflow: 'hidden', elevation: 4, shadowColor: FuchsiaColors.vibrant, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12 }}
            onPress={() => setShowDatePicker(true)}
          >
            <LinearGradient
              colors={['#D4145A', '#86003C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryScheduleButton}
            >
              <Calendar size={20} color="#fff" />
              <Text style={styles.primaryScheduleButtonText}>Schedule Outfit</Text>
            </LinearGradient>
          </Pressable>
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
  primaryScheduleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    borderRadius: 16,
  },
  primaryScheduleButtonText: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: FuchsiaColors.cloud,
  },

  // Name section
  nameSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  outfitName: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 26,
    fontWeight: '700',
    color: FuchsiaColors.ink,
  },
  outfitNameInput: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 26,
    fontWeight: '700',
    color: FuchsiaColors.ink,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: FuchsiaColors.mist,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  outfitSubtitle: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 14,
    color: FuchsiaColors.slate,
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
    width: '100%',
    aspectRatio: 4 / 5,
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
