import { View, Animated, StyleSheet, useWindowDimensions, ScrollView, Text } from 'react-native';
import { useState, useEffect } from 'react';
import { FuchsiaColors, FuchsiaFonts } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const Skeleton = ({ width, height, borderRadius = 4, style }: any) => {
  const pulseAnim = useState(new Animated.Value(0.3))[0];

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: FuchsiaColors.mist,
          opacity: pulseAnim,
        },
        style,
      ]}
    />
  );
};

export const GridSkeleton = () => {
  return (
    <View style={styles.gridContainer}>
      {[...Array(6)].map((_, i) => (
        <View key={i} style={styles.gridItem}>
          <View style={{ width: '100%', aspectRatio: 4 / 5, borderRadius: 20, overflow: 'hidden' }}>
            <Skeleton width="100%" height="100%" borderRadius={20} />
          </View>
          <View style={styles.gridItemText}>
            <Skeleton width="70%" height={14} />
            <Skeleton width="40%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
};

export const MemoryScreenSkeleton = () => {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 }}>
        <Skeleton width={40} height={40} borderRadius={12} />
        <Skeleton width={120} height={20} />
        <View style={{ width: 40 }} />
      </View>
      <View style={{ gap: 12, padding: 16 }}>
      {[...Array(5)].map((_, i) => (
        <View key={i} style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' }}>
          <View style={{ flex: 1, gap: 12, paddingRight: 12 }}>
            <View style={{ gap: 6 }}>
              <Skeleton width="90%" height={16} />
              <Skeleton width="60%" height={16} />
            </View>
            <Skeleton width={80} height={20} borderRadius={8} />
          </View>
          <Skeleton width={36} height={36} borderRadius={10} />
        </View>
      ))}
      </View>
    </View>
  );
};

export const WardrobeListSkeleton = () => {
  return (
    <View style={{ paddingHorizontal: 20, paddingBottom: 130, paddingTop: 12, gap: 16 }}>
      {[...Array(4)].map((_, i) => (
        <View key={i} style={{ height: 140, width: '100%', borderRadius: 24, position: 'relative', overflow: 'hidden' }}>
          <Skeleton width="100%" height="100%" borderRadius={24} style={{ position: 'absolute' }} />
          <View style={{ position: 'absolute', bottom: 20, left: 20, gap: 8 }}>
            <Skeleton width={120} height={20} borderRadius={4} />
            <Skeleton width={160} height={14} borderRadius={4} />
          </View>
        </View>
      ))}
    </View>
  );
};

export const ItemDetailSkeleton = () => {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.detailContainer}>
      <View style={{ position: 'absolute', top: insets.top + 16, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', zIndex: 10 }}>
        <Skeleton width={40} height={40} borderRadius={12} />
        <Skeleton width={40} height={40} borderRadius={12} />
      </View>
      <View style={{ width: '100%', aspectRatio: 1, overflow: 'hidden' }}>
        <Skeleton width="100%" height="100%" borderRadius={0} />
      </View>
      <View style={{ padding: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, alignItems: 'flex-start' }}>
          <View style={{ gap: 8, flex: 1 }}>
            <Skeleton width="60%" height={28} />
          </View>
          <Skeleton width={80} height={28} borderRadius={14} />
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 32 }}>
          {[...Array(4)].map((_, i) => (
            <View key={i} style={{ width: '47%', height: 80, borderRadius: 16, overflow: 'hidden' }}>
              <Skeleton width="100%" height="100%" borderRadius={16} />
            </View>
          ))}
        </View>

        <Skeleton width="40%" height={24} style={{ marginBottom: 16 }} />
        <View style={{ flexDirection: 'row', gap: 16 }}>
          {[...Array(3)].map((_, i) => (
            <View key={i} style={{ width: 160, gap: 8 }}>
              <Skeleton width={160} height={200} borderRadius={16} />
              <Skeleton width="80%" height={16} />
              <Skeleton width="50%" height={14} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

export const WardrobeDetailSkeleton = () => {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.detailContainer}>
      <View style={{ position: 'absolute', top: insets.top + 16, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', zIndex: 10 }}>
        <Skeleton width={40} height={40} borderRadius={12} />
        <Skeleton width={40} height={40} borderRadius={12} />
      </View>
      <View style={{ width: '100%', aspectRatio: 1.25, overflow: 'hidden', justifyContent: 'flex-end' }}>
        <Skeleton width="100%" height="100%" borderRadius={0} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        <View style={{ padding: 20 }}>
          <Skeleton width="70%" height={32} style={{ marginBottom: 12 }} />
          <Skeleton width="50%" height={16} />
        </View>
      </View>
      <View style={{ padding: 20 }}>
        <Skeleton width="40%" height={24} style={{ marginBottom: 16 }} />
        <View style={{ flexDirection: 'row', gap: 16, marginBottom: 32 }}>
          {[...Array(2)].map((_, i) => (
            <View key={i} style={{ width: 160, gap: 8 }}>
              <Skeleton width={160} height={200} borderRadius={16} />
              <Skeleton width="80%" height={16} />
              <Skeleton width="50%" height={14} />
            </View>
          ))}
        </View>

        <Skeleton width="40%" height={24} style={{ marginBottom: 16 }} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16 }}>
          {[...Array(4)].map((_, i) => (
            <View key={i} style={{ width: '47%', gap: 8, marginBottom: 16 }}>
              <View style={{ width: '100%', aspectRatio: 4 / 5, borderRadius: 20, overflow: 'hidden' }}>
                <Skeleton width="100%" height="100%" borderRadius={20} />
              </View>
              <Skeleton width="70%" height={14} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

export const OutfitDetailSkeleton = () => {
  return (
    <View style={styles.detailContainer}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 }}>
        <Skeleton width={40} height={40} borderRadius={12} />
        <Skeleton width={120} height={20} />
        <Skeleton width={40} height={40} borderRadius={12} />
      </View>
      <View style={{ padding: 20, paddingTop: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <Skeleton width="50%" height={32} />
          <Skeleton width={60} height={16} />
        </View>

        <View style={{ backgroundColor: '#fff', borderRadius: 24, padding: 20, marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <Skeleton width="30%" height={16} />
            <Skeleton width={60} height={14} />
          </View>
          <View style={{ width: '100%', aspectRatio: 4 / 5, borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
            <Skeleton width="100%" height="100%" borderRadius={16} />
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} width={64} height={64} borderRadius={12} />
            ))}
          </View>
        </View>

        <View style={{ backgroundColor: '#fff', borderRadius: 24, padding: 20 }}>
          <Skeleton width="30%" height={16} style={{ marginBottom: 16 }} />
          {[...Array(3)].map((_, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <Skeleton width={48} height={48} borderRadius={12} />
              <View style={{ flex: 1, gap: 8 }}>
                <Skeleton width="60%" height={16} />
                <Skeleton width="40%" height={14} />
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

export const FormSkeleton = () => {
  return (
    <View style={styles.formContainer}>
      <Skeleton width="100%" height={200} borderRadius={16} style={{ marginBottom: 24 }} />
      
      <Skeleton width="30%" height={14} style={{ marginBottom: 8 }} />
      <Skeleton width="100%" height={50} borderRadius={12} style={{ marginBottom: 20 }} />
      
      <Skeleton width="30%" height={14} style={{ marginBottom: 8 }} />
      <Skeleton width="100%" height={50} borderRadius={12} style={{ marginBottom: 20 }} />
      
      <Skeleton width="100%" height={56} borderRadius={28} style={{ marginTop: 20 }} />
    </View>
  );
};

export const WardrobeFormSkeleton = () => {
  return (
    <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }}>
      <Skeleton width="100%" height={180} borderRadius={16} style={{ marginBottom: 24 }} />
      <View style={{ height: 1, backgroundColor: FuchsiaColors.mist, marginBottom: 24 }} />
      <Skeleton width="30%" height={14} style={{ marginBottom: 6 }} />
      <Skeleton width="100%" height={44} borderRadius={12} />
    </View>
  );
};

export const ItemFormSkeleton = () => {
  return (
    <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }}>
      {/* Upload Area Skeleton */}
      <View style={{ 
        alignItems: 'center', 
        backgroundColor: FuchsiaColors.blush, 
        borderRadius: 16, 
        borderWidth: 2, 
        borderColor: 'rgba(244, 114, 182, 0.5)', 
        borderStyle: 'dashed', 
        paddingVertical: 40, 
        gap: 16,
        marginBottom: 20
      }}>
        <Skeleton width={64} height={64} borderRadius={16} />
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Skeleton width={100} height={14} />
          <Skeleton width={200} height={12} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <Skeleton width={100} height={40} borderRadius={12} />
          <Skeleton width={100} height={40} borderRadius={12} />
        </View>
      </View>

      {/* Preview Card Skeleton */}
      <View style={{ backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: FuchsiaColors.mist, padding: 16, marginBottom: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Skeleton width={24} height={24} borderRadius={8} />
          <Skeleton width="40%" height={12} />
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Skeleton width={96} height={96} borderRadius={12} />
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Skeleton width="60%" height={16} style={{ marginBottom: 4 }} />
            <Skeleton width="100%" height={12} />
          </View>
        </View>
      </View>

      {/* Editable Fields (Exact DOM Structure) */}
      <View style={{ gap: 12 }}>
        <Skeleton width="40%" height={16} style={{ marginBottom: 4 }} />
        
        <View style={{ marginBottom: 12 }}>
          <Skeleton width="15%" height={14} style={{ marginBottom: 6 }} />
          <Skeleton width="100%" height={44} borderRadius={12} />
        </View>

        <View style={{ marginBottom: 12 }}>
          <Skeleton width="20%" height={14} style={{ marginBottom: 6 }} />
          <Skeleton width="100%" height={44} borderRadius={12} />
        </View>

        <View style={{ marginBottom: 12 }}>
          <Skeleton width="15%" height={14} style={{ marginBottom: 6 }} />
        </View>
      </View>
    </View>
  );
};

export const OutfitFormSkeleton = () => {
  return (
    <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}>
      {/* Selected Items Section */}
      <View style={{ marginBottom: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Skeleton width="40%" height={16} style={{ marginBottom: 4 }} />
          <Skeleton width="20%" height={12} />
        </View>

        <View style={{ flexDirection: 'row', gap: 16, paddingTop: 12, paddingBottom: 8 }}>
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} width={96} height={96 * (5/4)} borderRadius={16} />
          ))}
        </View>
      </View>

      <View style={{ height: 1, backgroundColor: FuchsiaColors.mist, marginBottom: 20 }} />

      {/* Outfit Details Form */}
      <View style={{ marginBottom: 20 }}>
        <Skeleton width="40%" height={16} style={{ marginBottom: 16 }} />

        <View style={{ marginBottom: 16 }}>
          <Skeleton width="30%" height={12} style={{ marginBottom: 6 }} />
          <Skeleton width="100%" height={44} borderRadius={12} />
        </View>

        <View style={{ marginBottom: 16 }}>
          <Skeleton width="50%" height={12} style={{ marginBottom: 6 }} />
          <Skeleton width="100%" height={44} borderRadius={12} />
        </View>
      </View>

      {/* Wardrobe Selector */}
      <View style={{ marginBottom: 20 }}>
        <Skeleton width="40%" height={16} style={{ marginBottom: 4 }} />
        <Skeleton width="70%" height={12} style={{ marginBottom: 12, marginTop: -2 }} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} width={150} height={100} borderRadius={18} />
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
    padding: 20,
  },
  gridItem: {
    width: '47%',
    gap: 8,
    marginBottom: 16,
  },
  gridItemText: {
    gap: 4,
    paddingHorizontal: 4,
  },
  listContainer: {
    padding: 20,
    gap: 16,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: FuchsiaColors.mist,
    gap: 12,
  },
  listTextContainer: {
    flex: 1,
    gap: 8,
  },
  wardrobeSkeletonCard: {
    height: 140,
    width: '100%',
    borderRadius: 24,
    marginBottom: 16,
    position: 'relative',
    overflow: 'hidden'
  },
  detailContainer: {
    flex: 1,
  },
  formContainer: {
    padding: 20,
  },
});

export const CalendarSkeleton = ({ calendarDays }: { calendarDays?: (number | null)[] }) => {
  const { width } = useWindowDimensions();
  const cellWidth = (width - 40 - (6 * 4)) / 7;
  
  const days = calendarDays || [...Array(35)].map(() => null);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }} showsVerticalScrollIndicator={false} bounces={false}>
        <View style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => (
              <Text key={i} style={{ width: cellWidth, textAlign: 'center', fontFamily: FuchsiaFonts.body, fontSize: 10, fontWeight: '600', color: FuchsiaColors.slate }}>{day}</Text>
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {days.map((dayNum, i) => {
              const cellHeight = cellWidth * 1.35;
              if (dayNum === null) {
                return <View key={i} style={{ width: cellWidth, height: cellHeight, marginBottom: 4 }} />;
              }
              return (
                <View key={i} style={{ width: cellWidth, height: cellHeight, marginBottom: 4, borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(248, 248, 252, 0.3)', position: 'relative' }}>
                  <Text style={{ position: 'absolute', top: 4, left: 6, fontFamily: FuchsiaFonts.body, fontSize: 10, fontWeight: '500', color: 'rgba(74, 74, 104, 0.6)', zIndex: 10 }}>
                    {dayNum}
                  </Text>
                  <Skeleton width="100%" height="100%" borderRadius={12} style={{ opacity: 0.4 }} />
                </View>
              );
            })}
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: FuchsiaColors.blush, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, marginBottom: 16 }}>
           <Skeleton width={60} height={14} />
           <Text style={{ color: FuchsiaColors.mist, fontSize: 14 }}>·</Text>
           <Skeleton width={60} height={14} />
           <Text style={{ color: FuchsiaColors.mist, fontSize: 14 }}>·</Text>
           <Skeleton width={60} height={14} />
        </View>
      </ScrollView>
    </View>
  );
};
