import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FuchsiaColors, FuchsiaFonts } from '@/constants/theme';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + 24 }]}>
      <View style={styles.content}>
        <ThemedText style={styles.title}>Home</ThemedText>
        <ThemedText style={styles.subtitle}>
          This is a blank starter screen. Build your app here.
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: 8,
  },
  title: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 28,
    color: FuchsiaColors.ink,
  },
  subtitle: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 15,
    color: FuchsiaColors.fog,
  },
});
