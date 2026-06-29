import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import {
  DMMono_500Medium,
  useFonts as useDMMonoFonts,
} from '@expo-google-fonts/dm-mono';
import {
  PlayfairDisplay_600SemiBold_Italic,
  useFonts as usePlayfairDisplayFonts,
} from '@expo-google-fonts/playfair-display';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts as useInterFonts,
} from '@expo-google-fonts/inter';
import {
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  useFonts as useOutfitFonts,
} from '@expo-google-fonts/outfit';

import { useColorScheme } from '@/hooks/use-color-scheme';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const [dmMonoLoaded] = useDMMonoFonts({ DMMono_500Medium });

  const [playfairLoaded] = usePlayfairDisplayFonts({ PlayfairDisplay_600SemiBold_Italic });
  const [interLoaded] = useInterFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [outfitLoaded] = useOutfitFonts({
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });

  const fontsReady = dmMonoLoaded && playfairLoaded && interLoaded && outfitLoaded;

  useEffect(() => {
    if (fontsReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsReady]);

  if (!fontsReady) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
