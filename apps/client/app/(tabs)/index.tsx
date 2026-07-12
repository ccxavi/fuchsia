import { StyleSheet, View, ScrollView, Pressable, Animated, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles, Lightbulb, Palette, History } from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import { jwtDecode } from 'jwt-decode';
import { getMe, getCalendarOutfits, CalendarOutfitWithOutfitResponse } from '@/api/client';

import { ThemedText } from '@/components/themed-text';
import { FuchsiaColors, FuchsiaFonts } from '@/constants/theme';
import { Skeleton } from '@/components/ui/Skeleton';
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [userName, setUserName] = useState<string>('there');
  const [greetingTime, setGreetingTime] = useState<string>('Good morning');

  const [recentLooks, setRecentLooks] = useState<CalendarOutfitWithOutfitResponse[]>([]);
  const [loadingLooks, setLoadingLooks] = useState(true);

  const [weatherData, setWeatherData] = useState<{
    temperature: number;
    conditionCode: number;
    city: string;
    loading: boolean;
  }>({ temperature: 0, conditionCode: 0, city: 'Loading...', loading: true });

  const getWeatherInfo = (code: number) => {
    const hour = new Date().getHours();
    const isNight = hour < 6 || hour >= 18;

    if (code === 0) return { emoji: isNight ? '🌙' : '☀️', text: 'Clear' };
    if (code === 1) return { emoji: isNight ? '🌙' : '🌤️', text: 'Mostly clear' };
    if (code === 2) return { emoji: '⛅', text: 'Partly cloudy' };
    if (code === 3) return { emoji: '☁️', text: 'Overcast' };
    if (code === 45 || code === 48) return { emoji: '🌫️', text: 'Fog' };
    if (code >= 51 && code <= 67) return { emoji: '🌧️', text: 'Rain' };
    if (code >= 71 && code <= 77) return { emoji: '❄️', text: 'Snow' };
    if (code >= 80 && code <= 82) return { emoji: '🌦️', text: 'Rain showers' };
    if (code >= 95) return { emoji: '⛈️', text: 'Thunderstorms' };
    return { emoji: '🌡️', text: 'Unknown' };
  };

  const getWeatherTag = (code: number, temp: number) => {
    const hour = new Date().getHours();
    const isNight = hour < 6 || hour >= 18;

    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return { tag: 'Rainy', subTag: 'Bring an umbrella' };
    if (code >= 71 && code <= 77) return { tag: 'Snowy', subTag: 'Bundle up' };
    if (code >= 95) return { tag: 'Stormy', subTag: 'Stay safe indoors' };
    
    if (temp > 25) return { tag: isNight ? 'Warm night' : 'Hot', subTag: 'Light fabrics' };
    if (temp < 15) return { tag: isNight ? 'Cold night' : 'Cold', subTag: 'Layers needed' };
    return { tag: isNight ? 'Clear night' : 'Mild', subTag: 'Perfect weather' };
  };

  const getDailyInsight = (code: number, temp: number) => {
    const hour = new Date().getHours();
    const isNight = hour < 6 || hour >= 18;
    const roundedTemp = Math.round(temp);

    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
      return {
        title: "Don't forget your umbrella",
        desc: `It's rainy and ${roundedTemp}°C out there. A water-resistant jacket and sturdy boots will keep you comfortable today.`,
      };
    }
    if (code >= 71 && code <= 77) {
      return {
        title: "Bundle up, it's snowing!",
        desc: `With temperatures around ${roundedTemp}°C and snow falling, layer up with thermal wear, a heavy coat, and a warm scarf.`,
      };
    }
    if (code >= 95) {
      return {
        title: "Stormy weather ahead",
        desc: `It's stormy and ${roundedTemp}°C outside. If you must go out, prioritize safety and wear waterproof, wind-resistant layers.`,
      };
    }
    
    if (temp > 25) {
      return {
        title: isNight ? "Warm evening ahead" : "Stay cool and stylish",
        desc: `With today's ${roundedTemp}°C heat, light linen or cotton fabrics are your best friend. Tap the sparkles below to ask me for summer outfit ideas!`,
      };
    }
    if (temp < 15) {
      return {
        title: isNight ? "Chilly night out" : "Crisp and cool",
        desc: `It's a crisp ${roundedTemp}°C outside. A stylish sweater or a light jacket will be perfect to keep you cozy.`,
      };
    }
    
    return {
      title: isNight ? "A pleasant evening" : "Perfect mild weather",
      desc: `It's a beautiful ${roundedTemp}°C right now. Almost any outfit works perfectly in this weather!`,
    };
  };

  const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  useFocusEffect(
    useCallback(() => {
      const hour = new Date().getHours();
      if (hour < 12) setGreetingTime('Good morning');
    else if (hour < 18) setGreetingTime('Good afternoon');
    else setGreetingTime('Good evening');

    const fetchUser = async () => {
      try {
        const data = await getMe();
        if (data?.user?.display_name) {
          setUserName(data.user.display_name.split(' ')[0]);
        } else {
          const token = await SecureStore.getItemAsync('access_token');
          if (token) {
            try {
              const decoded: any = jwtDecode(token);
              const fallbackName = decoded?.user_metadata?.full_name || decoded?.user_metadata?.name || decoded?.email?.split('@')[0] || 'there';
              setUserName(fallbackName.split(' ')[0]);
            } catch (e) {
              console.error('Failed to decode token:', e);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching user name from API:', error);
      }
    };
    
    const fetchWeather = async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setWeatherData(prev => ({ ...prev, loading: false, city: 'Location Denied' }));
          return;
        }

        let location = await Location.getCurrentPositionAsync({});
        const lat = location.coords.latitude;
        const lon = location.coords.longitude;

        let city = 'Unknown City';
        try {
          let geocode = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
          if (geocode && geocode.length > 0) {
            city = geocode[0].city || geocode[0].region || 'Unknown City';
          }
        } catch (e) {
          // ignore reverse geocode errors
        }

        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
        const json = await res.json();
        
        if (json.current_weather) {
          setWeatherData({
            temperature: json.current_weather.temperature,
            conditionCode: json.current_weather.weathercode,
            city,
            loading: false,
          });
        } else {
          setWeatherData(prev => ({ ...prev, loading: false, city: 'Weather Error' }));
        }
      } catch (error) {
        console.error('Error fetching weather:', error);
        setWeatherData(prev => ({ ...prev, loading: false, city: 'Weather Error' }));
      }
    };

    const fetchRecentLooks = async () => {
      try {
        const looks = await getCalendarOutfits();
        const todayStr = new Date().toISOString().split('T')[0];
        const pastLooks = looks.filter(l => l.date <= todayStr);
        pastLooks.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        const seen = new Set();
        const uniqueLooks: CalendarOutfitWithOutfitResponse[] = [];
        for (const look of pastLooks) {
          if (!seen.has(look.outfit.id)) {
            seen.add(look.outfit.id);
            uniqueLooks.push(look);
            if (uniqueLooks.length >= 5) break;
          }
        }
        setRecentLooks(uniqueLooks);
      } catch (error) {
        console.error('Error fetching recent looks:', error);
      } finally {
        setLoadingLooks(false);
      }
    };

    fetchUser();
    fetchWeather();
    fetchRecentLooks();
  }, [])
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <ThemedText style={styles.headerTitle}>{greetingTime}, {userName}</ThemedText>
        <View style={{ width: 40, height: 40 }} />
      </View>
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* Weather + Context Card */}
        <View style={styles.weatherCard}>
          <LinearGradient
            colors={['#FEF3C7', '#FFEDD5']}
            style={styles.weatherIconBg}
          >
            {weatherData.loading ? (
              <Skeleton width={24} height={24} borderRadius={12} />
            ) : (
              <ThemedText style={styles.weatherEmoji}>
                {getWeatherInfo(weatherData.conditionCode).emoji}
              </ThemedText>
            )}
          </LinearGradient>
          <View style={styles.weatherTextContainer}>
            {weatherData.loading ? (
              <View style={{ gap: 6 }}>
                <Skeleton width={100} height={16} />
                <Skeleton width={140} height={14} />
              </View>
            ) : (
              <>
                <ThemedText style={styles.weatherDate}>{currentDate}</ThemedText>
                <ThemedText style={styles.weatherDetails}>
                  {`${Math.round(weatherData.temperature)}°C ${getWeatherInfo(weatherData.conditionCode).text} · ${weatherData.city}`}
                </ThemedText>
              </>
            )}
          </View>
          <View style={styles.weatherTags}>
            {weatherData.loading ? (
              <>
                <Skeleton width={40} height={16} borderRadius={12} />
                <Skeleton width={60} height={12} />
              </>
            ) : (
              <>
                <View style={styles.weatherTag}>
                  <ThemedText style={styles.weatherTagText}>
                    {getWeatherTag(weatherData.conditionCode, weatherData.temperature).tag}
                  </ThemedText>
                </View>
                <ThemedText style={styles.weatherSubTag}>
                  {getWeatherTag(weatherData.conditionCode, weatherData.temperature).subTag}
                </ThemedText>
              </>
            )}
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
          {weatherData.loading ? (
            <View style={{ gap: 8 }}>
              <Skeleton width={180} height={24} borderRadius={4} />
              <Skeleton width="100%" height={16} borderRadius={4} />
              <Skeleton width="80%" height={16} borderRadius={4} />
            </View>
          ) : weatherData.city === 'Weather Error' || weatherData.city === 'Location Denied' ? (
            <>
              <ThemedText style={styles.dailyTipTitle}>Plan your outfits</ThemedText>
              <ThemedText style={styles.dailyTipDesc}>
                Enable location services to get personalized outfit recommendations based on your local weather!
              </ThemedText>
            </>
          ) : (() => {
            const insight = getDailyInsight(weatherData.conditionCode, weatherData.temperature);
            return (
              <>
                <ThemedText style={styles.dailyTipTitle}>{insight.title}</ThemedText>
                <ThemedText style={styles.dailyTipDesc}>{insight.desc}</ThemedText>
              </>
            );
          })()}
        </View>

        {/* Recent Looks */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Recent Looks</ThemedText>
            <Pressable onPress={() => router.push('/calendar')}>
              <ThemedText style={styles.seeAllText}>See all →</ThemedText>
            </Pressable>
          </View>
          {loadingLooks ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentLooksContainer}>
              {[1, 2, 3].map(i => (
                <Skeleton key={i} width={130} height={175} borderRadius={16} />
              ))}
            </ScrollView>
          ) : recentLooks.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentLooksContainer}>
              {recentLooks.map((look) => {
                const dateObj = new Date(look.date + 'T12:00:00Z');
                const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
                const outfit = look.outfit;
                const firstUploadedImage = outfit.images && outfit.images.length > 0 ? outfit.images[0].image_url : null;
                const displayImage = firstUploadedImage || outfit.image_url;
                const totalItems = (outfit.clothing_items || []).length;
                const items = (outfit.clothing_items || []).slice(0, 4);

                return (
                  <Pressable key={look.id} style={styles.recentCard} onPress={() => router.push(`/outfit/${outfit.id}`)}>
                    <View style={styles.recentGrid}>
                      {displayImage ? (
                        <Image source={{ uri: displayImage as string }} style={styles.recentGridImageFull} contentFit="cover" />
                      ) : items.length === 0 ? (
                         <View style={[StyleSheet.absoluteFillObject, { backgroundColor: FuchsiaColors.mist }]} />
                      ) : items.length === 1 ? (
                         <Image source={{ uri: (items[0].image_url || `https://placehold.co/80x80/FDF2F8/86003C/png?text=${encodeURIComponent(items[0].name)}`) as string }} style={styles.recentGridImageFull} contentFit="cover" />
                      ) : items.length === 2 ? (
                         <>
                           <Image source={{ uri: (items[0].image_url || `https://placehold.co/80x80/FDF2F8/86003C/png?text=${encodeURIComponent(items[0].name)}`) as string }} style={styles.recentGridImageHalf} contentFit="cover" />
                           <Image source={{ uri: (items[1].image_url || `https://placehold.co/80x80/FDF2F8/86003C/png?text=${encodeURIComponent(items[1].name)}`) as string }} style={styles.recentGridImageHalf} contentFit="cover" />
                         </>
                      ) : items.length >= 3 ? (
                         <>
                           <Image source={{ uri: (items[0].image_url || `https://placehold.co/80x80/FDF2F8/86003C/png?text=${encodeURIComponent(items[0].name)}`) as string }} style={items.length === 3 ? styles.recentGridImageTopRowSpan : styles.recentGridImageQuarter} contentFit="cover" />
                           <Image source={{ uri: (items[1].image_url || `https://placehold.co/80x80/FDF2F8/86003C/png?text=${encodeURIComponent(items[1].name)}`) as string }} style={styles.recentGridImageQuarter} contentFit="cover" />
                           <Image source={{ uri: (items[2].image_url || `https://placehold.co/80x80/FDF2F8/86003C/png?text=${encodeURIComponent(items[2].name)}`) as string }} style={styles.recentGridImageQuarter} contentFit="cover" />
                           {items.length >= 4 && (
                             <View style={styles.recentGridImageQuarter}>
                               <Image source={{ uri: (items[3].image_url || `https://placehold.co/80x80/FDF2F8/86003C/png?text=${encodeURIComponent(items[3].name)}`) as string }} style={styles.recentGridImageFull} contentFit="cover" />
                               {totalItems > 4 && (
                                 <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
                                   <Text style={{ fontFamily: FuchsiaFonts.heading, fontSize: 16, color: '#fff', fontWeight: 'bold' }}>+{totalItems - 4}</Text>
                                 </View>
                               )}
                             </View>
                           )}
                         </>
                      ) : null}
                    </View>
                    <View style={styles.recentContent}>
                      <ThemedText style={styles.recentTitle} numberOfLines={1}>{outfit.name}</ThemedText>
                      <ThemedText style={styles.recentDate}>{dateStr}</ThemedText>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : (
            <View style={{
              backgroundColor: '#fff',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: FuchsiaColors.mist,
              padding: 24,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: FuchsiaColors.blush, alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                <History size={24} color={FuchsiaColors.vibrant} />
              </View>
              <ThemedText style={{ fontFamily: FuchsiaFonts.bodySemiBold, fontSize: 14, color: FuchsiaColors.ink }}>
                No recent looks
              </ThemedText>
              <ThemedText style={{ fontFamily: FuchsiaFonts.body, fontSize: 12, color: FuchsiaColors.slate, textAlign: 'center', lineHeight: 18 }}>
                Your logged outfits will appear here.{'\n'}Tap the + button to create a new look.
              </ThemedText>
            </View>
          )}
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
    paddingTop: 8,
    paddingBottom: 100,
    gap: 20,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
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
    height: 130,
  },
  recentGridImageFull: {
    width: '100%',
    height: '100%',
    backgroundColor: '#fff',
  },
  recentGridImageHalf: {
    width: '50%',
    height: '100%',
    backgroundColor: '#fff',
  },
  recentGridImageTopRowSpan: {
    width: '100%',
    height: '50%',
    backgroundColor: '#fff',
  },
  recentGridImageQuarter: {
    width: '50%',
    height: '50%',
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
