import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, DeviceEventEmitter } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { Image } from 'expo-image';
import { ArrowLeft, MoreVertical, Edit2, Trash2, Layers } from 'lucide-react-native';

import { FuchsiaColors, FuchsiaFonts } from '@/constants/theme';
import { getOutfit, deleteOutfit, OutfitWithWardrobesResponse } from '@/api/client';

export default function OutfitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const [outfit, setOutfit] = useState<OutfitWithWardrobesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [deleteAlertVisible, setDeleteAlertVisible] = useState(false);

  useEffect(() => {
    if (id) {
      fetchOutfit();
    }

    const subscription = DeviceEventEmitter.addListener('outfitUpdated', (updatedOutfit) => {
      if (updatedOutfit && updatedOutfit.id === id) {
        // Re-fetch to get full data with clothing_items
        fetchOutfit();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [id]);

  const fetchOutfit = async () => {
    try {
      const data = await getOutfit(id!);
      setOutfit(data);
    } catch (err) {
      console.error('Failed to fetch outfit:', err);
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = () => {
    setMenuVisible(false);
    setDeleteAlertVisible(true);
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteOutfit(id!);
      router.back();
    } catch (err) {
      console.error('Failed to delete outfit:', err);
      setIsDeleting(false);
      setDeleteAlertVisible(false);
    }
  };

  if (isLoading || !outfit) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={FuchsiaColors.vibrant} />
      </View>
    );
  }

  const createdDate = new Date(outfit.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerButton}>
          <ArrowLeft size={18} color={FuchsiaColors.slate} />
        </Pressable>
        <Text style={styles.headerTitle}>Outfit Detail</Text>
        <Pressable onPress={() => setMenuVisible(!menuVisible)} style={styles.headerButton}>
          {isDeleting ? (
            <ActivityIndicator size="small" color={FuchsiaColors.slate} />
          ) : (
            <Edit2 size={18} color={FuchsiaColors.slate} />
          )}
        </Pressable>
      </View>

      {/* Dropdown Menu Backdrop */}
      {menuVisible && (
        <Pressable
          style={[StyleSheet.absoluteFill, { zIndex: 100 }]}
          onPress={() => setMenuVisible(false)}
        />
      )}

      {/* Dropdown Menu */}
      {menuVisible && (
        <View style={[styles.dropdownMenu, { top: insets.top + 56 }]}>
          <Pressable
            style={({ pressed }) => [styles.dropdownItem, pressed && styles.dropdownItemPressed]}
            onPress={() => {
              setMenuVisible(false);
              router.push({ pathname: '/add-outfit', params: { id } });
            }}
          >
            <Edit2 size={16} color={FuchsiaColors.slate} />
            <Text style={styles.dropdownItemText}>Edit Outfit</Text>
          </Pressable>
          <View style={styles.dropdownDivider} />
          <Pressable
            style={({ pressed }) => [styles.dropdownItem, pressed && styles.dropdownItemPressed]}
            onPress={handleDelete}
          >
            <Trash2 size={16} color="#E11D48" />
            <Text style={[styles.dropdownItemText, { color: '#E11D48' }]}>Delete Outfit</Text>
          </Pressable>
        </View>
      )}

      {/* Delete Confirmation */}
      {deleteAlertVisible && (
        <View style={styles.alertOverlay}>
          <View style={styles.alertBox}>
            <Text style={styles.alertTitle}>Delete this outfit?</Text>
            <Text style={styles.alertMessage}>
              This action cannot be undone and will permanently remove this outfit.
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
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.alertDeleteText}>Delete</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      )}

      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: (insets.bottom || 24) + 16 }}
      >
        {/* Outfit Name */}
        <View style={styles.nameSection}>
          <Text style={styles.outfitName}>{outfit.name}</Text>
          <View style={styles.tagsRow}>
            {outfit.is_ai_generated && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>AI Curated</Text>
              </View>
            )}
            <View style={styles.tag}>
              <Text style={styles.tagText}>
                {outfit.clothing_items.length} {outfit.clothing_items.length === 1 ? 'Item' : 'Items'}
              </Text>
            </View>
          </View>
        </View>

        {/* Outfit Image */}
        {outfit.image_url && (
          <View style={styles.outfitImageSection}>
            <View style={styles.outfitImageContainer}>
              <Image
                source={{ uri: outfit.image_url }}
                style={StyleSheet.absoluteFillObject}
                contentFit="cover"
                transition={300}
              />
            </View>
          </View>
        )}

        {/* All Pieces */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>
            {outfit.clothing_items.length} {outfit.clothing_items.length === 1 ? 'Item' : 'Items'}
          </Text>

          {outfit.clothing_items.length === 0 ? (
            <View style={styles.emptyItems}>
              <Layers size={24} color={FuchsiaColors.mist} />
              <Text style={styles.emptyItemsText}>No items in this outfit yet</Text>
            </View>
          ) : (
            <View style={styles.itemsList}>
              {outfit.clothing_items.map((item, index) => (
                <Pressable
                  key={item.id}
                  style={[
                    styles.itemRow,
                    index < outfit.clothing_items.length - 1 && styles.itemRowBorder,
                  ]}
                  onPress={() => router.push(`/item/${item.id}`)}
                >
                  <View style={styles.itemThumb}>
                    {item.image_url ? (
                      <Image
                        source={{ uri: item.image_url }}
                        style={StyleSheet.absoluteFillObject}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: FuchsiaColors.cloud, alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={{ fontSize: 8, color: FuchsiaColors.mist }}>{item.name[0]}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.itemDetails}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemCategory}>{item.category || 'Item'}</Text>
                  </View>
                  <View style={styles.itemBadge}>
                    <Text style={styles.itemBadgeText}>{item.category || 'Item'}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Wardrobes */}
        {outfit.wardrobes && outfit.wardrobes.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>In Wardrobes</Text>
            <View style={styles.wardrobesList}>
              {outfit.wardrobes.map(w => (
                <Pressable
                  key={w.id}
                  style={styles.wardrobeChip}
                  onPress={() => router.push(`/wardrobe/${w.id}`)}
                >
                  <Text style={styles.wardrobeChipText}>{w.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Wear History */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Wear History</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Times worn</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>—</Text>
              <Text style={styles.statLabel}>Last worn</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{createdDate}</Text>
              <Text style={styles.statLabel}>Created</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
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
  headerButton: {
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
  // Dropdown menu
  dropdownMenu: {
    position: 'absolute',
    right: 20,
    zIndex: 200,
    backgroundColor: '#fff',
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
    minWidth: 180,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  dropdownItemPressed: {
    backgroundColor: FuchsiaColors.cloud,
  },
  dropdownItemText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 14,
    fontWeight: '500',
    color: FuchsiaColors.ink,
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: FuchsiaColors.cloud,
  },
  // Alert overlay
  alertOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    zIndex: 300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertBox: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 15,
  },
  alertTitle: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 18,
    fontWeight: '700',
    color: FuchsiaColors.ink,
    marginBottom: 8,
    textAlign: 'center',
  },
  alertMessage: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 14,
    color: FuchsiaColors.slate,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  alertButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  alertCancelButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FuchsiaColors.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertCancelText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: FuchsiaColors.ink,
  },
  alertDeleteButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#E11D48',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertDeleteText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  // Name section
  nameSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  outfitName: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 22,
    color: FuchsiaColors.ink,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  tag: {
    backgroundColor: '#FDF2F8',
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 10,
    fontWeight: '600',
    color: FuchsiaColors.deep,
  },
  // Outfit image
  outfitImageSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  outfitImageContainer: {
    aspectRatio: 4 / 5,
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: FuchsiaColors.mist,
    backgroundColor: FuchsiaColors.cloud,
  },
  // Card sections
  card: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: FuchsiaColors.mist,
    backgroundColor: '#fff',
    padding: 16,
  },
  cardLabel: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: FuchsiaColors.slate,
    marginBottom: 12,
  },
  // Items list
  emptyItems: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 24,
  },
  emptyItemsText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 13,
    color: FuchsiaColors.mist,
  },
  itemsList: {
    gap: 0,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  itemRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: FuchsiaColors.mist,
  },
  itemThumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: FuchsiaColors.mist,
    backgroundColor: '#fff',
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
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
  itemBadge: {
    backgroundColor: '#FDF2F8',
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  itemBadgeText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 10,
    fontWeight: '500',
    color: FuchsiaColors.deep,
  },
  // Wardrobes
  wardrobesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  wardrobeChip: {
    backgroundColor: FuchsiaColors.cloud,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  wardrobeChipText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 13,
    fontWeight: '500',
    color: FuchsiaColors.ink,
  },
  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: FuchsiaColors.cloud,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: FuchsiaFonts.data,
    fontSize: 18,
    fontWeight: '500',
    color: FuchsiaColors.deep,
  },
  statLabel: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 10,
    color: FuchsiaColors.slate,
    marginTop: 4,
  },
});
