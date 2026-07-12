import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, useWindowDimensions, DeviceEventEmitter, TextInput, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { Image } from 'expo-image';
import { X, Search, ArrowLeft, Check, ShoppingBag } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { FuchsiaColors, FuchsiaFonts } from '@/constants/theme';
import { getOutfits, createCalendarOutfit, OutfitWithItemsResponse } from '@/api/client';
import { GridSkeleton } from '@/components/ui/Skeleton';

export default function SelectOutfitScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const itemWidth = (width - 48) / 2;

  const [outfits, setOutfits] = useState<OutfitWithItemsResponse[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCartModal, setShowCartModal] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const allOutfits = await getOutfits();
        setOutfits(allOutfits);
      } catch (err) {
        console.error('Failed to load outfits', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const toggleSelection = (outfitId: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(outfitId)) {
        newSet.delete(outfitId);
      } else {
        newSet.add(outfitId);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    if (!date || isSaving || selectedIds.size === 0) return;
    setIsSaving(true);
    
    try {
      const promises = Array.from(selectedIds).map(outfitId => 
        createCalendarOutfit({
          outfit_id: outfitId,
          date: date.split('T')[0],
          notes: undefined
        })
      );
      
      await Promise.all(promises);
      
      DeviceEventEmitter.emit('calendarUpdated');
      DeviceEventEmitter.emit('showGlobalToast', `${selectedIds.size} outfit${selectedIds.size > 1 ? 's' : ''} logged!`);
      router.back();
    } catch (err) {
      console.error('Failed to log outfits', err);
      alert('Failed to log outfits. Please try again.');
      setIsSaving(false);
    }
  };

  const filteredOutfits = outfits.filter(o => 
    !searchQuery || o.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderOutfitImage = (item: OutfitWithItemsResponse) => {
    const items = item.clothing_items || [];
    
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

  const selectedCount = selectedIds.size;
  const selectedOutfitsData = outfits.filter(o => selectedIds.has(o.id));

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => router.back()} style={styles.iconButton} disabled={isSaving}>
            <ArrowLeft size={20} color={FuchsiaColors.slate} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitleSub} numberOfLines={1}>
              Select Outfits
            </Text>
          </View>
          <Pressable 
            style={styles.iconButton}
            onPress={() => setShowCartModal(true)}
            disabled={selectedCount === 0 || isSaving}
          >
            <ShoppingBag size={20} color={selectedCount > 0 ? FuchsiaColors.ink : FuchsiaColors.slate} />
            {selectedCount > 0 && (
              <View style={[styles.cartBadge, { top: -8, right: -8, backgroundColor: FuchsiaColors.vibrant }]}>
                <Text style={styles.cartBadgeText}>{selectedCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchContainer}>
            <Search size={18} color={FuchsiaColors.slate} style={{ marginLeft: 12, marginRight: 8 }} />
            <TextInput
              style={styles.searchInputInner}
              placeholder="Search outfits..."
              placeholderTextColor={FuchsiaColors.mist}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} style={styles.searchClearButton}>
                <X size={16} color={FuchsiaColors.slate} />
              </Pressable>
            )}
          </View>
        </View>
      </View>

      <View style={styles.filterBanner}>
        <Text style={styles.statsLabel}>All outfits</Text>
        <Text style={styles.statsCount}>{filteredOutfits.length} found</Text>
      </View>

      <View style={styles.flex1}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {isLoading ? (
            <GridSkeleton />
          ) : filteredOutfits.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No outfits found</Text>
              <Text style={styles.emptySubtitle}>Try adjusting your search or create a new outfit.</Text>
            </View>
          ) : (
            <View style={styles.gridContainer}>
              {filteredOutfits.map(outfit => {
                const isSelected = selectedIds.has(outfit.id);
                
                return (
                  <Pressable 
                    key={outfit.id} 
                    style={[styles.itemCard, { width: itemWidth }]}
                    onPress={() => toggleSelection(outfit.id)}
                    disabled={isSaving}
                  >
                    <View style={[
                      styles.itemImageContainer, 
                      { height: itemWidth * 1.25 },
                      isSelected && styles.itemImageContainerSelected
                    ]}>
                      {renderOutfitImage(outfit)}
                      
                      {isSelected && (
                        <View style={styles.selectedOverlay}>
                          <View style={styles.checkmarkBadge}>
                            <Check size={16} color="white" />
                          </View>
                        </View>
                      )}
                    </View>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemTitle} numberOfLines={1}>{outfit.name}</Text>
                      <Text style={styles.itemCategory}>{outfit.clothing_items_count} Items</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
          <View style={{ height: (insets.bottom || 24) + 40 }} />
        </ScrollView>
      </View>

      <Modal
        visible={showCartModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCartModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: (insets.bottom || 24) + 16, maxHeight: '55%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selected Outfits ({selectedCount})</Text>
              <Pressable onPress={() => setShowCartModal(false)} style={styles.modalCloseButton}>
                <X size={20} color={FuchsiaColors.slate} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.cartVerticalScrollContent}>
              {selectedOutfitsData.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>Empty Cart</Text>
                  <Text style={styles.emptySubtitle}>No outfits selected yet.</Text>
                </View>
              ) : (
                selectedOutfitsData.map(outfit => (
                  <View key={`vcart-${outfit.id}`} style={styles.cartVerticalItem}>
                    <View style={styles.cartVerticalItemLeft}>
                      <View style={styles.cartVerticalImageContainer}>
                        {renderOutfitImage(outfit)}
                      </View>
                      <View style={styles.cartVerticalInfo}>
                        <Text style={styles.cartVerticalTitle} numberOfLines={1}>{outfit.name}</Text>
                        <Text style={styles.cartVerticalCategory}>{outfit.clothing_items_count} Items</Text>
                      </View>
                    </View>
                    <Pressable onPress={() => toggleSelection(outfit.id)} style={styles.cartVerticalRemoveButton}>
                      <Text style={styles.cartVerticalRemoveText}>Remove</Text>
                    </Pressable>
                  </View>
                ))
              )}
            </ScrollView>
            
            <View style={styles.cartFooter}>
              <Pressable 
                onPress={() => {
                  setShowCartModal(false);
                  handleSave();
                }}
                disabled={isSaving}
              >
                <LinearGradient
                  colors={[FuchsiaColors.vibrant, FuchsiaColors.deep]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={[styles.cartSaveButton, isSaving && { opacity: 0.7 }]}
                >
                  {isSaving ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text style={styles.cartSaveButtonText}>
                      Log Today
                    </Text>
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  flex1: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: FuchsiaColors.cloud,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FuchsiaColors.mist,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  headerTitleSub: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 18,
    fontWeight: '600',
    color: FuchsiaColors.ink,
  },
  searchRow: {
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    backgroundColor: FuchsiaColors.cloud,
    borderRadius: 12,
    overflow: 'hidden',
  },
  searchInputInner: {
    flex: 1,
    fontFamily: FuchsiaFonts.body,
    fontSize: 14,
    color: FuchsiaColors.ink,
    padding: 0,
  },
  searchClearButton: {
    padding: 12,
  },
  filterBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: FuchsiaColors.cloud,
  },
  statsLabel: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 14,
    color: FuchsiaColors.ink,
    fontWeight: '600',
  },
  statsCount: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 12,
    color: FuchsiaColors.slate,
  },
  content: {
    flex: 1,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 16,
  },
  itemCard: {
    marginBottom: 8,
  },
  itemImageContainer: {
    width: '100%',
    backgroundColor: FuchsiaColors.cloud,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  itemImageContainerSelected: {
    borderColor: FuchsiaColors.vibrant,
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.3)',
    padding: 8,
    alignItems: 'flex-end',
  },
  checkmarkBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: FuchsiaColors.vibrant,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
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
  itemCategory: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 12,
    color: FuchsiaColors.slate,
    marginTop: 2,
  },
  emptyState: {
    paddingVertical: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 18,
    fontWeight: '600',
    color: FuchsiaColors.ink,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 14,
    color: FuchsiaColors.slate,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: FuchsiaColors.ink,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  cartBadgeText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  cartVerticalScrollContent: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  cartVerticalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    padding: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: FuchsiaColors.cloud,
  },
  cartVerticalItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  cartVerticalImageContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: FuchsiaColors.cloud,
    overflow: 'hidden',
  },
  cartVerticalInfo: {
    flex: 1,
  },
  cartVerticalTitle: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 15,
    fontWeight: '600',
    color: FuchsiaColors.ink,
  },
  cartVerticalCategory: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 13,
    color: FuchsiaColors.slate,
    marginTop: 2,
  },
  cartVerticalRemoveButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFF1F2',
    borderRadius: 12,
    marginLeft: 12,
  },
  cartVerticalRemoveText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: '#E11D48',
  },
  cartFooter: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  cartSaveButton: {
    minHeight: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartSaveButtonText: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
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
  }
});
