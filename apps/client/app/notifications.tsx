import { View, StyleSheet, ScrollView, TouchableOpacity, Switch, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Bell, Camera, BarChart3, CalendarClock } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { ThemedText } from '@/components/themed-text';
import { FuchsiaColors, FuchsiaFonts } from '@/constants/theme';
import { getMe, updateProfile } from '@/api/client';
import { Skeleton } from '@/components/ui/Skeleton';

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(true);

  const [toggles, setToggles] = useState({
    dailyReminders: true,
    fitPicReminders: true,
    weeklyStatsReminders: true,
  });

  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const data = await getMe();
        if (data?.user) {
          setToggles({
            dailyReminders: data.user.daily_reminders ?? true,
            fitPicReminders: data.user.fit_pic_reminders ?? true,
            weeklyStatsReminders: data.user.weekly_stats_reminders ?? true,
          });
        }
      } catch (error) {
        console.error('Failed to fetch user preferences:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPreferences();
  }, []);

  const toggleSwitch = async (key: keyof typeof toggles) => {
    const newValue = !toggles[key];
    
    // Optimistically update the UI instantly so the switch doesn't bounce
    setToggles(prev => ({ ...prev, [key]: newValue }));
    
    // If turning on a notification, we must ensure we have push permissions
    if (newValue) {
      const token = await registerForPushNotificationsAsync();
      if (token) {
        
        // Sync with backend
        try {
          await updateProfile({
            push_token: token,
            ...(key === 'dailyReminders' && { daily_reminders: newValue }),
            ...(key === 'fitPicReminders' && { fit_pic_reminders: newValue }),
            ...(key === 'weeklyStatsReminders' && { weekly_stats_reminders: newValue }),
          });
        } catch (e) {
          console.error("Failed to sync push token with backend", e);
        }
      } else {
        // If permission was denied or failed
        setToggles(prev => ({ ...prev, [key]: false }));
      }
    } else {
      // Sync with backend
      try {
        await updateProfile({
          ...(key === 'dailyReminders' && { daily_reminders: newValue }),
          ...(key === 'fitPicReminders' && { fit_pic_reminders: newValue }),
          ...(key === 'weeklyStatsReminders' && { weekly_stats_reminders: newValue }),
        });
      } catch (e) {
        console.error("Failed to sync reminder off", e);
      }
    }
  };

  async function registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: FuchsiaColors.vibrant,
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        Alert.alert('Permission required', 'Failed to get push token for push notification!');
        return null;
      }
      
      // Note: In a real app, you need to provide your EAS project ID here
      // For now, it will fetch the default Expo token
      try {
        token = (await Notifications.getExpoPushTokenAsync({
          projectId: "5b8768d2-34e8-44b0-be6a-63c2343b6aa8"
        })).data;
      } catch (e) {
        console.log("Error getting token", e);
        Alert.alert('Error', 'Could not generate push token.');
        return null;
      }
    } else {
      Alert.alert('Simulator', 'Must use physical device for Push Notifications');
      return null;
    }

    return token;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={20} color={FuchsiaColors.ink} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Notifications</ThemedText>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.iconContainer}>
          <View style={styles.iconWrapper}>
            <Bell size={40} color={FuchsiaColors.vibrant} />
          </View>
          <ThemedText style={styles.pageTitle}>Stay in the Loop</ThemedText>
          <ThemedText style={styles.pageSubtitle}>Manage how and when Fuchsia gets in touch with you.</ThemedText>
        </View>

        <View style={styles.settingsCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <View style={styles.settingIcon}>
                <CalendarClock size={20} color={FuchsiaColors.ink} />
              </View>
              <View style={styles.settingTextContainer}>
                <ThemedText style={styles.settingTitle}>Daily Outfit Reminders</ThemedText>
                <ThemedText style={styles.settingDescription}>Daily nudges to log your outfits and prep for tomorrow.</ThemedText>
              </View>
            </View>
            {isLoading ? (
              <Skeleton width={51} height={31} borderRadius={16} />
            ) : (
              <Switch
                trackColor={{ false: FuchsiaColors.mist, true: FuchsiaColors.vibrant }}
                thumbColor={'#fff'}
                ios_backgroundColor={FuchsiaColors.mist}
                onValueChange={() => toggleSwitch('dailyReminders')}
                value={toggles.dailyReminders}
              />
            )}
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <View style={styles.settingIcon}>
                <Camera size={20} color={FuchsiaColors.ink} />
              </View>
              <View style={styles.settingTextContainer}>
                <ThemedText style={styles.settingTitle}>Fit Pic Reminders</ThemedText>
                <ThemedText style={styles.settingDescription}>Reminders to snap a photo of your outfit today.</ThemedText>
              </View>
            </View>
            {isLoading ? (
              <Skeleton width={51} height={31} borderRadius={16} />
            ) : (
              <Switch
                trackColor={{ false: FuchsiaColors.mist, true: FuchsiaColors.vibrant }}
                thumbColor={'#fff'}
                ios_backgroundColor={FuchsiaColors.mist}
                onValueChange={() => toggleSwitch('fitPicReminders')}
                value={toggles.fitPicReminders}
              />
            )}
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <View style={styles.settingIcon}>
                <BarChart3 size={20} color={FuchsiaColors.ink} />
              </View>
              <View style={styles.settingTextContainer}>
                <ThemedText style={styles.settingTitle}>Weekly Style Stats</ThemedText>
                <ThemedText style={styles.settingDescription}>A weekly summary of your most worn outfits and items.</ThemedText>
              </View>
            </View>
            {isLoading ? (
              <Skeleton width={51} height={31} borderRadius={16} />
            ) : (
              <Switch
                trackColor={{ false: FuchsiaColors.mist, true: FuchsiaColors.vibrant }}
                thumbColor={'#fff'}
                ios_backgroundColor={FuchsiaColors.mist}
                onValueChange={() => toggleSwitch('weeklyStatsReminders')}
                value={toggles.weeklyStatsReminders}
              />
            )}
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
    shadowColor: FuchsiaColors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 18,
    fontWeight: '600',
    color: FuchsiaColors.ink,
  },
  headerRight: {
    width: 40,
  },
  content: {
    padding: 24,
    paddingBottom: 60,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 16,
  },
  iconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: FuchsiaColors.blush,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: FuchsiaColors.vibrant,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 4,
  },
  pageTitle: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 24,
    color: FuchsiaColors.ink,
    textAlign: 'center',
  },
  pageSubtitle: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 15,
    color: FuchsiaColors.slate,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  settingsCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    overflow: 'hidden',
    shadowColor: FuchsiaColors.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 24,
    elevation: 3,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  settingInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingRight: 16,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: FuchsiaColors.cloud,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingTextContainer: {
    flex: 1,
  },
  settingTitle: {
    fontFamily: FuchsiaFonts.bodySemiBold,
    fontSize: 16,
    color: FuchsiaColors.ink,
    marginBottom: 4,
  },
  settingDescription: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 13,
    color: FuchsiaColors.slate,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: FuchsiaColors.cloud,
    marginLeft: 76,
  },
});
