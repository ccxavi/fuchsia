import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Shield, Database, BrainCircuit, MapPin, Scale, Lock, ShieldCheck, UserCheck } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { FuchsiaColors, FuchsiaFonts } from '@/constants/theme';

export default function LegalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={20} color={FuchsiaColors.ink} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Privacy & Terms</ThemedText>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.iconContainer}>
          <View style={styles.iconWrapper}>
            <Shield size={40} color={FuchsiaColors.vibrant} />
          </View>
          <ThemedText style={styles.pageTitle}>Legal Information</ThemedText>
          <ThemedText style={styles.pageSubtitle}>Everything you need to know about how we protect your data and privacy.</ThemedText>
        </View>

        <View style={styles.documentCard}>
          <View style={styles.cardHeader}>
            <ThemedText style={styles.docTitle}>Privacy Policy</ThemedText>
            <View style={styles.dateBadge}>
              <ThemedText style={styles.lastUpdated}>Updated July 2026</ThemedText>
            </View>
          </View>
          
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <Database size={16} color={FuchsiaColors.vibrant} />
              </View>
              <ThemedText style={styles.sectionTitle}>Data Collection</ThemedText>
            </View>
            <ThemedText style={styles.paragraph}>
              Fuchsia respects your privacy. We only collect data necessary to provide and improve our services. This includes the clothing items, photos, and outfits you upload to your digital closet.
            </ThemedText>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <ShieldCheck size={16} color={FuchsiaColors.vibrant} />
              </View>
              <ThemedText style={styles.sectionTitle}>How We Use Your Data</ThemedText>
            </View>
            <ThemedText style={styles.paragraph}>
              Your closet data is used exclusively to power your personal AI Stylist, generate outfit recommendations, and sync your wardrobe across devices. We do not sell your personal data or photos to third parties.
            </ThemedText>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <BrainCircuit size={16} color={FuchsiaColors.vibrant} />
              </View>
              <ThemedText style={styles.sectionTitle}>AI Memory & Privacy</ThemedText>
            </View>
            <ThemedText style={styles.paragraph}>
              Conversations with the AI Stylist are processed to learn your style preferences. You maintain full control over these learned preferences and can delete your AI Memory at any time from your Profile settings.
            </ThemedText>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <MapPin size={16} color={FuchsiaColors.vibrant} />
              </View>
              <ThemedText style={styles.sectionTitle}>Location Services</ThemedText>
            </View>
            <ThemedText style={styles.paragraph}>
              If you enable location services, we use your device's coarse location solely to fetch local weather data for daily outfit insights. This location data is not permanently stored or tracked.
            </ThemedText>
          </View>
        </View>

        <View style={styles.documentCard}>
          <View style={styles.cardHeader}>
            <ThemedText style={styles.docTitle}>Terms of Service</ThemedText>
            <View style={styles.dateBadge}>
              <ThemedText style={styles.lastUpdated}>Updated July 2026</ThemedText>
            </View>
          </View>
          
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <Scale size={16} color={FuchsiaColors.vibrant} />
              </View>
              <ThemedText style={styles.sectionTitle}>Acceptance of Terms</ThemedText>
            </View>
            <ThemedText style={styles.paragraph}>
              By creating an account and using Fuchsia, you agree to abide by these Terms of Service. If you do not agree, please do not use the app.
            </ThemedText>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <UserCheck size={16} color={FuchsiaColors.vibrant} />
              </View>
              <ThemedText style={styles.sectionTitle}>User Content</ThemedText>
            </View>
            <ThemedText style={styles.paragraph}>
              You retain ownership of all photos and data you upload. You grant us a license to securely host and process this content in order to provide the app's core functionalities.
            </ThemedText>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <Lock size={16} color={FuchsiaColors.vibrant} />
              </View>
              <ThemedText style={styles.sectionTitle}>Account Security</ThemedText>
            </View>
            <ThemedText style={styles.paragraph}>
              Fuchsia uses Google OAuth for secure sign-in, meaning we never store or see your passwords. You are responsible for safeguarding your Google account to ensure your closet remains secure.
            </ThemedText>
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
  documentCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    padding: 24,
    marginBottom: 24,
    shadowColor: FuchsiaColors.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 24,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: FuchsiaColors.cloud,
    paddingBottom: 16,
  },
  docTitle: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 20,
    color: FuchsiaColors.ink,
  },
  dateBadge: {
    backgroundColor: FuchsiaColors.cloud,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
  },
  lastUpdated: {
    fontFamily: FuchsiaFonts.bodySemiBold,
    fontSize: 11,
    color: FuchsiaColors.slate,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: FuchsiaColors.blush,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontFamily: FuchsiaFonts.bodySemiBold,
    fontSize: 16,
    color: FuchsiaColors.ink,
  },
  paragraph: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 14,
    color: FuchsiaColors.slate,
    lineHeight: 24,
    paddingLeft: 44, // Align with text next to icon
  },
});
