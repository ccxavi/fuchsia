import { View, StyleSheet, TextInput, Pressable, ScrollView, FlatList, ActivityIndicator, Modal, useWindowDimensions, DeviceEventEmitter, Text, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Plus, X, Check, Search, Settings, ChevronDown, ChevronUp, ShoppingBag, Calendar } from 'lucide-react-native';
import { Image } from 'expo-image';
import { CustomDatePicker } from '@/components/ui/CustomDatePicker';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeOutDown, Layout } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { FuchsiaColors, FuchsiaFonts } from '@/constants/theme';
import { CLOTHING_CATEGORIES } from '@/constants/categories';
import { OutfitFormSkeleton, Skeleton } from '@/components/ui/Skeleton';
import {
  createOutfit,
  updateOutfit,
  getOutfit,
  getClothingItems,
  getWardrobes,
  getWardrobeClothingItems,
  addItemToOutfit,
  removeItemFromOutfit,
  createCalendarOutfit,
  ClothingItemResponse,
  WardrobeResponse,
} from '@/api/client';

export default function AddOrEditOutfitScreen() {
  const { id, wardrobeId, itemId, date } = useLocalSearchParams<{ id?: string; wardrobeId?: string; itemId?: string; date?: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [name, setName] = useState('');
  const [selectedItems, setSelectedItems] = useState<ClothingItemResponse[]>([]);
  const [initialItemIds, setInitialItemIds] = useState<Set<string>>(new Set());
  const [wardrobes, setWardrobes] = useState<WardrobeResponse[]>([]);
  const [selectedWardrobeIds, setSelectedWardrobeIds] = useState<string[]>(
    wardrobeId ? [wardrobeId as string] : []
  );

  const [allItems, setAllItems] = useState<ClothingItemResponse[]>([]);
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [showCartModal, setShowCartModal] = useState(false);
  const [pickerSelectedIds, setPickerSelectedIds] = useState<Set<string>>(new Set());
  const [scheduledDate, setScheduledDate] = useState<Date | null>(date ? new Date(date) : null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Item Picker state
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeSubCategory, setActiveSubCategory] = useState('All');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [pickerSearchQuery, setPickerSearchQuery] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(!!id);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) {
      fetchOutfit();
    }
    getWardrobes()
      .then(setWardrobes)
      .catch(err => console.error('Failed to fetch wardrobes:', err));
    if (wardrobeId) {
      getWardrobeClothingItems(wardrobeId as string)
        .then(items => {
          setAllItems(items);
          if (!id && itemId) {
            const preselect = items.find(i => i.id === itemId);
            if (preselect) setSelectedItems(prev => [...prev, preselect]);
          }
        })
        .catch(err => console.error('Failed to fetch wardrobe items:', err));
    } else {
      getClothingItems()
        .then(items => {
          setAllItems(items);
          if (!id && itemId) {
            const preselect = items.find(i => i.id === itemId);
            if (preselect) setSelectedItems(prev => [...prev, preselect]);
          }
        })
        .catch(err => console.error('Failed to fetch items:', err));
    }
  }, [id, wardrobeId, itemId]);

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

  const fetchOutfit = async () => {
    try {
      const data = await getOutfit(id!);
      setName(data.name || '');
      setSelectedItems(data.clothing_items || []);
      setInitialItemIds(new Set(data.clothing_items?.map(i => i.id) || []));
      if (data.wardrobes && data.wardrobes.length > 0) {
        setSelectedWardrobeIds(data.wardrobes.map(w => w.id));
      }
    } catch (err: any) {
      setError('Failed to fetch outfit details.');
    } finally {
      setIsFetching(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Outfit name is required');
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      let finalOutfitId = id;

      if (id) {
        const updatedOutfit = await updateOutfit(id, {
          name: name.trim(),
          wardrobe_ids: selectedWardrobeIds,
        });
        
        // Handle Item additions/removals
        const currentItemIds = new Set(selectedItems.map(i => i.id));
        const addedItems = [...currentItemIds].filter(itemId => !initialItemIds.has(itemId));
        const removedItems = [...initialItemIds].filter(itemId => !currentItemIds.has(itemId));

        const itemPromises: Promise<any>[] = [];
        for (const itemId of addedItems) itemPromises.push(addItemToOutfit(id, itemId));
        for (const itemId of removedItems) itemPromises.push(removeItemFromOutfit(id, itemId));

        if (itemPromises.length > 0) {
          await Promise.all(itemPromises);
        }

        DeviceEventEmitter.emit('outfitUpdated', id);
        DeviceEventEmitter.emit('showGlobalToast', 'Outfit updated successfully');
      } else {
        const newOutfit = await createOutfit({
          name: name.trim(),
          clothing_item_ids: selectedItems.map(i => i.id),
          wardrobe_ids: selectedWardrobeIds.length > 0 ? selectedWardrobeIds : undefined,
        });
        finalOutfitId = newOutfit.id;
        DeviceEventEmitter.emit('showGlobalToast', 'Outfit created successfully');
      }

      if (scheduledDate && finalOutfitId) {
        // Schedule the outfit
        await createCalendarOutfit({
          outfit_id: finalOutfitId,
          date: `${scheduledDate.getFullYear()}-${String(scheduledDate.getMonth() + 1).padStart(2, '0')}-${String(scheduledDate.getDate()).padStart(2, '0')}`,
        });
        DeviceEventEmitter.emit('showGlobalToast', 'Outfit scheduled successfully');
      }

      router.back();
    } catch (err: any) {
      setError(err.message || `Failed to ${id ? 'update' : 'create'} outfit`);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleWardrobeSelection = (wId: string) => {
    setSelectedWardrobeIds(prev =>
      prev.includes(wId) ? prev.filter(x => x !== wId) : [...prev, wId]
    );
  };

  const removeSelectedItem = (itemId: string) => {
    setSelectedItems(prev => prev.filter(i => i.id !== itemId));
  };

  const openItemPicker = () => {
    setPickerSelectedIds(new Set(selectedItems.map(i => i.id)));
    setShowItemPicker(true);
  };

  const confirmItemPicker = () => {
    const picked = allItems.filter(i => pickerSelectedIds.has(i.id));
    setSelectedItems(picked);
    setShowCartModal(false);
    setShowItemPicker(false);
  };

  const togglePickerItem = (itemId: string) => {
    setPickerSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const handleAdvancedFilterSelect = (main: string, sub: string = 'All') => {
    setActiveCategory(main);
    setActiveSubCategory(sub);
    setShowFilterModal(false);
  };

  const filteredItems = allItems.filter(i => {
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

  if (isFetching) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Skeleton width={40} height={40} borderRadius={12} />
          <Skeleton width={120} height={20} />
          <View style={{ width: 40 }} />
        </View>
        <OutfitFormSkeleton />
        <View style={[styles.footer, { paddingBottom: (insets.bottom || 24) + 16 }]}>
          <Skeleton width="100%" height={52} borderRadius={12} />
        </View>
      </View>
    );
  }

  const pickerItemWidth = (width - 48) / 2;
  const selectedCount = pickerSelectedIds.size;
  const selectedItemsData = allItems.filter(i => pickerSelectedIds.has(i.id));

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { paddingTop: insets.top }]} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={20} color={FuchsiaColors.ink} />
        </Pressable>
        <ThemedText style={styles.headerTitle}>
          {id ? 'Edit Outfit' : 'Create Outfit'}
        </ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Selected Items Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Selected Items</ThemedText>
            <ThemedText style={styles.sectionCount}>
              {selectedItems.length} {selectedItems.length === 1 ? 'Item' : 'Items'}
            </ThemedText>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.itemsRow}
          >
            {selectedItems.map(item => (
              <View key={item.id} style={styles.selectedItemCard}>
                <View style={styles.selectedItemImage}>
                  {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
                  ) : (
                    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: FuchsiaColors.cloud }]} />
                  )}
                </View>
                  <Pressable
                    style={styles.removeItemButton}
                    onPress={() => removeSelectedItem(item.id)}
                  >
                    <X size={10} color={FuchsiaColors.slate} />
                  </Pressable>
              </View>
            ))}

            {/* Add Item Button */}
              <Pressable style={styles.addItemButton} onPress={openItemPicker}>
                <Plus size={24} color={FuchsiaColors.slate} />
                <ThemedText style={styles.addItemText}>Add Item</ThemedText>
              </Pressable>
          </ScrollView>
        </View>

        <View style={styles.divider} />

        {/* Outfit Details Form */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Outfit Details</ThemedText>

          <View style={styles.formGroup}>
            <ThemedText style={styles.label}>Outfit Name</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="e.g. Sunday Brunch Look"
              placeholderTextColor={FuchsiaColors.mist}
              value={name}
              onChangeText={setName}
            />
          </View>
          <View style={styles.formGroup}>
            <ThemedText style={styles.label}>
              {date ? 'Scheduled Date' : 'Schedule Outfit (Optional)'}
            </ThemedText>
            <Pressable 
              style={[styles.scheduleButton, !!date && { backgroundColor: FuchsiaColors.cloud }]}
              onPress={() => {
                if (!date) setShowDatePicker(true);
              }}
            >
              <Calendar size={18} color={FuchsiaColors.slate} />
              <ThemedText style={scheduledDate ? styles.scheduledDateText : styles.schedulePlaceholderText}>
                {scheduledDate ? scheduledDate.toLocaleDateString() : 'Select a date...'}
              </ThemedText>
              {scheduledDate && !date && (
                <Pressable onPress={() => setScheduledDate(null)} style={{ marginLeft: 'auto' }}>
                  <X size={16} color={FuchsiaColors.slate} />
                </Pressable>
              )}
            </Pressable>
            <CustomDatePicker
              visible={showDatePicker}
              value={scheduledDate || new Date()}
              onClose={() => setShowDatePicker(false)}
              onChange={(event, date) => {
                setShowDatePicker(false);
                if (date) setScheduledDate(date);
              }}
            />
          </View>
        </View>

        {/* Wardrobe Selector */}
        {wardrobes.length > 0 && (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Add to Wardrobe</ThemedText>
            <ThemedText style={styles.sectionHint}>
              Select wardrobes to include this outfit in
            </ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.wardrobeRow}
            >
              {wardrobes.map(w => {
                const isSelected = selectedWardrobeIds.includes(w.id);
                return (
                  <Pressable
                    key={w.id}
                    style={[styles.wardrobeCard, isSelected && styles.wardrobeCardSelected]}
                    onPress={() => toggleWardrobeSelection(w.id)}
                  >
                    {w.image_url ? (
                      <Image
                        source={{ uri: w.image_url }}
                        style={StyleSheet.absoluteFillObject}
                        contentFit="cover"
                      />
                    ) : (
                      <LinearGradient
                        colors={['#D4145A', '#86003C']}
                        style={StyleSheet.absoluteFillObject}
                      />
                    )}
                    <View style={styles.wardrobeCardOverlay}>
                      <ThemedText style={styles.wardrobeCardText} numberOfLines={2}>
                        {w.name}
                      </ThemedText>
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
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Save Button */}
      <View style={[styles.footer, { paddingBottom: (insets.bottom || 24) + 16 }]}>
        <Pressable
          onPress={handleSave}
          disabled={!name.trim() || isLoading}
          style={({ pressed }) => [
            { borderRadius: 14, overflow: 'hidden', elevation: 8, shadowColor: FuchsiaColors.vibrant, shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
            { transform: [{ scale: pressed ? 0.98 : 1 }] },
            (!name.trim() || isLoading) && styles.saveButtonDisabled,
          ]}
        >
          <LinearGradient
            colors={['#D4145A', '#86003C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.saveButton}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.saveButtonText}>
                {id ? 'Save Changes' : 'Save Outfit'}
              </ThemedText>
            )}
          </LinearGradient>
        </Pressable>
      </View>

      {/* Manual Android Keyboard Spacer */}
      {Platform.OS === 'android' && <View style={{ height: keyboardHeight }} />}

      {/* Item Picker Modal (Full Screen) */}
      <Modal
        visible={showItemPicker}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowItemPicker(false)}
      >
        <View style={styles.pickerContainer}>
          {/* Picker Header */}
          <View style={[styles.pickerHeader, { paddingTop: insets.top + 16 }]}>
            <View style={styles.pickerHeaderTop}>
              <Pressable onPress={() => setShowItemPicker(false)} style={styles.iconButton}>
                <X size={20} color={FuchsiaColors.slate} />
              </Pressable>
              <View style={styles.pickerHeaderCenter}>
                <Text style={styles.pickerHeaderTitle} numberOfLines={1}>
                  Select Items
                </Text>
              </View>
              <Pressable onPress={() => setShowCartModal(true)} style={styles.iconButton}>
                <ShoppingBag size={20} color={FuchsiaColors.ink} />
                {pickerSelectedIds.size > 0 && (
                  <View style={styles.headerCartBadge}>
                    <Text style={styles.headerCartBadgeText}>{pickerSelectedIds.size}</Text>
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
            <FlatList
              data={filteredItems}
              keyExtractor={(item) => item.id}
              numColumns={2}
              style={styles.content}
              contentContainerStyle={[{ padding: 16, gap: 16 }, filteredItems.length === 0 && { flex: 1, justifyContent: 'center' }]}
              columnWrapperStyle={filteredItems.length > 0 ? { gap: 16 } : undefined}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={() => (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>No items found</Text>
                  <Text style={styles.emptySubtitle}>Try adjusting your search or filters.</Text>
                </View>
              )}
              ListFooterComponent={<View style={{ height: (insets.bottom || 24) + 40 }} />}
              renderItem={({ item }) => {
                const isSelected = pickerSelectedIds.has(item.id);
                
                return (
                  <Pressable 
                    style={[styles.itemCard, { width: pickerItemWidth }]}
                    onPress={() => togglePickerItem(item.id)}
                  >
                    <View style={[
                      styles.itemImageContainer, 
                      { height: pickerItemWidth * 1.25 },
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
              }}
            />
            

            
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
        </View>
      </Modal>


      {/* Cart Modal inside Picker */}
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
                    <Pressable onPress={() => togglePickerItem(item.id)} style={styles.cartVerticalRemoveButton}>
                      <Text style={styles.cartVerticalRemoveText}>Remove</Text>
                    </Pressable>
                  </View>
                ))
              )}
            </ScrollView>
            
            <View style={styles.cartFooter}>
              <Pressable onPress={confirmItemPicker}>
                <LinearGradient
                  colors={[FuchsiaColors.vibrant, FuchsiaColors.deep]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.cartSaveButton}
                >
                  <Text style={styles.cartSaveButtonText}>
                    Add to Outfit
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Filter Modal inside Picker */}
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
    </KeyboardAvoidingView>
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
  headerTitle: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 18,
    fontWeight: '600',
    color: FuchsiaColors.ink,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 16,
    color: FuchsiaColors.ink,
    marginBottom: 4,
  },
  sectionCount: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: FuchsiaColors.slate,
  },
  sectionHint: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 12,
    color: FuchsiaColors.slate,
    marginBottom: 12,
    marginTop: -2,
  },
  itemsRow: {
    gap: 16,
    paddingRight: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  selectedItemCard: {
    width: 96,
    position: 'relative',
  },
  selectedItemImage: {
    width: 96,
    aspectRatio: 4 / 5,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: FuchsiaColors.mist,
    backgroundColor: '#fff',
  },
  removeItemButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: FuchsiaColors.mist,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  addItemButton: {
    width: 96,
    aspectRatio: 4 / 5,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: FuchsiaColors.mist,
    backgroundColor: 'rgba(253, 242, 248, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addItemText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: FuchsiaColors.slate,
  },
  divider: {
    height: 1,
    backgroundColor: FuchsiaColors.mist,
    marginBottom: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 12,
    fontWeight: '500',
    color: FuchsiaColors.slate,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: FuchsiaFonts.body,
    color: FuchsiaColors.ink,
  },
  scheduleButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  schedulePlaceholderText: {
    fontSize: 16,
    fontFamily: FuchsiaFonts.body,
    color: FuchsiaColors.mist,
  },
  scheduledDateText: {
    fontSize: 16,
    fontFamily: FuchsiaFonts.body,
    color: FuchsiaColors.ink,
  },
  wardrobeRow: {
    gap: 12,
    paddingRight: 20,
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
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: FuchsiaColors.deep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 13,
    color: FuchsiaColors.vibrant,
    textAlign: 'center',
    marginTop: 8,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: FuchsiaColors.mist,
    backgroundColor: FuchsiaColors.cloud,
  },
  saveButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
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

  /* -------------------------
     Picker / Filter Styles
     ------------------------- */
  pickerContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  pickerHeader: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: FuchsiaColors.cloud,
  },
  pickerHeaderTop: {
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
  pickerHeaderCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  pickerHeaderTitle: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 16,
    fontWeight: '600',
    color: FuchsiaColors.ink,
  },
  headerCartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: FuchsiaColors.vibrant,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  headerCartBadgeText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },
  searchRow: {},
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
  flex1: {
    flex: 1,
  },
  content: {
    flex: 1,
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

  /* -------------------------
     Modal Shared Styles
     ------------------------- */
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
  
  /* -------------------------
     Cart Styles
     ------------------------- */
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

  /* -------------------------
     Filter Modal Styles
     ------------------------- */
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
