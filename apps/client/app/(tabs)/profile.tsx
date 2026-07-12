import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import * as SecureStore from 'expo-secure-store';
import { useState, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';
import { getMe, getClothingItems, getWardrobes, getOutfits } from '@/api/client';
import { ThemedText } from '@/components/themed-text';
import { FuchsiaColors, FuchsiaFonts } from '@/constants/theme';
import { User, BrainCircuit, ChevronRight, LogOut, HelpCircle } from 'lucide-react-native';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [userName, setUserName] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [stats, setStats] = useState({ items: 0, wardrobes: 0, outfits: 0 });

  useFocusEffect(
    useCallback(() => {
      const fetchStats = async () => {
        try {
          const [items, wardrobes, outfits] = await Promise.all([
            getClothingItems(),
            getWardrobes(),
            getOutfits(),
          ]);
          setStats({
            items: items.length,
            wardrobes: wardrobes.length,
            outfits: outfits.length,
          });
        } catch (error) {
          console.error('Error fetching stats:', error);
        }
      };

      const fetchUser = async () => {
        try {
          const data = await getMe();
          let nameToSet = data?.user?.display_name;
          let emailToSet = data?.user?.email;
          let photoToSet = null;

          const token = await SecureStore.getItemAsync('access_token');
          if (token) {
            try {
              const decoded: any = jwtDecode(token);
              if (!nameToSet) {
                nameToSet = decoded?.user_metadata?.full_name || decoded?.user_metadata?.name || decoded?.email?.split('@')[0] || '';
              }
              if (!emailToSet) {
                emailToSet = decoded?.email || '';
              }
              photoToSet = decoded?.user_metadata?.avatar_url || decoded?.user_metadata?.picture || null;
            } catch (e) {
              console.error('Failed to decode token:', e);
            }
          }
          
          setUserName(nameToSet || '');
          setUserEmail(emailToSet || '');
          setUserPhoto(photoToSet);
        } catch (error) {
          console.error('Error fetching user from API:', error);
        }
      };

      fetchUser();
      fetchStats();
    }, [])
  );

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');
    router.replace('/welcome');
  };

  return (
    <ScrollView 
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        {userPhoto ? (
          <Image source={{ uri: userPhoto }} style={styles.iconContainer} contentFit="cover" />
        ) : (
          <View style={styles.iconContainer}>
            <User size={32} color={FuchsiaColors.vibrant} />
          </View>
        )}
        <ThemedText style={styles.title}>{userName || 'My Profile'}</ThemedText>
        <ThemedText style={styles.subtitle}>
          {userEmail || 'Manage your account and preferences.'}
        </ThemedText>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <ThemedText style={styles.statValue}>{stats.outfits}</ThemedText>
          <ThemedText style={styles.statLabel}>Outfits</ThemedText>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <ThemedText style={styles.statValue}>{stats.wardrobes}</ThemedText>
          <ThemedText style={styles.statLabel}>Wardrobes</ThemedText>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <ThemedText style={styles.statValue}>{stats.items}</ThemedText>
          <ThemedText style={styles.statLabel}>Items</ThemedText>
        </View>
      </View>

      <View style={styles.settingsGroup}>
        <ThemedText style={styles.groupTitle}>AI Stylist</ThemedText>
        <TouchableOpacity 
          style={styles.settingsItem}
          onPress={() => router.push('/memory')}
        >
          <View style={styles.settingsItemLeft}>
            <View style={styles.itemIcon}>
              <BrainCircuit size={20} color={FuchsiaColors.slate} />
            </View>
            <ThemedText style={styles.settingsItemText}>Manage AI Memory</ThemedText>
          </View>
          <ChevronRight size={20} color={FuchsiaColors.slate} />
        </TouchableOpacity>
      </View>

      <View style={styles.settingsGroup}>
        <ThemedText style={styles.groupTitle}>Support</ThemedText>
        <TouchableOpacity 
          style={styles.settingsItem}
          onPress={() => router.push('/help')}
        >
          <View style={styles.settingsItemLeft}>
            <View style={styles.itemIcon}>
              <HelpCircle size={20} color={FuchsiaColors.slate} />
            </View>
            <ThemedText style={styles.settingsItemText}>Help Center & FAQ</ThemedText>
          </View>
          <ChevronRight size={20} color={FuchsiaColors.slate} />
        </TouchableOpacity>
      </View>

      <View style={styles.settingsGroup}>
        <ThemedText style={styles.groupTitle}>Account</ThemedText>
        <TouchableOpacity 
          style={styles.settingsItem}
          onPress={handleLogout}
        >
          <View style={styles.settingsItemLeft}>
            <View style={styles.itemIcon}>
              <LogOut size={20} color={FuchsiaColors.slate} />
            </View>
            <ThemedText style={styles.settingsItemText}>Log Out</ThemedText>
          </View>
          <ChevronRight size={20} color={FuchsiaColors.slate} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: FuchsiaColors.cloud,
  },
  content: {
    padding: 24,
    gap: 32,
    paddingBottom: 120, // Tab bar padding
  },
  header: {
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: FuchsiaColors.blush,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 24,
    color: FuchsiaColors.ink,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 15,
    color: FuchsiaColors.slate,
    textAlign: 'center',
    lineHeight: 22,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginVertical: 4,
  },
  statValue: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 20,
    color: FuchsiaColors.ink,
    marginBottom: 4,
  },
  statLabel: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 12,
    color: FuchsiaColors.slate,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingsGroup: {
    gap: 12,
  },
  groupTitle: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: FuchsiaColors.slate,
    marginLeft: 4,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  settingsItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: FuchsiaColors.cloud,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsItemText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 16,
    color: FuchsiaColors.ink,
  },
});
