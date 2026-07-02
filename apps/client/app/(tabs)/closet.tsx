import { View, Text, StyleSheet, Pressable, ScrollView, FlatList, Image, ImageBackground, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { Search } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { FuchsiaColors, FuchsiaFonts } from '@/constants/theme';
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

const ITEMS = [
  { id: '1', title: 'White T-Shirt', category: 'Tops', worn: 'Worn 12 times', image: require('@/assets/images/prototype/white_tee_1782782106068.png') },
  { id: '2', title: 'Denim Jacket', category: 'Outerwear', worn: 'Worn 5 times', image: require('@/assets/images/prototype/denim_jacket_1782782130632.png') },
  { id: '3', title: 'Black Jeans', category: 'Bottoms', worn: 'Worn 24 times', image: require('@/assets/images/prototype/black_jeans_1782782138489.png') },
  { id: '4', title: 'White Sneakers', category: 'Shoes', worn: 'Worn 18 times', image: require('@/assets/images/prototype/white_sneakers_1782782146769.png') },
  { id: '5', title: 'Navy Blazer', category: 'Outerwear', worn: 'Worn 3 times', image: require('@/assets/images/prototype/navy_blazer_1782782098158.png') },
  { id: '6', title: 'Floral Dress', category: 'Dresses', worn: 'Worn 1 time', image: require('@/assets/images/prototype/floral_dress_1782782156523.png') },
];

const CATEGORIES = ['All', 'Tops', 'Bottoms', 'Shoes', 'Outerwear', 'Accessories'];

export default function ClosetScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'outfits' | 'wardrobe' | 'items'>('outfits');
  const [clothingItems, setClothingItems] = useState<ClothingItemResponse[]>([]);
  const [wardrobes, setWardrobes] = useState<WardrobeResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [fetchedItems, fetchedWardrobes] = await Promise.all([
          getClothingItems(),
          getWardrobes(),
        ]);
        setClothingItems(fetchedItems);
        setWardrobes(fetchedWardrobes);
      } catch (err) {
        console.error('Failed to load closet data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>My Closet</Text>
      <Pressable style={styles.searchButton}>
        <Search size={20} color={FuchsiaColors.slate} />
      </Pressable>
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
    <FlatList
      data={OUTFITS}
      keyExtractor={(item) => item.id}
      numColumns={2}
      columnWrapperStyle={styles.gridRow}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => (
        <Pressable style={styles.gridItem}>
          <View style={styles.imageContainer}>
            <Image source={item.image} style={styles.image} />
          </View>
          <View style={styles.itemInfo}>
            <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.itemSubtitle}>{item.items}</Text>
          </View>
        </Pressable>
      )}
    />
  );

  const renderWardrobe = () => (
    <FlatList
      data={wardrobes}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => (
        <Pressable style={styles.wardrobeCard}>
          <ImageBackground 
            source={{ uri: `https://placehold.co/400x140/86003C/D4145A/png?text=${encodeURIComponent(item.name)}` }} 
            style={styles.wardrobeImage} 
            imageStyle={styles.wardrobeImageStyle}
          >
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.8)']}
              style={styles.wardrobeGradient}
            >
              <Text style={styles.wardrobeTitle}>{item.name}</Text>
              <Text style={styles.wardrobeSubtitle}>{item.quantity} Items</Text>
            </LinearGradient>
          </ImageBackground>
        </Pressable>
      )}
    />
  );

  const renderItems = () => (
    <View style={styles.flex1}>
      <View style={styles.categoriesWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesContent}>
          {CATEGORIES.map((cat, index) => {
            const isActive = index === 0; // Mock 'All' as active for UI
            return (
              <Pressable
                key={cat}
                style={[styles.categoryPill, isActive && styles.categoryPillActive]}
              >
                <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>{cat}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <View style={styles.statsBanner}>
        <Text style={styles.statsCount}>{clothingItems.length} items</Text>
        <Text style={styles.statsLabel}>All categories</Text>
      </View>
      <FlatList
        data={clothingItems}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable style={styles.gridItem}>
            <View style={styles.imageContainer}>
              <Image 
                source={{ uri: item.image_url || `https://placehold.co/300x375/FDF2F8/86003C/png?text=${encodeURIComponent(item.name)}` }} 
                style={styles.image} 
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
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FuchsiaColors.mist,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
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
