import { View, StyleSheet, Pressable, TouchableWithoutFeedback, Text } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { Svg, Path } from 'react-native-svg';
import { Home, CalendarDays, Plus, Shirt, User, Layers, Briefcase, Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming,
  interpolate
} from 'react-native-reanimated';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FuchsiaColors } from '@/constants/theme';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const [menuVisible, setMenuVisible] = useState(false);
  const router = useRouter();
  
  const menuProgress = useSharedValue(0);

  useEffect(() => {
    menuProgress.value = withTiming(menuVisible ? 1 : 0, {
      duration: 200,
    });
  }, [menuVisible]);

  const iconAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { rotate: `${menuProgress.value * 45}deg` }
      ],
    };
  });

  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: menuProgress.value,
  }));

  const menuSheetAnimatedStyle = useAnimatedStyle(() => ({
    opacity: menuProgress.value,
    transform: [
      { translateY: interpolate(menuProgress.value, [0, 1], [15, 0]) }
    ],
  }));

  return (
    <View style={{ flex: 1 }}>
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
            paddingBottom: Math.max(insets.bottom, 24),
            height: 64 + Math.max(insets.bottom, 24),
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
          name="closet"
          options={{
            title: 'Closet',
            tabBarIcon: ({ color }) => <Shirt size={20} color={color} />,
          }}
        />
        <Tabs.Screen
          name="chat"
          options={{
            title: '',
            tabBarIcon: () => null,
            tabBarLabel: () => null,
            tabBarButton: () => <View style={styles.chatButtonContainer} />
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
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color }) => <User size={20} color={color} />,
          }}
        />
      </Tabs>

      <Animated.View 
        pointerEvents={menuVisible ? 'auto' : 'none'}
        style={[StyleSheet.absoluteFill, { zIndex: 50 }, overlayAnimatedStyle]}
      >
        <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <Animated.View 
                style={[styles.menuSheet, { bottom: Math.max(insets.bottom, 24) + 80 }, menuSheetAnimatedStyle]}
              >
                  <Pressable
                    style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                    onPress={() => {
                      setMenuVisible(false);
                      router.push('/add-item');
                    }}
                  >
                    <Shirt size={20} color={FuchsiaColors.slate} />
                    <Text style={styles.menuItemText}>Add item</Text>
                  </Pressable>
                  
                  <Pressable
                    style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                    onPress={() => {
                      setMenuVisible(false);
                      router.push('/add-outfit');
                    }}
                  >
                    <Layers size={20} color={FuchsiaColors.slate} />
                    <Text style={styles.menuItemText}>Add outfit</Text>
                  </Pressable>
                  
                  <Pressable
                    style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                    onPress={() => {
                      setMenuVisible(false);
                      router.push('/add-wardrobe');
                    }}
                  >
                    <Briefcase size={20} color={FuchsiaColors.slate} />
                    <Text style={styles.menuItemText}>Add wardrobe</Text>
                  </Pressable>
                  
                  <Pressable
                    style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                    onPress={() => {
                      setMenuVisible(false);
                      router.push('/(tabs)/chat');
                    }}
                  >
                    <Sparkles size={20} color={FuchsiaColors.slate} />
                    <Text style={styles.menuItemText}>Chat with AI</Text>
                  </Pressable>
                </Animated.View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Animated.View>

      <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: 100, alignItems: 'center', justifyContent: 'flex-end' }]}>
        <Pressable
          onPress={() => setMenuVisible(!menuVisible)}
          style={[styles.chatButton, { bottom: Math.max(insets.bottom, 24) + 16 }]}
        >
          <LinearGradient
            colors={['#86003C', '#B5004D', '#D4145A']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.chatButtonInner}
          >
            <Animated.View style={iconAnimatedStyle}>
              <Plus size={24} color="#fff" />
            </Animated.View>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
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
  chatButtonInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  menuSheet: {
    width: 240,
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 8,
    borderWidth: 1,
    borderColor: FuchsiaColors.mist,
    shadowColor: FuchsiaColors.ink,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 40,
    elevation: 10,
    position: 'absolute',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
  },
  menuItemPressed: {
    backgroundColor: FuchsiaColors.cloud,
  },
  menuItemText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: FuchsiaColors.ink,
  },
});
