import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, StyleSheet, Text, View, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { jwtDecode } from 'jwt-decode';

import { FuchsiaColors, FuchsiaFonts, FuchsiaGradient } from '@/constants/theme';
import { getMe, updateProfile } from '@/api/client';

// ── Types ───────────────────────────────────────────────────────────

type UserProfile = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
};

const INITIAL_PROFILE: UserProfile = {
  id: '',
  name: '',
  email: '',
  avatarUrl: null,
};

// ── Sub-components ──────────────────────────────────────────────────

function ProfileCard({ profile }: { profile: UserProfile }) {
  return (
    <LinearGradient
      colors={FuchsiaGradient}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={styles.profileCard}
    >
      <View style={styles.profileHeader}>
        {profile.avatarUrl ? (
          <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <MaterialIcons name="person" size={32} color="#A1A1AA" />
          </View>
        )}
        <View style={styles.profileInfo}>
          <Text style={styles.profileName} numberOfLines={1}>{profile.name || 'Signed in'}</Text>
          <Text style={styles.profileEmail} numberOfLines={1}>{profile.email}</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

function ActionItem({
  label,
  icon,
  destructive,
  onPress,
}: {
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  destructive?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.settingsItem,
        destructive && styles.actionItemDestructive,
        pressed && styles.settingsItemPressed,
      ]}
      onPress={onPress}
    >
      <Text style={[styles.actionItemLabel, destructive && styles.actionItemLabelDestructive]}>{label}</Text>
      <MaterialIcons name={icon} size={16} color={destructive ? '#EF4444' : '#71717A'} />
    </Pressable>
  );
}

// ── Screen ──────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const [profile, setProfile] = useState<UserProfile>(INITIAL_PROFILE);
  const [displayName, setDisplayName] = useState<string>('');
  const router = useRouter();

  useEffect(() => {
    async function loadProfile() {
      try {
        const token = await SecureStore.getItemAsync('access_token');
        if (token) {
          const decoded = jwtDecode<any>(token);
          setProfile((prev) => ({
            ...prev,
            id: decoded.sub || prev.id,
            name: decoded.user_metadata?.full_name || decoded.user_metadata?.name || prev.name,
            email: decoded.email || decoded.user_metadata?.email || prev.email,
            avatarUrl: decoded.user_metadata?.avatar_url || decoded.user_metadata?.picture || prev.avatarUrl,
          }));
        }

        const me = await getMe();
        if (me.user.display_name) {
          setDisplayName(me.user.display_name);
        } else if (token) {
          const decoded = jwtDecode<any>(token);
          setDisplayName(decoded.user_metadata?.full_name || decoded.user_metadata?.name || '');
        }
      } catch (e) {
        console.error('Failed to load profile', e);
      }
    }
    loadProfile();
  }, []);

  const handleSignOut = async () => {
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');
    router.replace('/welcome');
  };

  const handleSaveDisplayName = async () => {
    try {
      await updateProfile({ display_name: displayName });
    } catch (err) {
      console.error('Failed to update profile', err);
    }
  };

  const effectiveName = displayName || profile.name;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ProfileCard profile={{ ...profile, name: effectiveName }} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.settingsGroup}>
            <View style={styles.inputItem}>
              <Text style={styles.inputItemLabel}>Display Name</Text>
              <TextInput
                style={styles.inputItemField}
                value={displayName}
                onChangeText={setDisplayName}
                onBlur={handleSaveDisplayName}
                placeholder="Enter display name"
                placeholderTextColor="#A1A1AA"
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.settingsGroup}>
            <ActionItem label="Sign out" icon="logout" destructive onPress={handleSignOut} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FuchsiaColors.paper },
  scroll: { padding: 20, gap: 24, paddingBottom: 32 },

  // Profile Card
  profileCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272a',
    padding: 20,
    justifyContent: 'center',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  avatarPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
    minWidth: 0,
  },
  profileName: {
    fontFamily: FuchsiaFonts.bodySemiBold,
    fontSize: 15,
    color: '#fff',
  },
  profileEmail: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 12,
    color: '#D4D4D8',
  },

  // Sections
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 16,
    color: FuchsiaColors.ink,
  },
  settingsGroup: {
    gap: 0,
  },

  // List Items
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: FuchsiaColors.mist,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
  },
  settingsItemPressed: {
    opacity: 0.7,
  },

  // Action Items
  actionItemLabel: {
    fontFamily: FuchsiaFonts.bodySemiBold,
    fontSize: 14,
    color: '#3F3F46',
  },
  actionItemDestructive: {
    borderColor: '#FECACA',
  },
  actionItemLabelDestructive: {
    color: '#DC2626',
  },

  // Custom Input Item
  inputItem: {
    flexDirection: 'column',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: FuchsiaColors.mist,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    gap: 8,
  },
  inputItemLabel: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 14,
    color: '#52525B',
  },
  inputItemField: {
    fontFamily: FuchsiaFonts.bodySemiBold,
    fontSize: 15,
    color: FuchsiaColors.ink,
    padding: 0,
  },
});
