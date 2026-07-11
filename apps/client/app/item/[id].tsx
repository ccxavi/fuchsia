import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert, useWindowDimensions, Platform, DeviceEventEmitter, Modal } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { Image } from 'expo-image';
import { ArrowLeft, Trash2, Palette, Folder, Layers, Upload, Plus, MoreHorizontal, Edit2, X, Check } from 'lucide-react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { FuchsiaColors, FuchsiaFonts } from '@/constants/theme';
import { getClothingItem, deleteClothingItem, ClothingItemWithDetailsResponse, OutfitWithItemsResponse, WardrobeResponse, getWardrobes, addItemToWardrobe, removeItemFromWardrobe } from '@/api/client';

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  
  const [item, setItem] = useState<ClothingItemWithDetailsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  useEffect(() => {
    if (id) {
      fetchItem();
    }
    
    // Listen for edits from the modal
    const subscription = DeviceEventEmitter.addListener('itemUpdated', (updatedItem) => {
      if (updatedItem && updatedItem.id === id) {
        setItem(updatedItem);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [id]);

  const fetchItem = async () => {
    try {
      const data = await getClothingItem(id!);
      setItem(data);
    } catch (err) {
      console.error('Failed to fetch item details:', err);
      DeviceEventEmitter.emit('showGlobalAlert', {
        title: 'Error',
        message: 'Failed to load item details.',
      });
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = () => {
    setMenuVisible(false);
    DeviceEventEmitter.emit('showGlobalAlert', {
      title: 'Delete this item?',
      message: 'This action cannot be undone. It will be permanently removed from your closet, any past or scheduled outfits, and any wardrobes it belongs to.',
      confirmText: 'Delete',
      cancelText: 'Keep it',
      isDestructive: true,
      onConfirm: confirmDelete,
    });
  };

  const confirmDelete = async () => {
    DeviceEventEmitter.emit('showGlobalAlert', {
      title: 'Deleting...',
      message: 'Please wait while we delete this item.',
      isLoading: true,
    });
    try {
      await deleteClothingItem(id!);
      DeviceEventEmitter.emit('hideGlobalAlert');
      DeviceEventEmitter.emit('showGlobalToast', 'Item deleted successfully');
      router.back();
    } catch (err) {
      console.error('Failed to delete item:', err);
      DeviceEventEmitter.emit('hideGlobalAlert');
      DeviceEventEmitter.emit('showGlobalAlert', {
        title: 'Error',
        message: 'Could not delete the item. Please try again.',
      });
    }
  };

  if (isLoading || !item) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={FuchsiaColors.vibrant} />
      </View>
    );
  }

  // Format the uploaded date
  const uploadDate = new Date(item.created_at).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric'
  });

  const placeholderImage = `https://placehold.co/800x800/FDF2F8/86003C/png?text=${encodeURIComponent(item.name)}`;

  const renderOutfitImage = (item: OutfitWithItemsResponse) => {
    const items = item.clothing_items || [];
    
    // If user uploaded a custom image, prioritize it over the 2x2 grid collage
    if (item.images && item.images.length > 0) {
      const coverImage = item.images[0];
      return <Image source={{ uri: coverImage.image_url }} style={StyleSheet.absoluteFill} contentFit="cover" />;
    }

    if (items.length === 0) {
      return (
        <LinearGradient
          colors={['#D4145A', '#86003C']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}
        >
          <Text style={{ fontFamily: FuchsiaFonts.heading, fontSize: 14, color: '#fff', textAlign: 'center', paddingHorizontal: 8 }} numberOfLines={2}>{item.name}</Text>
        </LinearGradient>
      );
    }

    if (items.length === 1) {
      return (
        <View style={[{ flex: 1, backgroundColor: FuchsiaColors.mist }]}>
          <Image source={{ uri: items[0].image_url || '' }} style={StyleSheet.absoluteFill} contentFit="cover" />
        </View>
      );
    }

    if (items.length === 2) {
      return (
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <View style={{ flex: 1, borderRightWidth: 1, borderColor: '#fff', backgroundColor: FuchsiaColors.mist }}>
            <Image source={{ uri: items[0].image_url || '' }} style={{ flex: 1 }} contentFit="cover" />
          </View>
          <View style={{ flex: 1, borderLeftWidth: 1, borderColor: '#fff', backgroundColor: FuchsiaColors.mist }}>
            <Image source={{ uri: items[1].image_url || '' }} style={{ flex: 1 }} contentFit="cover" />
          </View>
        </View>
      );
    }

    if (items.length === 3) {
      return (
        <View style={{ flex: 1 }}>
          <View style={{ flex: 1, borderBottomWidth: 1, borderColor: '#fff', backgroundColor: FuchsiaColors.mist }}>
            <Image source={{ uri: items[0].image_url || '' }} style={{ flex: 1 }} contentFit="cover" />
          </View>
          <View style={{ flex: 1, flexDirection: 'row', borderTopWidth: 1, borderColor: '#fff' }}>
            <View style={{ flex: 1, borderRightWidth: 1, borderColor: '#fff', backgroundColor: FuchsiaColors.mist }}>
              <Image source={{ uri: items[1].image_url || '' }} style={{ flex: 1 }} contentFit="cover" />
            </View>
            <View style={{ flex: 1, borderLeftWidth: 1, borderColor: '#fff', backgroundColor: FuchsiaColors.mist }}>
              <Image source={{ uri: items[2].image_url || '' }} style={{ flex: 1 }} contentFit="cover" />
            </View>
          </View>
        </View>
      );
    }

    // 4 or more items
    const extraCount = items.length - 4;
    return (
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1, flexDirection: 'row', borderBottomWidth: 1, borderColor: '#fff' }}>
          <View style={{ flex: 1, borderRightWidth: 1, borderColor: '#fff', backgroundColor: FuchsiaColors.mist }}>
            <Image source={{ uri: items[0].image_url || '' }} style={{ flex: 1 }} contentFit="cover" />
          </View>
          <View style={{ flex: 1, borderLeftWidth: 1, borderColor: '#fff', backgroundColor: FuchsiaColors.mist }}>
            <Image source={{ uri: items[1].image_url || '' }} style={{ flex: 1 }} contentFit="cover" />
          </View>
        </View>
        <View style={{ flex: 1, flexDirection: 'row', borderTopWidth: 1, borderColor: '#fff' }}>
          <View style={{ flex: 1, borderRightWidth: 1, borderColor: '#fff', backgroundColor: FuchsiaColors.mist }}>
            <Image source={{ uri: items[2].image_url || '' }} style={{ flex: 1 }} contentFit="cover" />
          </View>
          <View style={{ flex: 1, borderLeftWidth: 1, borderColor: '#fff', backgroundColor: FuchsiaColors.mist }}>
            <Image source={{ uri: items[3].image_url || '' }} style={{ flex: 1 }} contentFit="cover" />
            {items.length > 4 && (
              <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: FuchsiaFonts.heading, fontSize: 16, color: '#fff', fontWeight: 'bold' }}>+{extraCount}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      
      {/* Fixed Navigation Overlay */}
      <View style={[styles.navOverlay, { top: insets.top + 16 }]} pointerEvents="box-none">
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color={FuchsiaColors.slate} size={20} />
        </Pressable>
        <Pressable onPress={() => setMenuVisible(!menuVisible)} style={styles.backButton}>
          {isDeleting ? <ActivityIndicator size="small" color={FuchsiaColors.slate} /> : <MoreHorizontal color={FuchsiaColors.slate} size={20} />}
        </Pressable>
      </View>

      {/* Dropdown Menu Backdrop */}
      {menuVisible && (
        <Pressable 
          style={[StyleSheet.absoluteFill, { zIndex: 100 }]}
          onPress={() => setMenuVisible(false)} 
        />
      )}

      {/* Custom Dropdown Menu UI */}
      {menuVisible && (
        <View style={[styles.dropdownMenu, { top: insets.top + 16 + 48 }]}>
          <Pressable 
            style={({ pressed }) => [styles.dropdownItem, pressed && styles.dropdownItemPressed]} 
            onPress={() => {
              setMenuVisible(false);
              router.push({ pathname: '/add-item', params: { id } });
            }}
          >
            <Edit2 size={16} color={FuchsiaColors.slate} />
            <Text style={styles.dropdownItemText}>Edit Item</Text>
          </Pressable>
          <View style={styles.dropdownDivider} />
          <Pressable 
            style={({ pressed }) => [styles.dropdownItem, pressed && styles.dropdownItemPressed]} 
            onPress={() => {
              setMenuVisible(false);
              handleDelete();
            }}
          >
            <Trash2 size={16} color="#E11D48" />
            <Text style={[styles.dropdownItemText, { color: '#E11D48' }]}>Delete Item</Text>
          </Pressable>
        </View>
      )}

      <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: (insets.bottom || 24) + 16 }}>
        
        {/* Hero Image Section */}
        <View style={[styles.heroContainer, { height: width }]}>
          <Image 
            source={{ uri: item.image_url || placeholderImage }} 
            style={StyleSheet.absoluteFill} 
            contentFit="cover"
            transition={300}
          />
        </View>

        {/* Content Section */}
        <View style={styles.contentContainer}>
          <View style={styles.titleRow}>
            <View style={styles.titleLeft}>
              <Text style={styles.title}>{item.name}</Text>
              {!!item.brand && (
                <Text style={styles.brandText}>{item.brand}</Text>
              )}
            </View>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{item.category || 'Item'}</Text>
            </View>
          </View>

          {/* Metadata Grid */}
          <View style={styles.metadataGrid}>
            <View style={styles.statCard}>
              <View style={styles.statHeader}>
                <Palette size={16} color={FuchsiaColors.slate} />
                <Text style={styles.statLabel}>Color</Text>
              </View>
              <Text style={styles.statValue}>{item.color || 'Unspecified'}</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statHeader}>
                <Layers size={16} color={FuchsiaColors.slate} />
                <Text style={styles.statLabel}>Outfits</Text>
              </View>
              <Text style={styles.statValue}>
                {item.outfits_count} {item.outfits_count === 1 ? 'outfit' : 'outfits'}
              </Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statHeader}>
                <Folder size={16} color={FuchsiaColors.slate} />
                <Text style={styles.statLabel}>Wardrobes</Text>
              </View>
              <Text style={styles.statValue}>
                {item.wardrobes_count} {item.wardrobes_count === 1 ? 'wardrobe' : 'wardrobes'}
              </Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statHeader}>
                <Upload size={16} color={FuchsiaColors.slate} />
                <Text style={styles.statLabel}>Uploaded</Text>
              </View>
              <Text style={styles.statValue}>{uploadDate}</Text>
            </View>
          </View>

          {/* Styled In / Outfits Section */}
          <View style={styles.styledInSection}>
            <View style={styles.styledInHeader}>
              <Text style={styles.styledInTitle}>Styled In</Text>
            </View>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              contentContainerStyle={styles.styledInScroll}
              snapToInterval={160 + 16}
              decelerationRate="fast"
            >
              {item.outfits?.map(outfit => (
                <Pressable 
                  key={outfit.id} 
                  style={styles.outfitCard}
                  onPress={() => router.push(`/outfit/${outfit.id}`)}
                >
                  <View style={styles.outfitImageContainer}>
                    {renderOutfitImage(outfit)}
                  </View>
                  <View style={styles.outfitInfo}>
                    <Text style={styles.outfitTitle} numberOfLines={1}>{outfit.name}</Text>
                    <Text style={styles.outfitSubtitle}>{outfit.clothing_items_count} Items</Text>
                  </View>
                </Pressable>
              ))}

              {/* Style It Button */}
              <View style={styles.outfitCard}>
                <Pressable 
                  style={styles.addOutfitInner}
                  onPress={() => router.push({ pathname: '/add-outfit', params: { itemId: id } })}
                >
                  <Plus size={24} color={FuchsiaColors.slate} />
                  <Text style={styles.addOutfitText}>STYLE IT</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>

          {/* Packed In / Wardrobes Section */}
          {item.wardrobes?.length > 0 && (
            <View style={styles.styledInSection}>
              <View style={styles.styledInHeader}>
                <Text style={styles.styledInTitle}>Packed In</Text>
              </View>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                contentContainerStyle={styles.styledInScroll}
              >
                {item.wardrobes.map(wardrobe => (
                  <Pressable 
                    key={wardrobe.id} 
                    style={styles.wardrobeCard}
                    onPress={() => router.push(`/wardrobe/${wardrobe.id}`)}
                  >
                    {wardrobe.image_url ? (
                      <View style={styles.wardrobeImage}>
                        <Image 
                          source={{ uri: wardrobe.image_url }} 
                          style={[StyleSheet.absoluteFillObject, styles.wardrobeImageStyle]} 
                          contentFit="cover" 
                        />
                        <LinearGradient
                          colors={['transparent', 'rgba(0,0,0,0.8)']}
                          style={[StyleSheet.absoluteFillObject, styles.wardrobeGradient]}
                        >
                          <Text style={styles.wardrobeCardTitle}>{wardrobe.name}</Text>
                          <Text style={styles.wardrobeCardSubtitle}>{wardrobe.clothing_items_count} Items</Text>
                        </LinearGradient>
                      </View>
                    ) : (
                      <LinearGradient
                        colors={['#D4145A', '#86003C']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.wardrobeImage}
                      >
                        <LinearGradient
                          colors={['transparent', 'rgba(0,0,0,0.4)']}
                          style={styles.wardrobeGradient}
                        >
                          <Text style={styles.wardrobeCardTitle}>{wardrobe.name}</Text>
                          <Text style={styles.wardrobeCardSubtitle}>{wardrobe.clothing_items_count} Items</Text>
                        </LinearGradient>
                      </LinearGradient>
                    )}
                  </Pressable>
                ))}

                {/* Pack It Button */}
                <Pressable 
                  style={styles.addWardrobeCard}
                  onPress={() => router.push(`/item/${id}/select-wardrobes`)}
                >
                  <View style={styles.addWardrobeInner}>
                    <Plus size={20} color={FuchsiaColors.slate} />
                    <Text style={styles.addOutfitText}>PACK IT</Text>
                  </View>
                </Pressable>
              </ScrollView>
            </View>
          )}

        </View>
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: FuchsiaColors.cloud,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: FuchsiaColors.cloud,
  },
  heroContainer: {
    width: '100%',
    backgroundColor: '#fff',
    position: 'relative',
  },
  navOverlay: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  dropdownMenu: {
    position: 'absolute',
    right: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 8,
    width: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 10,
    zIndex: 101,
    borderWidth: 1,
    borderColor: 'rgba(229, 229, 239, 0.5)',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  dropdownItemPressed: {
    backgroundColor: FuchsiaColors.cloud,
  },
  dropdownItemText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 15,
    fontWeight: '600',
    color: FuchsiaColors.ink,
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: FuchsiaColors.cloud,
    marginVertical: 4,
  },
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
  alertDeleteButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#E11D48',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertDeleteText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: FuchsiaColors.mist,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  titleLeft: {
    flex: 1,
    paddingRight: 16,
  },
  title: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 24,
    fontWeight: '700',
    color: FuchsiaColors.ink,
    marginBottom: 4,
  },
  brandText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 14,
    fontWeight: '500',
    color: FuchsiaColors.slate,
  },
  categoryBadge: {
    backgroundColor: FuchsiaColors.blush,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  categoryBadgeText: {
    fontFamily: FuchsiaFonts.body,
    fontWeight: '700',
    fontSize: 12,
    color: FuchsiaColors.deep,
  },
  metadataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '48%', // Approx half minus gap
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: FuchsiaColors.mist,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontFamily: FuchsiaFonts.body,
    fontWeight: '500',
    fontSize: 12,
    color: FuchsiaColors.slate,
  },
  statValue: {
    fontFamily: FuchsiaFonts.body,
    fontWeight: '600',
    fontSize: 14,
    color: FuchsiaColors.ink,
    marginTop: 2,
  },
  styledInSection: {
    marginTop: 32,
  },
  styledInHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  styledInTitle: {
    fontFamily: FuchsiaFonts.heading,
    fontWeight: '600',
    fontSize: 18,
    color: FuchsiaColors.ink,
  },
  seeAllText: {
    fontFamily: FuchsiaFonts.body,
    fontWeight: '600',
    fontSize: 12,
    color: FuchsiaColors.deep,
  },
  styledInScroll: {
    gap: 16,
    paddingRight: 20,
  },
  outfitCard: {
    width: 160,
    flexDirection: 'column',
    gap: 8,
  },
  outfitImageContainer: {
    width: 160,
    aspectRatio: 4 / 5,
    borderRadius: 20,
    backgroundColor: FuchsiaColors.cloud,
    overflow: 'hidden',
  },
  outfitInfo: {
    paddingHorizontal: 4,
  },
  outfitTitle: {
    fontFamily: FuchsiaFonts.body,
    fontWeight: '600',
    fontSize: 14,
    color: FuchsiaColors.ink,
  },
  outfitSubtitle: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 12,
    color: FuchsiaColors.slate,
    marginTop: 2,
  },
  addOutfitInner: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: FuchsiaColors.mist,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(248, 248, 252, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addOutfitText: {
    fontFamily: FuchsiaFonts.body,
    fontWeight: '600',
    fontSize: 12,
    color: FuchsiaColors.slate,
  },
  addWardrobeCard: {
    width: 240,
    height: 140,
    backgroundColor: 'transparent',
  },
  addWardrobeInner: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: FuchsiaColors.mist,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(248, 248, 252, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  wardrobeCard: {
    height: 140,
    width: 240,
    borderRadius: 20,
    backgroundColor: FuchsiaColors.ink,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  wardrobeImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
  },
  wardrobeImageStyle: {
    opacity: 0.8,
  },
  wardrobeGradient: {
    padding: 16,
    justifyContent: 'flex-end',
  },
  wardrobeCardTitle: {
    fontFamily: FuchsiaFonts.heading,
    fontWeight: '700',
    fontSize: 16,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  wardrobeCardSubtitle: {
    fontFamily: FuchsiaFonts.body,
    fontWeight: '500',
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
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
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FuchsiaColors.mist,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  wardrobeListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginBottom: 8,
    backgroundColor: FuchsiaColors.cloud,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  wardrobeListItemSelected: {
    borderColor: FuchsiaColors.deep,
    backgroundColor: FuchsiaColors.blush,
  },
  wardrobeListImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
  },
  wardrobeListText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 16,
    fontWeight: '500',
    color: FuchsiaColors.ink,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: FuchsiaColors.mist,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: FuchsiaColors.deep,
    borderColor: FuchsiaColors.deep,
  },
  emptyMessage: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 14,
    color: FuchsiaColors.slate,
    textAlign: 'center',
    marginTop: 24,
  }
});
