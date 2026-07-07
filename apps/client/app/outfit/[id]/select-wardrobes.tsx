import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, useWindowDimensions, DeviceEventEmitter, TextInput, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { Image } from 'expo-image';
import { X, Check, Search, ShoppingBag, ArrowLeft } from 'lucide-react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { FuchsiaColors, FuchsiaFonts } from '@/constants/theme';
import { getWardrobes, getOutfit, addWardrobeToOutfit, removeWardrobeFromOutfit, WardrobeResponse, OutfitWithWardrobesResponse } from '@/api/client';

export default function SelectWardrobesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const itemWidth = (width - 48) / 2;

  const [outfit, setOutfit] = useState<OutfitWithWardrobesResponse | null>(null);
  const [wardrobes, setWardrobes] = useState<WardrobeResponse[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [initialIds, setInitialIds] = useState<Set<string>>(new Set());
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [showCartModal, setShowCartModal] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      try {
        const [outfitData, allWardrobes] = await Promise.all([
          getOutfit(id as string),
          getWardrobes()
        ]);
        
        setOutfit(outfitData);
        setWardrobes(allWardrobes);
        
        const existingIds = new Set(outfitData.wardrobes.map(w => w.id));
        setSelectedIds(existingIds);
        setInitialIds(new Set(existingIds));
      } catch (err) {
        console.error('Failed to load wardrobes', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [id]);

  const toggleSelection = (wardrobeId: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(wardrobeId)) {
        newSet.delete(wardrobeId);
      } else {
        newSet.add(wardrobeId);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    if (!id || isSaving) return;
    setIsSaving(true);
    
    try {
      const added = [...selectedIds].filter(wId => !initialIds.has(wId));
      const removed = [...initialIds].filter(wId => !selectedIds.has(wId));
      
      const promises: Promise<any>[] = [];
      
      for (const wId of added) {
        promises.push(addWardrobeToOutfit(id as string, wId));
      }
      
      for (const wId of removed) {
        promises.push(removeWardrobeFromOutfit(id as string, wId));
      }
      
      await Promise.all(promises);
      
      DeviceEventEmitter.emit('outfitUpdated', id);
      router.back();
    } catch (err) {
      console.error('Failed to save selections', err);
      alert('Failed to save your selections. Please try again.');
      setIsSaving(false);
    }
  };

  const filteredWardrobes = wardrobes.filter(w => {
    return !searchQuery || w.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (isLoading || !outfit) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={FuchsiaColors.vibrant} size="large" />
      </View>
    );
  }

  const selectedCount = selectedIds.size;
  const selectedWardrobesData = wardrobes.filter(w => selectedIds.has(w.id));

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => router.back()} style={styles.iconButton} disabled={isSaving}>
            <ArrowLeft size={20} color={FuchsiaColors.slate} />
          </Pressable>
          <View style={styles.headerCenter}>
            {outfit?.images && outfit.images.length > 0 ? (
              <Image source={{ uri: outfit.images[0].image_url }} style={styles.headerImage} contentFit="cover" />
            ) : (
              <View style={[styles.headerImage, { backgroundColor: FuchsiaColors.mist, alignItems: 'center', justifyContent: 'center' }]}>
                <ShoppingBag size={14} color="#fff" />
              </View>
            )}
            <Text style={styles.headerTitleSub} numberOfLines={1}>
              {outfit?.name || 'Loading...'}
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchContainer}>
            <Search size={18} color={FuchsiaColors.slate} style={{ marginLeft: 12, marginRight: 8 }} />
            <TextInput
              style={styles.searchInputInner}
              placeholder="Search wardrobes..."
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
        <Text style={styles.statsLabel}>All Wardrobes</Text>
        <Text style={styles.statsCount}>{filteredWardrobes.length} found</Text>
      </View>

      {/* Grid */}
      <View style={styles.flex1}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {filteredWardrobes.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No wardrobes found</Text>
              <Text style={styles.emptySubtitle}>Try adjusting your search.</Text>
            </View>
          ) : (
            <View style={styles.gridContainer}>
              {filteredWardrobes.map(wardrobe => {
                const isSelected = selectedIds.has(wardrobe.id);
                
                return (
                  <Pressable 
                    key={wardrobe.id} 
                    style={[styles.itemCard, { width: itemWidth }]}
                    onPress={() => toggleSelection(wardrobe.id)}
                  >
                    <View style={[
                      styles.itemImageContainer, 
                      { height: itemWidth * 1.25 },
                      isSelected && styles.itemImageContainerSelected
                    ]}>
                      {wardrobe.image_url ? (
                        <Image source={{ uri: wardrobe.image_url }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
                      ) : (
                        <LinearGradient
                          colors={['#D4145A', '#86003C']}
                          style={StyleSheet.absoluteFillObject}
                        />
                      )}
                      
                      {isSelected && (
                        <View style={styles.selectedOverlay}>
                          <View style={styles.checkmarkBadge}>
                            <Check size={16} color="white" />
                          </View>
                        </View>
                      )}
                      <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.8)']}
                        style={styles.wardrobeCardGradient}
                      />
                      <Text style={styles.wardrobeCardName} numberOfLines={2}>{wardrobe.name}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
          <View style={{ height: (insets.bottom || 24) + 40 }} />
        </ScrollView>
        
        {selectedCount > 0 && (
          <Animated.View 
            entering={FadeInDown.duration(250)} 
            exiting={FadeOutDown.duration(250)}
            style={[styles.cartFabWrapper, { bottom: (insets.bottom || 24) + 16 }]}
          >
            <Pressable style={styles.cartFab} onPress={() => setShowCartModal(true)}>
              <ShoppingBag size={20} color="white" />
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{selectedCount}</Text>
              </View>
            </Pressable>
          </Animated.View>
        )}
      </View>

      {/* Cart Modal */}
      <Modal
        visible={showCartModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCartModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: (insets.bottom || 24) + 16, maxHeight: '55%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selected Wardrobes ({selectedCount})</Text>
              <Pressable onPress={() => setShowCartModal(false)} style={styles.modalCloseButton}>
                <X size={20} color={FuchsiaColors.slate} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.cartVerticalScrollContent}>
              {selectedWardrobesData.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>Empty Selection</Text>
                  <Text style={styles.emptySubtitle}>No wardrobes selected yet.</Text>
                </View>
              ) : (
                selectedWardrobesData.map(wardrobe => (
                  <View key={`vcart-${wardrobe.id}`} style={styles.cartVerticalItem}>
                    <View style={styles.cartVerticalItemLeft}>
                      <View style={styles.cartVerticalImageContainer}>
                        {wardrobe.image_url ? (
                          <Image source={{ uri: wardrobe.image_url }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
                        ) : (
                          <LinearGradient
                            colors={['#D4145A', '#86003C']}
                            style={StyleSheet.absoluteFillObject}
                          />
                        )}
                      </View>
                      <View style={styles.cartVerticalInfo}>
                        <Text style={styles.cartVerticalTitle} numberOfLines={1}>{wardrobe.name}</Text>
                      </View>
                    </View>
                    <Pressable onPress={() => toggleSelection(wardrobe.id)} style={styles.cartVerticalRemoveButton}>
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
                      Add to {selectedCount} {selectedCount === 1 ? 'Wardrobe' : 'Wardrobes'}
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
  headerImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginBottom: 4,
  },
  headerTitleSub: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 14,
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
  cartFabWrapper: {
    position: 'absolute',
    left: 24,
  },
  cartFab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: FuchsiaColors.vibrant,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
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
  },
});
