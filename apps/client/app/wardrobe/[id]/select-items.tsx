import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, useWindowDimensions, DeviceEventEmitter, TextInput, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { Image } from 'expo-image';
import { X, Check, Search, Settings, ChevronDown, ChevronUp, ShoppingBag, ArrowLeft } from 'lucide-react-native';
import Animated, { FadeIn, FadeOut, Layout, FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { FuchsiaColors, FuchsiaFonts } from '@/constants/theme';
import { CLOTHING_CATEGORIES } from '@/constants/categories';
import { getClothingItems, getWardrobe, addItemToWardrobe, removeItemFromWardrobe, ClothingItemResponse, WardrobeWithDetailsResponse } from '@/api/client';
import { GridSkeleton } from '@/components/ui/Skeleton';

export default function SelectItemsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const itemWidth = (width - 48) / 2;

  const [wardrobe, setWardrobe] = useState<WardrobeWithDetailsResponse | null>(null);
  const [items, setItems] = useState<ClothingItemResponse[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [initialIds, setInitialIds] = useState<Set<string>>(new Set());
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [activeCategory, setActiveCategory] = useState('All');
  const [activeSubCategory, setActiveSubCategory] = useState('All');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showCartModal, setShowCartModal] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      try {
        const [wardrobeData, allItems] = await Promise.all([
          getWardrobe(id as string),
          getClothingItems()
        ]);
        
        setWardrobe(wardrobeData);
        setItems(allItems);
        
        const existingIds = new Set(wardrobeData.clothing_items.map(i => i.id));
        setSelectedIds(existingIds);
        setInitialIds(new Set(existingIds));
      } catch (err) {
        console.error('Failed to load items', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [id]);

  const toggleSelection = (itemId: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    if (!id || isSaving) return;
    setIsSaving(true);
    
    try {
      const added = [...selectedIds].filter(itemId => !initialIds.has(itemId));
      const removed = [...initialIds].filter(itemId => !selectedIds.has(itemId));
      
      const promises: Promise<any>[] = [];
      
      for (const itemId of added) {
        promises.push(addItemToWardrobe(itemId, id as string));
      }
      
      for (const itemId of removed) {
        promises.push(removeItemFromWardrobe(itemId, id as string));
      }
      
      await Promise.all(promises);
      
      DeviceEventEmitter.emit('wardrobeUpdated', id);
      DeviceEventEmitter.emit('showGlobalToast', 'Items updated successfully');
      router.back();
    } catch (err) {
      console.error('Failed to save selections', err);
      alert('Failed to save your selections. Please try again.');
      setIsSaving(false);
    }
  };

  const handleAdvancedFilterSelect = (main: string, sub: string = 'All') => {
    setActiveCategory(main);
    setActiveSubCategory(sub);
    setShowFilterModal(false);
  };

  const filteredItems = items.filter(i => {
    const matchesSearch = !searchQuery || i.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = activeCategory === 'All' || (() => {
      if (!i.category) return false;
      const targetCategory = i.category.toLowerCase();
      
      if (activeSubCategory !== 'All') {
        return targetCategory === activeSubCategory.toLowerCase();
      }
      
      if (targetCategory === activeCategory.toLowerCase()) return true;
      
      const categoryData = CLOTHING_CATEGORIES.find(c => c.main.toLowerCase() === activeCategory.toLowerCase());
      if (categoryData) {
        return categoryData.subs.some(sub => sub.toLowerCase() === targetCategory);
      }
      
      return false;
    })();

    return matchesSearch && matchesCategory;
  });

  if (isLoading || !wardrobe) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top + 60 }]}>
        <GridSkeleton />
      </View>
    );
  }

  const selectedCount = selectedIds.size;
  const selectedItemsData = items.filter(i => selectedIds.has(i.id));

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => router.back()} style={styles.iconButton} disabled={isSaving}>
            <ArrowLeft size={20} color={FuchsiaColors.slate} />
          </Pressable>
          <View style={styles.headerCenter}>
            {wardrobe?.image_url ? (
              <Image source={{ uri: wardrobe.image_url }} style={styles.headerImage} contentFit="cover" />
            ) : (
              <View style={[styles.headerImage, { backgroundColor: FuchsiaColors.mist, alignItems: 'center', justifyContent: 'center' }]}>
                <ShoppingBag size={14} color="#fff" />
              </View>
            )}
            <Text style={styles.headerTitleSub} numberOfLines={1}>
              {wardrobe?.name || 'Loading...'}
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
              placeholder="Search clothes..."
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
        <Text style={styles.statsLabel}>
          {activeCategory === 'All' 
            ? 'All categories' 
            : activeSubCategory === 'All' 
              ? activeCategory 
              : activeSubCategory}
        </Text>
        <Text style={styles.statsCount}>{filteredItems.length} items found</Text>
      </View>

      {/* Grid */}
      <View style={styles.flex1}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {filteredItems.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No items found</Text>
              <Text style={styles.emptySubtitle}>Try adjusting your search or filters.</Text>
            </View>
          ) : (
            <View style={styles.gridContainer}>
              {filteredItems.map(item => {
                const isSelected = selectedIds.has(item.id);
                
                return (
                  <Pressable 
                    key={item.id} 
                    style={[styles.itemCard, { width: itemWidth }]}
                    onPress={() => toggleSelection(item.id)}
                  >
                    <View style={[
                      styles.itemImageContainer, 
                      { height: itemWidth * 1.25 },
                      isSelected && styles.itemImageContainerSelected
                    ]}>
                      {item.image_url ? (
                        <Image source={{ uri: item.image_url }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
                      ) : (
                        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: FuchsiaColors.mist }]} />
                      )}
                      
                      {isSelected && (
                        <View style={styles.selectedOverlay}>
                          <View style={styles.checkmarkBadge}>
                            <Check size={16} color="white" />
                          </View>
                        </View>
                      )}
                    </View>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemTitle} numberOfLines={1}>{item.name}</Text>
                      {item.category && <Text style={styles.itemCategory}>{item.category}</Text>}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
          <View style={{ height: (insets.bottom || 24) + 40 }} />
        </ScrollView>
        
        
        
        <Animated.View 
          layout={Layout.duration(250)}
          style={[styles.filterFabWrapper, { bottom: (insets.bottom || 24) + 16 }]}
        >
          <Pressable 
            style={styles.filterFab}
            onPress={() => {
              setExpandedCategory(activeCategory === 'All' ? null : activeCategory);
              setShowFilterModal(true);
            }}
          >
            <Settings size={20} color={FuchsiaColors.deep} />
          </Pressable>
        </Animated.View>
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
              <Text style={styles.modalTitle}>Selected Items ({selectedCount})</Text>
              <Pressable onPress={() => setShowCartModal(false)} style={styles.modalCloseButton}>
                <X size={20} color={FuchsiaColors.slate} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.cartVerticalScrollContent}>
              {selectedItemsData.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>Empty Cart</Text>
                  <Text style={styles.emptySubtitle}>No items selected yet.</Text>
                </View>
              ) : (
                selectedItemsData.map(item => (
                  <View key={`vcart-${item.id}`} style={styles.cartVerticalItem}>
                    <View style={styles.cartVerticalItemLeft}>
                      <View style={styles.cartVerticalImageContainer}>
                        {item.image_url ? (
                          <Image source={{ uri: item.image_url }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
                        ) : (
                          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: FuchsiaColors.mist }]} />
                        )}
                      </View>
                      <View style={styles.cartVerticalInfo}>
                        <Text style={styles.cartVerticalTitle} numberOfLines={1}>{item.name}</Text>
                        {item.category && <Text style={styles.cartVerticalCategory}>{item.category}</Text>}
                      </View>
                    </View>
                    <Pressable onPress={() => toggleSelection(item.id)} style={styles.cartVerticalRemoveButton}>
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
                      Pack {selectedCount} {selectedCount === 1 ? 'Item' : 'Items'}
                    </Text>
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: (insets.bottom || 24) + 16 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Categories</Text>
              <Pressable onPress={() => setShowFilterModal(false)} style={styles.modalCloseButton}>
                <X size={20} color={FuchsiaColors.slate} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}>
              <Pressable 
                style={styles.modalCategoryItem}
                onPress={() => handleAdvancedFilterSelect('All')}
              >
                <Text style={[styles.modalCategoryMainText, activeCategory === 'All' && styles.modalCategorySelectedText]}>
                  All Categories
                </Text>
                {activeCategory === 'All' && <Check size={18} color={FuchsiaColors.deep} />}
              </Pressable>
              
              {CLOTHING_CATEGORIES.map((section) => {
                const isExpanded = expandedCategory === section.main;
                const hasSubs = section.subs.length > 0;
                const isSectionActive = activeCategory === section.main;

                return (
                  <View key={section.main} style={styles.modalCategorySection}>
                    <Pressable 
                      style={styles.modalCategoryItem}
                      onPress={() => {
                        if (hasSubs) {
                          setExpandedCategory(isExpanded ? null : section.main);
                        } else {
                          handleAdvancedFilterSelect(section.main);
                        }
                      }}
                    >
                      <Text style={[styles.modalCategoryMainText, isSectionActive && styles.modalCategorySelectedText]}>
                        {section.main}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {isSectionActive && activeSubCategory === 'All' && !hasSubs && <Check size={18} color={FuchsiaColors.deep} />}
                        {hasSubs && (isExpanded ? <ChevronUp size={20} color={FuchsiaColors.slate} /> : <ChevronDown size={20} color={FuchsiaColors.slate} />)}
                      </View>
                    </Pressable>
                    
                    {hasSubs && isExpanded && (
                      <View style={styles.modalSubCategoryContainer}>
                        <Pressable 
                          style={styles.modalCategoryItem}
                          onPress={() => handleAdvancedFilterSelect(section.main, 'All')}
                        >
                          <Text style={[styles.modalCategorySubText, isSectionActive && activeSubCategory === 'All' && styles.modalCategorySelectedText]}>
                            All {section.main}
                          </Text>
                          {isSectionActive && activeSubCategory === 'All' && <Check size={18} color={FuchsiaColors.deep} />}
                        </Pressable>

                        {section.subs.map((sub) => {
                          const isSubActive = isSectionActive && activeSubCategory === sub;
                          return (
                            <Pressable 
                              key={sub} 
                              style={styles.modalCategoryItem}
                              onPress={() => handleAdvancedFilterSelect(section.main, sub)}
                            >
                              <Text style={[styles.modalCategorySubText, isSubActive && styles.modalCategorySelectedText]}>
                                {sub}
                              </Text>
                              {isSubActive && <Check size={18} color={FuchsiaColors.deep} />}
                            </Pressable>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
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
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  saveButtonText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 16,
    fontWeight: '600',
    color: FuchsiaColors.vibrant,
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
  filterFabWrapper: {
    position: 'absolute',
    right: 24,
  },
  filterFab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: FuchsiaColors.cloud,
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
  },
  modalScrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  modalCategorySection: {
    marginBottom: 8,
  },
  modalCategoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  modalSubCategoryContainer: {
    marginLeft: 16,
    borderLeftWidth: 1,
    borderLeftColor: FuchsiaColors.mist,
    paddingLeft: 16,
    marginTop: 4,
  },
  modalCategoryMainText: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 16,
    fontWeight: '600',
    color: FuchsiaColors.ink,
  },
  modalCategorySubText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 15,
    color: FuchsiaColors.slate,
  },
  modalCategorySelectedText: {
    color: FuchsiaColors.deep,
    fontWeight: '700',
  },
});
