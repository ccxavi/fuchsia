import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert, useWindowDimensions, Platform, DeviceEventEmitter } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { Image } from 'expo-image';
import { ArrowLeft, Trash2, Palette, Sun, RefreshCcw, Upload, Plus, MoreVertical, Edit2 } from 'lucide-react-native';

import { FuchsiaColors, FuchsiaFonts } from '@/constants/theme';
import { getClothingItem, deleteClothingItem, ClothingItemResponse } from '@/api/client';

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  
  const [item, setItem] = useState<ClothingItemResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [deleteAlertVisible, setDeleteAlertVisible] = useState(false);

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
      Alert.alert('Error', 'Failed to load item details.');
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = () => {
    setDeleteAlertVisible(true);
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteClothingItem(id!);
      router.back();
    } catch (err) {
      console.error('Failed to delete item:', err);
      Alert.alert('Error', 'Could not delete the item. Please try again.');
      setIsDeleting(false);
      setDeleteAlertVisible(false);
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

  return (
    <View style={styles.container}>
      
      {/* Fixed Navigation Overlay */}
      <View style={[styles.navOverlay, { top: insets.top + 16 }]} pointerEvents="box-none">
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color={FuchsiaColors.slate} size={20} />
        </Pressable>
        <Pressable onPress={() => setMenuVisible(!menuVisible)} style={styles.backButton}>
          {isDeleting ? <ActivityIndicator size="small" color={FuchsiaColors.slate} /> : <MoreVertical color={FuchsiaColors.slate} size={20} />}
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

      {/* Custom Delete Confirmation Alert */}
      {deleteAlertVisible && (
        <View style={styles.alertOverlay}>
          <View style={styles.alertBox}>
            <Text style={styles.alertTitle}>Delete this item?</Text>
            <Text style={styles.alertMessage}>
              This action cannot be undone and will permanently remove this item from your closet.
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
              {item.brand ? (
                <Text style={styles.brandText}>{item.brand}</Text>
              ) : (
                <Text style={styles.brandText}>Unbranded</Text>
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
                <Sun size={16} color={FuchsiaColors.slate} />
                <Text style={styles.statLabel}>Season</Text>
              </View>
              <Text style={styles.statValue}>All Seasons</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statHeader}>
                <RefreshCcw size={16} color={FuchsiaColors.slate} />
                <Text style={styles.statLabel}>Worn</Text>
              </View>
              <Text style={styles.statValue}>0 times</Text>
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
              <Pressable>
                <Text style={styles.seeAllText}>See All</Text>
              </Pressable>
            </View>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              contentContainerStyle={styles.styledInScroll}
            >
              {/* Dummy Outfit */}
              <Pressable style={styles.outfitCard}>
                <View style={styles.outfitImageContainer}>
                  <Image 
                    source={{ uri: 'https://placehold.co/300x400/FDF2F8/86003C/png?text=Outfit' }} 
                    style={StyleSheet.absoluteFill} 
                    contentFit="cover"
                  />
                </View>
                <View style={styles.outfitInfo}>
                  <Text style={styles.outfitTitle} numberOfLines={1}>Sunday Brunch</Text>
                </View>
              </Pressable>

              {/* Style It Button */}
              <Pressable style={styles.addOutfitCard}>
                <View style={styles.addOutfitInner}>
                  <Plus size={20} color={FuchsiaColors.slate} />
                  <Text style={styles.addOutfitText}>STYLE IT</Text>
                </View>
              </Pressable>
            </ScrollView>
          </View>

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
    paddingRight: 20, // To allow scrolling completely to the edge
  },
  outfitCard: {
    width: 140,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 6,
    borderWidth: 1,
    borderColor: 'rgba(229, 229, 239, 0.5)', // mist/50
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  outfitImageContainer: {
    aspectRatio: 3 / 4,
    backgroundColor: FuchsiaColors.cloud,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  outfitInfo: {
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  outfitTitle: {
    fontFamily: FuchsiaFonts.heading,
    fontWeight: '600',
    fontSize: 12,
    color: FuchsiaColors.ink,
  },
  addOutfitCard: {
    width: 140,
    backgroundColor: 'transparent',
  },
  addOutfitInner: {
    flex: 1,
    aspectRatio: 3 / 4,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: FuchsiaColors.mist,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(248, 248, 252, 0.5)', // cloud/50
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addOutfitText: {
    fontFamily: FuchsiaFonts.body,
    fontWeight: '600',
    fontSize: 10,
    color: FuchsiaColors.slate,
    letterSpacing: 0.5,
  }
});
