import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, useWindowDimensions, DeviceEventEmitter, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, MoreHorizontal, Calendar, Plus, Trash2, Edit2, X, Layers } from 'lucide-react-native';

import { FuchsiaColors, FuchsiaFonts } from '@/constants/theme';
import { getWardrobe, deleteWardrobe, WardrobeWithDetailsResponse, OutfitWithItemsResponse } from '@/api/client';

export default function WardrobeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [wardrobe, setWardrobe] = useState<WardrobeWithDetailsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [deleteAlertVisible, setDeleteAlertVisible] = useState(false);
  const [addOutfitActionSheetVisible, setAddOutfitActionSheetVisible] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      try {
        const wardrobeData = await getWardrobe(id as string);
        setWardrobe(wardrobeData);
      } catch (err) {
        console.error('Failed to load wardrobe details', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();

    const subscription = DeviceEventEmitter.addListener('wardrobeUpdated', (updatedId) => {
      if (updatedId === id) {
        loadData();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [id]);

  if (isLoading || !wardrobe) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={FuchsiaColors.vibrant} size="large" />
      </View>
    );
  }

  const handleDelete = () => {
    setDeleteAlertVisible(true);
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteWardrobe(id as string);
      router.back();
    } catch (err) {
      console.error('Failed to delete wardrobe:', err);
      setIsDeleting(false);
      setDeleteAlertVisible(false);
    }
  };

  // Calculate grid dimensions for packed items
  const GRID_GAP = 16;
  const PADDING_HORIZONTAL = 20;
  const itemWidth = (width - PADDING_HORIZONTAL * 2 - GRID_GAP) / 2;

  const dateObj = new Date(wardrobe.created_at);
  const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const renderOutfitImage = (item: OutfitWithItemsResponse) => {
    const items = item.clothing_items || [];
    
    // If user uploaded a custom image, prioritize it over the 2x2 grid collage
    if (item.images && item.images.length > 0) {
      const coverImage = item.images[0];
      return <Image source={{ uri: coverImage.image_url }} style={StyleSheet.absoluteFillObject} contentFit="cover" />;
    }

    if (items.length === 0) {
      return (
        <LinearGradient
          colors={['#D4145A', '#86003C']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFillObject, { alignItems: 'center', justifyContent: 'center' }]}
        >
          <Text style={{ fontFamily: FuchsiaFonts.heading, fontSize: 14, color: '#fff', textAlign: 'center', paddingHorizontal: 8 }} numberOfLines={2}>{item.name}</Text>
        </LinearGradient>
      );
    }

    if (items.length === 1) {
      return (
        <View style={[{ flex: 1, backgroundColor: FuchsiaColors.mist }]}>
          <Image source={{ uri: items[0].image_url || '' }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
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
    const extraCount = items.length - 3;
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
      {/* Fixed Navigation Buttons */}
      <Pressable 
        style={[styles.heroButton, { top: insets.top + 16, left: 20 }]} 
        onPress={() => router.back()}
      >
        <ArrowLeft size={20} color={FuchsiaColors.slate} />
      </Pressable>

      <Pressable 
        style={[styles.heroButton, { top: insets.top + 16, right: 20 }]}
        onPress={() => setMenuVisible(!menuVisible)}
      >
        {isDeleting ? <ActivityIndicator size="small" color={FuchsiaColors.slate} /> : <MoreHorizontal size={20} color={FuchsiaColors.slate} />}
      </Pressable>

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
              router.push({ pathname: '/add-wardrobe', params: { id } });
            }}
          >
            <Edit2 size={16} color={FuchsiaColors.slate} />
            <Text style={styles.dropdownItemText}>Edit Wardrobe</Text>
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
            <Text style={[styles.dropdownItemText, { color: '#E11D48' }]}>Delete Wardrobe</Text>
          </Pressable>
        </View>
      )}

      <ScrollView style={styles.container} bounces={false} showsVerticalScrollIndicator={false}>
        {/* Hero Header */}
        <View style={styles.heroSection}>
          {wardrobe.image_url ? (
            <Image source={{ uri: wardrobe.image_url }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
          ) : (
            <LinearGradient
              colors={['#D4145A', '#86003C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
          )}
          
          <LinearGradient
            colors={['rgba(26,26,46,0.9)', 'rgba(26,26,46,0.3)', 'rgba(26,26,46,0.4)']}
            style={StyleSheet.absoluteFillObject}
          />

          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>{wardrobe.name}</Text>
            <View style={styles.heroStatsRow}>
              <View style={styles.heroStatItem}>
                <Calendar size={14} color="rgba(255,255,255,0.8)" />
                <Text style={styles.heroStatText}>{formattedDate}</Text>
              </View>
              <Text style={styles.heroStatText}> ·  {wardrobe.outfits.length} Outfits  ·  {wardrobe.clothing_items.length} Items</Text>
            </View>
          </View>
        </View>

        {/* Outfits Section (Carousel) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Planned Outfits</Text>
          </View>

          {wardrobe.outfits.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No outfits planned yet</Text>
              <Text style={styles.emptySubtitle}>Mix and match your packed items to create beautiful outfits.</Text>
              <Pressable 
                style={styles.dashedCircleButton}
                onPress={() => setAddOutfitActionSheetVisible(true)}
              >
                <Plus size={24} color={FuchsiaColors.slate} />
              </Pressable>
            </View>
          ) : (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselContainer}
              snapToInterval={160 + 16}
              decelerationRate="fast"
            >
              {wardrobe.outfits.map(outfit => (
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
              
              <View style={styles.outfitCard}>
                <Pressable 
                  style={styles.addOutfitButton}
                  onPress={() => setAddOutfitActionSheetVisible(true)}
                >
                  <Plus size={24} color={FuchsiaColors.slate} />
                  <Text style={styles.addOutfitText}>Add Outfit</Text>
                </Pressable>
              </View>
            </ScrollView>
          )}
        </View>

        <View style={styles.divider} />

        {/* Packed Items Section */}
        <View style={[styles.section, { paddingBottom: (insets.bottom || 24) + 20 }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Packed Items</Text>
          </View>

          {wardrobe.clothing_items.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No items packed yet</Text>
              <Text style={styles.emptySubtitle}>Start adding clothes to this wardrobe from your closet or create new ones.</Text>
              <Pressable 
                style={styles.dashedCircleButton}
                onPress={() => router.push(`/wardrobe/${wardrobe.id}/select-items`)}
              >
                <Plus size={24} color={FuchsiaColors.slate} />
              </Pressable>
            </View>
          ) : (
            <View style={styles.gridContainer}>
              {wardrobe.clothing_items.map(item => (
                <Pressable 
                  key={item.id} 
                  style={[styles.itemCard, { width: itemWidth }]}
                  onPress={() => router.push(`/item/${item.id}`)}
                >
                  <View style={[styles.itemImageContainer, { height: itemWidth * 1.25 }]}>
                    {item.image_url ? (
                      <Image source={{ uri: item.image_url }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
                    ) : (
                      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: FuchsiaColors.mist }]} />
                    )}
                    {item.category && (
                      <View style={styles.categoryPill}>
                        <Text style={styles.categoryPillText}>{item.category}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemTitle} numberOfLines={1}>{item.name}</Text>
                  </View>
                </Pressable>
              ))}
              <Pressable 
                style={[
                  styles.addOutfitButton, 
                  { width: itemWidth, height: itemWidth * 1.25, aspectRatio: undefined }
                ]}
                onPress={() => router.push(`/wardrobe/${wardrobe.id}/select-items`)}
              >
                <Plus size={24} color={FuchsiaColors.slate} />
                <Text style={styles.addOutfitText}>Add Item</Text>
              </Pressable>
            </View>
          )}
        </View>

      </ScrollView>

      {/* Custom Delete Confirmation Alert */}
      {deleteAlertVisible && (
        <View style={styles.alertOverlay}>
          <View style={styles.alertBox}>
            <Text style={styles.alertTitle}>Delete this wardrobe?</Text>
            <Text style={styles.alertMessage}>
              This action will permanently remove this wardrobe. Your clothing items will remain in your closet.
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
                {isDeleting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.alertDeleteText}>Delete</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* Add Outfit Action Sheet */}
      <Modal
        visible={addOutfitActionSheetVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAddOutfitActionSheetVisible(false)}
      >
        <View style={styles.actionSheetOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setAddOutfitActionSheetVisible(false)} />
          <View style={[styles.actionSheetContent, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <View style={styles.actionSheetHeader}>
              <Text style={styles.actionSheetTitle}>Add Outfit</Text>
              <Pressable 
                style={styles.actionSheetCloseButton} 
                onPress={() => setAddOutfitActionSheetVisible(false)}
              >
                <X size={20} color={FuchsiaColors.slate} />
              </Pressable>
            </View>
            
            <Pressable 
              style={styles.actionSheetOption}
              onPress={() => {
                setAddOutfitActionSheetVisible(false);
                router.push(`/wardrobe/${wardrobe.id}/select-outfits`);
              }}
            >
              <View style={styles.actionSheetOptionIcon}>
                <Layers size={24} color={FuchsiaColors.deep} />
              </View>
              <View style={styles.actionSheetOptionTextContainer}>
                <Text style={styles.actionSheetOptionTitle}>Select Existing</Text>
                <Text style={styles.actionSheetOptionSubtitle}>Choose from your closet</Text>
              </View>
            </Pressable>

            <Pressable 
              style={styles.actionSheetOption}
              onPress={() => {
                setAddOutfitActionSheetVisible(false);
                router.push({ pathname: '/add-outfit', params: { wardrobeId: wardrobe.id } });
              }}
            >
              <View style={styles.actionSheetOptionIcon}>
                <Plus size={24} color={FuchsiaColors.vibrant} />
              </View>
              <View style={styles.actionSheetOptionTextContainer}>
                <Text style={styles.actionSheetOptionTitle}>Create New</Text>
                <Text style={styles.actionSheetOptionSubtitle}>Build an outfit for this trip</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  heroSection: {
    width: '100%',
    height: 320,
    position: 'relative',
  },
  heroButton: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  heroContent: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
  },
  heroTitle: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  heroStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroStatText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
  },
  dropdownMenu: {
    position: 'absolute',
    right: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 8,
    width: 200,
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
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
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
  section: {
    marginTop: 32,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 20,
    fontWeight: '600',
    color: FuchsiaColors.ink,
  },
  sectionAction: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: FuchsiaColors.deep,
  },
  carouselContainer: {
    paddingRight: 20,
    gap: 16,
  },
  outfitCard: {
    width: 160,
    flexDirection: 'column',
    gap: 8,
  },
  outfitImageContainer: {
    width: 160,
    aspectRatio: 4/5,
    borderRadius: 20,
    backgroundColor: FuchsiaColors.cloud,
    overflow: 'hidden',
  },
  outfitInfo: {
    paddingHorizontal: 4,
  },
  outfitTitle: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: FuchsiaColors.ink,
  },
  outfitSubtitle: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 12,
    color: FuchsiaColors.slate,
    marginTop: 2,
  },
  addOutfitButton: {
    width: '100%',
    aspectRatio: 4/5,
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
    fontSize: 12,
    fontWeight: '600',
    color: FuchsiaColors.slate,
  },
  divider: {
    height: 1,
    backgroundColor: FuchsiaColors.mist,
    marginHorizontal: 20,
    marginTop: 32,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  itemCard: {
    flexDirection: 'column',
    gap: 8,
  },
  itemImageContainer: {
    width: '100%',
    borderRadius: 20,
    backgroundColor: FuchsiaColors.cloud,
    overflow: 'hidden',
    position: 'relative',
  },
  categoryPill: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  categoryPillText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 10,
    fontWeight: '600',
    color: FuchsiaColors.ink,
  },
  itemInfo: {
    paddingHorizontal: 4,
  },
  itemTitle: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: FuchsiaColors.ink,
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: FuchsiaColors.cloud,
    borderRadius: 16,
  },
  emptyTitle: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 16,
    fontWeight: '600',
    color: FuchsiaColors.ink,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 14,
    color: FuchsiaColors.slate,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  dashedCircleButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: FuchsiaColors.mist,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  actionSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  actionSheetContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  actionSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  actionSheetTitle: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 20,
    fontWeight: '600',
    color: FuchsiaColors.ink,
  },
  actionSheetCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FuchsiaColors.mist,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: FuchsiaColors.cloud,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  actionSheetOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  actionSheetOptionTextContainer: {
    flex: 1,
  },
  actionSheetOptionTitle: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 16,
    fontWeight: '600',
    color: FuchsiaColors.ink,
    marginBottom: 4,
  },
  actionSheetOptionSubtitle: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 13,
    color: FuchsiaColors.slate,
  }
});
