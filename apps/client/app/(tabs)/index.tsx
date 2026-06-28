import { StyleSheet, View, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles, Lightbulb, Palette, LogOut } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useState, useEffect } from 'react';
import { getMe } from '@/api/client';

import { ThemedText } from '@/components/themed-text';
import { FuchsiaColors, FuchsiaFonts } from '@/constants/theme';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [userName, setUserName] = useState<string>('there');
  const [greetingTime, setGreetingTime] = useState<string>('Good morning');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreetingTime('Good morning');
    else if (hour < 18) setGreetingTime('Good afternoon');
    else setGreetingTime('Good evening');

    const fetchUser = async () => {
      try {
        const data = await getMe();
        if (data?.user?.display_name) {
          setUserName(data.user.display_name.split(' ')[0]);
        }
      } catch (error) {
        console.error('Error fetching user name from API:', error);
      }
    };
    
    fetchUser();
  }, []);

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');
    router.replace('/welcome');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Row */}
        <View style={styles.headerRow}>
          <ThemedText style={styles.greeting}>{greetingTime}, {userName}</ThemedText>
          <Pressable onPress={handleLogout} style={({ pressed }) => [styles.logoutButton, pressed && { opacity: 0.7 }]}>
            <LogOut size={20} color={FuchsiaColors.slate} />
          </Pressable>
        </View>

        {/* Weather + Context Card */}
        <View style={styles.weatherCard}>
          <LinearGradient
            colors={['#FEF3C7', '#FFEDD5']}
            style={styles.weatherIconBg}
          >
            <ThemedText style={styles.weatherEmoji}>⛅</ThemedText>
          </LinearGradient>
          <View style={styles.weatherTextContainer}>
            <ThemedText style={styles.weatherDate}>Saturday, June 28</ThemedText>
            <ThemedText style={styles.weatherDetails}>32°C Partly cloudy · Cebu City</ThemedText>
          </View>
          <View style={styles.weatherTags}>
            <View style={styles.weatherTag}>
              <ThemedText style={styles.weatherTagText}>Hot</ThemedText>
            </View>
            <ThemedText style={styles.weatherSubTag}>Light fabrics</ThemedText>
          </View>
        </View>

        {/* Daily Style Tip */}
        <View style={styles.dailyTipCard}>
          <View style={styles.dailyTipHeader}>
            <View style={styles.dailyTipIcon}>
              <Lightbulb size={16} color="#fff" />
            </View>
            <ThemedText style={styles.dailyTipLabel}>Daily Insight</ThemedText>
          </View>
          <ThemedText style={styles.dailyTipTitle}>Stay cool and stylish</ThemedText>
          <ThemedText style={styles.dailyTipDesc}>
            With today&apos;s 32°C heat, light linen or cotton fabrics are your best friend. Tap the sparkles below to ask me for summer outfit ideas!
          </ThemedText>
        </View>

        {/* Recent Looks */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Recent Looks</ThemedText>
            <Pressable>
              <ThemedText style={styles.seeAllText}>See all →</ThemedText>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentLooksContainer}>
            {[
              { id: '1', title: 'Interview Look', date: 'Jun 26', items: ['Blazer', 'Tee', 'Chinos', 'Loafers'] },
              { id: '2', title: 'Casual Friday', date: 'Jun 25', items: ['Polo', 'Jeans', 'Boots', 'Watch'] },
              { id: '3', title: 'Dinner Date', date: 'Jun 23', items: ['Dress', 'Heels', 'Bag', 'Earring'] },
            ].map((look) => (
              <Pressable key={look.id} style={styles.recentCard}>
                <View style={styles.recentGrid}>
                  {look.items.map((item, idx) => (
                    <Image key={idx} source={{ uri: `https://placehold.co/80x80/FDF2F8/86003C/png?text=${item}` }} style={styles.recentGridImage} />
                  ))}
                </View>
                <View style={styles.recentContent}>
                  <ThemedText style={styles.recentTitle} numberOfLines={1}>{look.title}</ThemedText>
                  <ThemedText style={styles.recentDate}>{look.date}</ThemedText>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Style Tips */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Style Tips</ThemedText>
          <View style={styles.tipsContainer}>
            <View style={styles.tipCard}>
              <View style={styles.tipIcon}>
                <Sparkles size={16} color={FuchsiaColors.deep} />
              </View>
              <View style={styles.tipContent}>
                <ThemedText style={styles.tipTitle}>Try your navy blazer with shorts</ThemedText>
                <ThemedText style={styles.tipDesc}>A blazer + shorts combo is a great smart-casual look for warm weather events.</ThemedText>
              </View>
            </View>
            <View style={styles.tipCard}>
              <View style={styles.tipIcon}>
                <Palette size={16} color={FuchsiaColors.deep} />
              </View>
              <View style={styles.tipContent}>
                <ThemedText style={styles.tipTitle}>Your floral dress needs love</ThemedText>
                <ThemedText style={styles.tipDesc}>Worn only once! Perfect for today&apos;s weather — pair it with sandals.</ThemedText>
              </View>
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
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 100,
    gap: 20,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoutButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FuchsiaColors.mist,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 24,
    color: FuchsiaColors.ink,
  },

  // Weather Card
  weatherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: FuchsiaColors.mist,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  weatherIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weatherEmoji: {
    fontSize: 20,
  },
  weatherTextContainer: {
    flex: 1,
  },
  weatherDate: {
    fontFamily: FuchsiaFonts.bodySemiBold,
    fontSize: 14,
    color: FuchsiaColors.ink,
  },
  weatherDetails: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 12,
    color: FuchsiaColors.slate,
  },
  weatherTags: {
    alignItems: 'flex-end',
    gap: 2,
  },
  weatherTag: {
    backgroundColor: FuchsiaColors.blush,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  weatherTagText: {
    fontFamily: FuchsiaFonts.bodySemiBold,
    fontSize: 10,
    color: FuchsiaColors.deep,
  },
  weatherSubTag: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 10,
    color: FuchsiaColors.slate,
  },

  // Daily Tip
  dailyTipCard: {
    backgroundColor: FuchsiaColors.deep,
    borderRadius: 16,
    padding: 20,
  },
  dailyTipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  dailyTipIcon: {
    width: 32,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dailyTipLabel: {
    fontFamily: FuchsiaFonts.bodySemiBold,
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dailyTipTitle: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 20,
    color: '#fff',
    lineHeight: 28,
  },
  dailyTipDesc: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 8,
    lineHeight: 22,
  },

  // Sections
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontFamily: FuchsiaFonts.bodySemiBold,
    fontSize: 12,
    color: FuchsiaColors.slate,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  seeAllText: {
    fontFamily: FuchsiaFonts.bodySemiBold,
    fontSize: 12,
    color: FuchsiaColors.vibrant,
  },

  // Recent Looks
  recentLooksContainer: {
    gap: 12,
  },
  recentCard: {
    width: 130,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: FuchsiaColors.mist,
    overflow: 'hidden',
  },
  recentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: FuchsiaColors.mist,
    gap: 1,
    padding: 1,
  },
  recentGridImage: {
    width: '49%',
    aspectRatio: 1,
    backgroundColor: '#fff',
  },
  recentContent: {
    padding: 10,
  },
  recentTitle: {
    fontFamily: FuchsiaFonts.bodySemiBold,
    fontSize: 11,
    color: FuchsiaColors.ink,
  },
  recentDate: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 10,
    color: FuchsiaColors.slate,
    marginTop: 2,
  },

  // Style Tips
  tipsContainer: {
    gap: 8,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: FuchsiaColors.mist,
    padding: 14,
  },
  tipIcon: {
    width: 36,
    height: 36,
    backgroundColor: FuchsiaColors.blush,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontFamily: FuchsiaFonts.bodySemiBold,
    fontSize: 14,
    color: FuchsiaColors.ink,
  },
  tipDesc: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 12,
    color: FuchsiaColors.slate,
    marginTop: 2,
    lineHeight: 18,
  },
});
