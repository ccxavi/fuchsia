import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Svg, Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import { makeRedirectUri } from 'expo-auth-session';
import { useState } from 'react';



WebBrowser.maybeCompleteAuthSession();

function GoogleIcon() {
  return (
    <View style={styles.googleIconWrapper}>
      <Svg viewBox="0 0 24 24" width={20} height={20} fill="none">
        <Path d="M21.6 12.23c0-.77-.07-1.5-.2-2.2H12v4.16h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.9-1.74 2.98-4.31 2.98-7.48Z" fill="#4285F4" />
        <Path d="M12 22c2.7 0 4.96-.9 6.62-2.45l-3.24-2.5c-.9.6-2.05.95-3.38.95-2.6 0-4.8-1.76-5.58-4.12H3.07v2.58A10 10 0 0 0 12 22Z" fill="#34A853" />
        <Path d="M6.42 13.88A6 6 0 0 1 6.1 12c0-.65.12-1.27.32-1.88V7.54H3.07A10 10 0 0 0 2 12c0 1.62.39 3.15 1.07 4.46l3.35-2.58Z" fill="#FBBC05" />
        <Path d="M12 5.95c1.47 0 2.78.5 3.81 1.49l2.86-2.86C16.95 3 14.69 2 12 2A10 10 0 0 0 3.07 7.54l3.35 2.58C7.2 7.7 9.4 5.95 12 5.95Z" fill="#EA4335" />
      </Svg>
    </View>
  );
}



export default function WelcomeScreen() {
  const router = useRouter();

  const handleGoogleSignIn = async () => {
    try {
      const redirectUrl = makeRedirectUri();
      console.log("Redirecting back to:", redirectUrl);
      
      const authUrl = `https://fuchsia-api.giann.dev/api/v1/auth/google?redirect_to=${encodeURIComponent(redirectUrl)}`;

      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);

      if (result.type === 'success' && result.url) {
        const hash = result.url.split('#')[1];
        if (hash) {
          const params = hash.split('&').reduce((acc, current) => {
            const [key, value] = current.split('=');
            acc[key] = value;
            return acc;
          }, {} as Record<string, string>);
          
          const accessToken = params['access_token'];
          const refreshToken = params['refresh_token'];

          if (accessToken) {
            await SecureStore.setItemAsync('access_token', accessToken);
            if (refreshToken) {
              await SecureStore.setItemAsync('refresh_token', refreshToken);
            }
            
            router.replace('/(tabs)');
          }
        }
      }
    } catch (error) {
      console.error('Auth error:', error);
    }
  };



  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <LinearGradient
        colors={['#D4145A', '#86003C']}
        style={styles.topHalf}
      >
        <SafeAreaView edges={['top']} style={styles.safeAreaTop} />

      </LinearGradient>

      {/* Bottom Half */}
      <View style={styles.bottomHalf}>
        <Text style={styles.logoText}>fuchsia</Text>
        
        <Text style={styles.headline}>
          Get started on your{'\n'}fashion journey
        </Text>
        
        <Text style={styles.description}>
          Upload your wardrobe and create good looking outfits everyday
        </Text>
        
        <Pressable
          style={({ pressed }) => [styles.googleButton, pressed && styles.googleButtonPressed]}
          onPress={handleGoogleSignIn}
        >
          <GoogleIcon />
          <Text style={styles.googleButtonText}>Sign in with Google</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#86003C',
  },
  topHalf: {
    flex: 1,
    paddingBottom: 24,
  },
  safeAreaTop: {
    flex: 0,
  },

  bottomHalf: {
    backgroundColor: '#FDF2F8',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: 32,
    paddingTop: 48,
    paddingBottom: 56,
    alignItems: 'center',
    shadowColor: '#86003C',
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.2,
    shadowRadius: 40,
    elevation: 20,
  },
  logoText: {
    fontFamily: 'PlayfairDisplay_600SemiBold_Italic',
    fontSize: 52,
    color: '#D4145A',
    lineHeight: 52,
    marginBottom: 24,
    letterSpacing: -1,
  },
  headline: {
    fontFamily: 'Inter_700Bold',
    fontSize: 26,
    color: '#86003C',
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: 20,
  },
  description: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: '#4A4A68',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 260,
    marginBottom: 32,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    height: 56,
    width: '100%',
    maxWidth: 300,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E5EF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  googleButtonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  googleIconWrapper: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleButtonText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#1A1A2E',
  },
});
