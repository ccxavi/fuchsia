import { View, Text, StyleSheet, Pressable, ScrollView, FlatList, ImageBackground, ActivityIndicator, TextInput, RefreshControl, useWindowDimensions, Modal } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useCallback } from 'react';
import { useFocusEffect, router } from 'expo-router';
import { Search, Plus, Settings, X, ChevronDown, ChevronUp, Check } from 'lucide-react-native';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { FuchsiaColors, FuchsiaFonts } from '@/constants/theme';
import { CLOTHING_CATEGORIES } from '@/constants/categories';
import { getClothingItems, getWardrobes, ClothingItemResponse, WardrobeResponse } from '@/api/client';

// Dummy Data mapped to prototype assets
const OUTFITS = [
  { id: '1', title: 'Office Ready', items: '3 Items', image: require('@/assets/images/prototype/fit_mirror_selfie_1782795284202.png') },
  { id: '2', title: 'Sunday Brunch', items: '1 Item', image: require('@/assets/images/prototype/fit_floral_dress_1782795310776.png') },
  { id: '3', title: 'City Casual', items: '2 Items', image: require('@/assets/images/prototype/fit_street_style_1782795298638.png') },
  { id: '4', title: 'Lazy Sunday', items: '2 Items', image: require('@/assets/images/prototype/fit_casual_hoodie_1782802276628.png') },
];

const WARDROBES = [
  { id: '1', title: 'Trip to Japan', subtitle: '14 Outfits · 22 Items', image: require('@/assets/images/prototype/fit_white_shirt_1782802240221.png') },
  { id: '2', title: 'Spring Classics', subtitle: '8 Outfits · 12 Items', image: require('@/assets/images/prototype/fit_trench_coat_1782802251066.png') },
];

export default function ClosetScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const itemWidth = (width - 40 - 16) / 2; // 40 for horizontal padding, 16 for column gap

  const [activeTab, setActiveTab] = useState<'outfits' | 'wardrobe' | 'items'>('outfits');
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeSubCategory, setActiveSubCategory] = useState('All');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [clothingItems, setClothingItems] = useState<ClothingItemResponse[]>([]);
  const [wardrobes, setWardrobes] = useState<WardrobeResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    try {
      const fetchedWardrobes = await getWardrobes().catch(err => {
        console.error('Failed to fetch wardrobes:', err);
        return [];
      });
      setWardrobes(fetchedWardrobes);

      const fetchedItems = await getClothingItems().catch(err => {
        console.error('Failed to fetch items:', err);
        return [];
      });
      setClothingItems(fetchedItems);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchData();
  };

  const filteredOutfits = OUTFITS.filter(o => o.title.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredWardrobes = wardrobes.filter(w => w.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredItems = clothingItems.filter(i => {
    const matchesSearch = i.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (i.category && i.category.toLowerCase().includes(searchQuery.toLowerCase()));
                          
    const matchesCategory = activeCategory === 'All' || (() => {
      if (!i.category) return false;
      const targetCategory = i.category.toLowerCase();
      
      // If a specific subcategory is selected, must match exactly
      if (activeSubCategory !== 'All') {
        return targetCategory === activeSubCategory.toLowerCase();
      }
      
      // Match exact main category (e.g. "Tops" == "Tops")
      if (targetCategory === activeCategory.toLowerCase()) return true;
      
      // Match any subcategory inside the selected main category
      const categoryData = CLOTHING_CATEGORIES.find(c => c.main.toLowerCase() === activeCategory.toLowerCase());
      if (categoryData) {
        return categoryData.subs.some(sub => sub.toLowerCase() === targetCategory);
      }
      
      return false;
    })();

    return matchesSearch && matchesCategory;
  });

  const handleAdvancedFilterSelect = (main: string, sub: string = 'All') => {
    setActiveCategory(main);
    setActiveSubCategory(sub);
    setShowFilterModal(false);
  };

  const renderEmptyState = (message: string) => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyMessage}>{message}</Text>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>My Closet</Text>
      
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: isSearching ? 1 : 0, marginLeft: isSearching ? 16 : 0 }}>
        <Animated.View 
          layout={Layout.duration(250)}
          style={[
            styles.searchContainer,
            isSearching ? { flex: 1, marginRight: 0 } : { width: 40, marginRight: 0 }
          ]}
        >
          {isSearching && (
            <Animated.View entering={FadeIn.delay(100).duration(200)} exiting={FadeOut.duration(100)} style={styles.searchInputWrapper}>
              <TextInput
                style={styles.searchInputInner}
                placeholder="Search..."
                placeholderTextColor={FuchsiaColors.mist}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
                returnKeyType="search"
              />
            </Animated.View>
          )}
          <Pressable 
            style={styles.searchIconButton}
            onPress={() => {
              if (isSearching) {
                setSearchQuery('');
                setIsSearching(false);
              } else {
                setIsSearching(true);
              }
            }}
          >
            {isSearching ? (
              <X size={20} color={FuchsiaColors.slate} />
            ) : (
              <Search size={20} color={FuchsiaColors.slate} />
            )}
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );

  const renderTabs = () => (
    <View style={styles.tabsContainer}>
      <View style={styles.tabsWrapper}>
        {(['outfits', 'wardrobe', 'items'] as const).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <Pressable
              key={tab}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const renderOutfits = () => (
    <View style={styles.flex1}>
      <View style={styles.statsBanner}>
        <Text style={styles.statsCount}>{filteredOutfits.length} outfits</Text>
        <Text style={styles.statsLabel}>All outfits</Text>
      </View>
      <FlatList
        data={filteredOutfits}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={[styles.listContent, filteredOutfits.length === 0 && { flex: 1 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={FuchsiaColors.vibrant} />}
        ListEmptyComponent={() => renderEmptyState("Your stylish outfits will appear here!\nTap the + below to create one.")}
        renderItem={({ item }) => (
          <Pressable style={[styles.gridItem, { width: itemWidth, flex: 0 }]}>
            <View style={styles.imageContainer}>
              <Image source={item.image} style={styles.image} contentFit="cover" />
            </View>
            <View style={styles.itemInfo}>
              <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.itemSubtitle}>{item.items}</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );

  const renderWardrobe = () => (
    <FlatList
      data={filteredWardrobes}
      keyExtractor={(item) => item.id}
      contentContainerStyle={[styles.listContent, filteredWardrobes.length === 0 && { flex: 1 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={FuchsiaColors.vibrant} />}
      ListEmptyComponent={() => renderEmptyState("Curate your perfect collections here!\nTap the + below to start a new wardrobe.")}
      renderItem={({ item }) => {
        const imageUrl = (item as any).image_url;
        return (
          <Pressable 
            style={styles.wardrobeCard}
            onPress={() => router.push(`/wardrobe/${item.id}`)}
          >
            {imageUrl ? (
              <View style={styles.wardrobeImage}>
                <Image 
                  source={{ uri: imageUrl }} 
                  style={[StyleSheet.absoluteFillObject, styles.wardrobeImageStyle]} 
                  contentFit="cover" 
                />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.8)']}
                  style={[StyleSheet.absoluteFillObject, styles.wardrobeGradient]}
                >
                  <Text style={styles.wardrobeTitle}>{item.name}</Text>
                  <Text style={styles.wardrobeSubtitle}>{item.outfits_count} Outfits · {item.clothing_items_count} Items</Text>
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
                  <Text style={styles.wardrobeTitle}>{item.name}</Text>
                  <Text style={styles.wardrobeSubtitle}>{item.outfits_count} Outfits · {item.clothing_items_count} Items</Text>
                </LinearGradient>
              </LinearGradient>
            )}
          </Pressable>
        );
      }}
    />
  );

  const renderItems = () => (
    <View style={styles.flex1}>
      <View style={styles.statsBanner}>
        <Text style={styles.statsCount}>{filteredItems.length} items</Text>
        <Text style={styles.statsLabel}>
          {activeCategory === 'All' 
            ? 'All categories' 
            : activeSubCategory === 'All' 
              ? activeCategory 
              : activeSubCategory}
        </Text>
      </View>
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={filteredItems.length > 0 ? styles.gridRow : undefined}
        contentContainerStyle={[styles.listContent, filteredItems.length === 0 && { flex: 1 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={FuchsiaColors.vibrant} />}
        ListEmptyComponent={() => renderEmptyState("Your virtual closet awaits!\nTap the + below to add your first clothing item.")}
        renderItem={({ item }) => (
          <Pressable 
            style={[styles.gridItem, { width: itemWidth, flex: 0 }]}
            onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })}
          >
            <View style={styles.imageContainer}>
              <Image 
                source={{ uri: item.image_url || `https://placehold.co/300x375/FDF2F8/86003C/png?text=${encodeURIComponent(item.name)}` }} 
                style={styles.image} 
                contentFit="cover"
                transition={200}
              />
              {item.category && (
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>{item.category}</Text>
                </View>
              )}
            </View>
            <View style={styles.itemInfo}>
              <Text style={styles.itemTitle} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.itemSubtitle}>Worn 0 times</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {renderHeader()}
      {renderTabs()}
      <View style={styles.flex1}>
        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={FuchsiaColors.vibrant} />
          </View>
        ) : (
          <>
            {activeTab === 'outfits' && renderOutfits()}
            {activeTab === 'wardrobe' && renderWardrobe()}
            {activeTab === 'items' && renderItems()}
          </>
        )}
      </View>

      {activeTab === 'items' && (
        <Pressable 
          style={[styles.filterFab, { bottom: (insets.bottom || 24) + 16 + 56 + 16 }]}
          onPress={() => {
            setExpandedCategory(activeCategory === 'All' ? null : activeCategory);
            setShowFilterModal(true);
          }}
        >
          <Settings size={20} color={FuchsiaColors.deep} />
        </Pressable>
      )}

      <Modal
        visible={showFilterModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom || 24 }]}>
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
    backgroundColor: FuchsiaColors.cloud,
  },
  flex1: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginTop: 40,
  },
  emptyMessage: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 14,
    color: FuchsiaColors.slate,
    textAlign: 'center',
    lineHeight: 20,
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
    fontSize: 24,
    color: FuchsiaColors.ink,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FuchsiaColors.mist,
    overflow: 'hidden',
  },
  searchInputWrapper: {
    flex: 1,
    paddingLeft: 12,
  },
  searchInputInner: {
    flex: 1,
    fontFamily: FuchsiaFonts.body,
    fontSize: 14,
    color: FuchsiaColors.ink,
    padding: 0,
  },
  searchIconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: FuchsiaColors.mist,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  tabsWrapper: {
    flexDirection: 'row',
    backgroundColor: FuchsiaColors.cloud,
    borderWidth: 1,
    borderColor: FuchsiaColors.mist,
    borderRadius: 12,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: '#fff',
    shadowColor: FuchsiaColors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontFamily: FuchsiaFonts.body,
    fontWeight: '500',
    fontSize: 12,
    color: FuchsiaColors.slate,
  },
  tabTextActive: {
    fontWeight: '600',
    color: FuchsiaColors.deep,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 130, // Clearance for center button and tab bar
    gap: 16,
  },
  gridRow: {
    gap: 16,
  },
  gridItem: {
    flex: 1,
    gap: 8,
  },
  imageContainer: {
    aspectRatio: 4 / 5,
    borderRadius: 20,
    backgroundColor: FuchsiaColors.mist,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  itemInfo: {
    paddingHorizontal: 4,
  },
  itemTitle: {
    fontFamily: FuchsiaFonts.body,
    fontWeight: '600',
    fontSize: 14,
    color: FuchsiaColors.ink,
  },
  itemSubtitle: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 12,
    color: FuchsiaColors.slate,
    marginTop: 2,
  },
  fab: {
    position: 'absolute',
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: FuchsiaColors.deep,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: FuchsiaColors.deep,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  filterFab: {
    position: 'absolute',
    right: 28, // Centered above the 56px FAB (24 + (56-48)/2)
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: FuchsiaColors.mist,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  wardrobeCard: {
    height: 140,
    width: '100%',
    borderRadius: 24,
    backgroundColor: FuchsiaColors.ink,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
    padding: 20,
    paddingTop: 40,
    justifyContent: 'flex-end',
  },
  wardrobeTitle: {
    fontFamily: FuchsiaFonts.heading,
    fontWeight: '700',
    fontSize: 20,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  wardrobeSubtitle: {
    fontFamily: FuchsiaFonts.body,
    fontWeight: '500',
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  categoriesWrapper: {
    paddingBottom: 12,
  },
  categoriesContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: FuchsiaColors.mist,
  },
  categoryPillActive: {
    backgroundColor: FuchsiaColors.deep,
    borderColor: FuchsiaColors.deep,
  },
  categoryText: {
    fontFamily: FuchsiaFonts.body,
    fontWeight: '600',
    fontSize: 12,
    color: FuchsiaColors.slate,
  },
  categoryTextActive: {
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
  statsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: FuchsiaColors.blush,
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  statsCount: {
    fontFamily: FuchsiaFonts.body,
    fontWeight: '500',
    fontSize: 12,
    color: FuchsiaColors.deep,
  },
  statsLabel: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 12,
    color: FuchsiaColors.slate,
  },
  categoryBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  categoryBadgeText: {
    fontFamily: FuchsiaFonts.body,
    fontWeight: '600',
    fontSize: 10,
    color: FuchsiaColors.slate,
  }
});
