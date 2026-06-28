import { View, StyleSheet, Pressable } from 'react-native';
import { Tabs } from 'expo-router';
import React from 'react';
import { Svg, Path } from 'react-native-svg';
import { Home, CalendarDays, Sparkles, Shirt, User } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FuchsiaColors } from '@/constants/theme';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: FuchsiaColors.deep,
        tabBarInactiveTintColor: FuchsiaColors.slate,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: FuchsiaColors.mist,
          borderTopWidth: 1,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 12),
          height: 52 + Math.max(insets.bottom, 12),
          position: 'absolute',
          elevation: 0,
        },
        tabBarBackground: () => (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#fff' }]}>
            <View style={styles.arcContainer}>
              <Svg viewBox="0 0 80 24" preserveAspectRatio="none" style={styles.arcSvg}>
                <Path d="M0 24C0 24 16 0 40 0C64 0 80 24 80 24H0Z" fill="#fff" />
              </Svg>
            </View>
            <View style={styles.arcBorderCover} />
          </View>
        ),
        tabBarLabelStyle: {
          fontFamily: 'Inter_600SemiBold',
          fontSize: 11,
          marginTop: 2,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Home size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color }) => <CalendarDays size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: '',
          tabBarIcon: () => null,
          tabBarLabel: () => null,
          tabBarButton: ({ ref, ...props }: any) => (
            <Pressable
              {...props}
              style={[props.style, styles.chatButtonContainer]}
              android_ripple={{ color: 'transparent' }}
            >
              <LinearGradient
                colors={['#86003C', '#B5004D', '#D4145A']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.chatButton}
              >
                <Sparkles size={24} color="#fff" />
              </LinearGradient>
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen
        name="closet"
        options={{
          title: 'Closet',
          tabBarIcon: ({ color }) => <Shirt size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <User size={20} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  arcContainer: {
    position: 'absolute',
    top: -12,
    left: '50%',
    marginLeft: -40,
    width: 80,
    height: 24,
    shadowColor: FuchsiaColors.slate,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  arcSvg: {
    width: '100%',
    height: '100%',
  },
  arcBorderCover: {
    position: 'absolute',
    top: 0,
    left: '50%',
    marginLeft: -40,
    width: 80,
    height: 2,
    backgroundColor: '#fff',
  },
  chatButtonContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatButton: {
    position: 'absolute',
    top: -16,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: FuchsiaColors.vibrant,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
});
