import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { ThemedText } from '@/components/themed-text';
import { FuchsiaColors, FuchsiaFonts } from '@/constants/theme';
import { User, BrainCircuit, ChevronRight, LogOut } from 'lucide-react-native';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

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
        <View style={styles.iconContainer}>
          <User size={32} color={FuchsiaColors.vibrant} />
        </View>
        <ThemedText style={styles.title}>My Profile</ThemedText>
        <ThemedText style={styles.subtitle}>
          Manage your account and preferences.
        </ThemedText>
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
