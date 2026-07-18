import { View, Text, StyleSheet, Pressable, ScrollView, FlatList, ActivityIndicator, useWindowDimensions, DeviceEventEmitter, TextInput, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { Image } from 'expo-image';
import { X, Check, Search, ArrowLeft, Folder } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { FuchsiaColors, FuchsiaFonts } from '@/constants/theme';
import { getWardrobes, addItemToWardrobe, removeItemFromWardrobe, getClothingItem, WardrobeResponse, ClothingItemWithDetailsResponse } from '@/api/client';
import { WardrobeGridSkeleton, Skeleton } from '@/components/ui/Skeleton';

export default function SelectWardrobesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [item, setItem] = useState<ClothingItemWithDetailsResponse | null>(null);
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
        const [itemData, allWardrobes] = await Promise.all([
          getClothingItem(id as string),
          getWardrobes()
        ]);
        
        setItem(itemData);
        setWardrobes(allWardrobes);
        
        const existingIds = new Set(itemData.wardrobes?.map(w => w.id) || []);
        setSelectedIds(existingIds);
        setInitialIds(new Set(existingIds));
      } catch (err) {
        console.error('Failed to load data', err);
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
        promises.push(addItemToWardrobe(id as string, wId));
      }
      
      for (const wId of removed) {
        promises.push(removeItemFromWardrobe(id as string, wId));
      }
      
      await Promise.all(promises);
      
      DeviceEventEmitter.emit('itemUpdated', id);
      DeviceEventEmitter.emit('showGlobalToast', 'Wardrobes updated successfully');
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
            {isLoading || !item ? (
              <>
                <Skeleton width={36} height={36} borderRadius={18} style={{ marginBottom: 4 }} />
                <Skeleton width={80} height={14} />
              </>
            ) : (
              <>
                {item.image_url ? (
                  <Image source={{ uri: item.image_url }} style={styles.headerImage} contentFit="cover" />
                ) : (
                  <View style={[styles.headerImage, { backgroundColor: FuchsiaColors.mist, alignItems: 'center', justifyContent: 'center' }]} />
                )}
                <Text style={styles.headerTitleSub} numberOfLines={1}>
                  {item.name}
                </Text>
              </>
            )}
          </View>
          <Pressable 
            style={styles.iconButton}
            onPress={() => setShowCartModal(true)}
            disabled={selectedCount === 0 || isSaving}
          >
            <Folder size={20} color={selectedCount > 0 ? FuchsiaColors.ink : FuchsiaColors.slate} />
            {selectedCount > 0 && (
              <View style={[styles.cartBadge, { top: -8, right: -8, backgroundColor: FuchsiaColors.deep }]}>
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
        <Text style={styles.statsLabel}>All wardrobes</Text>
        <Text style={styles.statsCount}>{filteredWardrobes.length} total</Text>
      </View>

      {isLoading || !item ? (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <WardrobeGridSkeleton />
        </ScrollView>
      ) : (
        <FlatList
          data={filteredWardrobes}
          keyExtractor={(wardrobe) => wardrobe.id}
          numColumns={2}
          contentContainerStyle={[styles.scrollContent, filteredWardrobes.length === 0 && { flex: 1, justifyContent: 'center' }]}
          columnWrapperStyle={filteredWardrobes.length > 0 ? { justifyContent: 'space-between' } : undefined}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={() => (
            <Text style={styles.emptyMessage}>No wardrobes found.</Text>
          )}
          renderItem={({ item: wardrobe }) => {
            const isSelected = selectedIds.has(wardrobe.id);
            return (
              <Pressable 
                key={wardrobe.id} 
                style={[styles.itemCard, { width: '47%' }]}
                onPress={() => toggleSelection(wardrobe.id)}
              >
                <View style={[styles.itemImageContainer, { aspectRatio: 1.5 }, isSelected && styles.itemImageContainerSelected]}>
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
                  <View style={styles.wardrobeCardOverlay}>
                    <Text style={styles.wardrobeCardText} numberOfLines={2}>{wardrobe.name}</Text>
                  </View>
                  {isSelected && (
                    <View style={styles.selectedOverlay}>
                      <View style={styles.checkmarkBadge}>
                        <Check size={16} color="#fff" />
                      </View>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          }}
        />
      )}

      {/* Cart / Selected Items Modal */}
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
              {selectedWardrobesData.length === 0 ?
                <Text style={styles.emptyMessage}>No wardrobes selected.</Text>
              : (
                selectedWardrobesData.map(w => (
                  <View key={w.id} style={styles.cartVerticalItem}>
                    <View style={styles.cartVerticalItemLeft}>
                      <View style={styles.cartVerticalImageContainer}>
                        {w.image_url ? (
                          <Image source={{ uri: w.image_url }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
                        ) : (
                          <LinearGradient
                            colors={['#D4145A', '#86003C']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={StyleSheet.absoluteFillObject}
                          />
                        )}
                      </View>
                      <View style={styles.cartVerticalInfo}>
                        <Text style={styles.cartVerticalTitle} numberOfLines={1}>{w.name}</Text>
                        <Text style={styles.cartVerticalCategory}>{w.clothing_items_count} Items</Text>
                      </View>
                    </View>
                    <Pressable onPress={() => toggleSelection(w.id)} style={styles.cartVerticalRemoveButton}>
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
                      Pack Item
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
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: FuchsiaColors.cloud,
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
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
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: FuchsiaColors.mist,
  },
  cartBadge: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  searchRow: {
    paddingHorizontal: 20,
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
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
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
    borderColor: FuchsiaColors.deep,
  },
  wardrobeCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 26, 46, 0.4)',
    justifyContent: 'flex-end',
    padding: 12,
  },
  wardrobeCardText: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 8,
    alignItems: 'flex-end',
  },
  checkmarkBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: FuchsiaColors.deep,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyMessage: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 14,
    color: FuchsiaColors.slate,
    textAlign: 'center',
    marginTop: 40,
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
    flex: 1,
  },
  cartVerticalImageContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: FuchsiaColors.cloud,
    overflow: 'hidden',
    marginRight: 12,
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
});
