import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Trash2, BrainCircuit } from 'lucide-react-native';
import { ThemedText } from '@/components/themed-text';
import { FuchsiaColors, FuchsiaFonts } from '@/constants/theme';
import { getMemories, deleteMemory, MemoryResponse } from '@/api/client';

export default function MemoryScreen() {
  const [memories, setMemories] = useState<MemoryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  useEffect(() => {
    fetchMemories();
  }, []);

  const fetchMemories = async () => {
    try {
      setLoading(true);
      const data = await getMemories();
      setMemories(data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load memories.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert(
      'Forget Memory',
      'Are you sure you want the AI to forget this?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Forget',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingId(id);
              await deleteMemory(id);
              setMemories(prev => prev.filter(m => m.id !== id));
            } catch (error) {
              Alert.alert('Error', 'Failed to delete memory.');
            } finally {
              setDeletingId(null);
            }
          }
        }
      ]
    );
  };

  const renderMemory = ({ item }: { item: MemoryResponse }) => (
    <View style={styles.memoryCard}>
      <View style={styles.memoryContent}>
        <ThemedText style={styles.memoryText}>{item.content}</ThemedText>
        {item.category && (
          <View style={styles.categoryBadge}>
            <ThemedText style={styles.categoryText}>{item.category}</ThemedText>
          </View>
        )}
      </View>
      <TouchableOpacity 
        style={styles.deleteBtn} 
        onPress={() => handleDelete(item.id)}
        disabled={deletingId === item.id}
      >
        {deletingId === item.id ? (
          <ActivityIndicator size="small" color="#EF4444" />
        ) : (
          <Trash2 size={20} color="#EF4444" />
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{
          headerShown: true,
          title: 'AI Memory',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: FuchsiaColors.cloud },
          headerTitleStyle: { fontFamily: FuchsiaFonts.heading, fontSize: 18 },
        }} 
      />
      
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={FuchsiaColors.deep} />
        </View>
      ) : memories.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <BrainCircuit size={40} color={FuchsiaColors.slate} />
          </View>
          <ThemedText style={styles.emptyTitle}>Nothing Remembered Yet</ThemedText>
          <ThemedText style={styles.emptyText}>
            As you chat with the stylist about your wardrobe, it will remember important details about you here.
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={memories}
          keyExtractor={(item) => item.id}
          renderItem={renderMemory}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: FuchsiaColors.cloud,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  memoryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  memoryContent: {
    flex: 1,
    gap: 8,
    paddingRight: 12,
  },
  memoryText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 16,
    color: FuchsiaColors.ink,
    lineHeight: 22,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: FuchsiaColors.blush,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 12,
    color: FuchsiaColors.deep,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  deleteBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    marginBottom: 8,
  },
  emptyTitle: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 20,
    color: FuchsiaColors.ink,
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 15,
    color: FuchsiaColors.slate,
    textAlign: 'center',
    lineHeight: 22,
  },
});
