import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform, DeviceEventEmitter } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Trash, BrainCircuit, ArrowLeft, MoreHorizontal, PencilLine, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemedText } from '@/components/themed-text';
import { FuchsiaColors, FuchsiaFonts } from '@/constants/theme';
import { getMemories, deleteMemory, updateMemory, MemoryResponse } from '@/api/client';
import { MemoryScreenSkeleton } from '@/components/ui/Skeleton';

export default function MemoryScreen() {
  const [memories, setMemories] = useState<MemoryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Edit State
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Action Menu State
  const [actionMenuMemory, setActionMenuMemory] = useState<MemoryResponse | null>(null);

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
      DeviceEventEmitter.emit('showGlobalAlert', {
        title: 'Error',
        message: 'Failed to load memories.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    DeviceEventEmitter.emit('showGlobalAlert', {
      title: 'Forgetting...',
      message: 'Please wait while we delete this memory.',
      isLoading: true,
    });
    try {
      setDeletingId(id);
      await deleteMemory(id);
      setMemories(prev => prev.filter(m => m.id !== id));
      DeviceEventEmitter.emit('hideGlobalAlert');
      DeviceEventEmitter.emit('showGlobalToast', 'Memory forgotten successfully');
    } catch (error) {
      DeviceEventEmitter.emit('hideGlobalAlert');
      DeviceEventEmitter.emit('showGlobalAlert', {
        title: 'Error',
        message: 'Failed to delete memory. Please try again.',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleEditPress = (item: MemoryResponse) => {
    setActionMenuMemory(null); // close action menu
    setEditContent(item.content);
    setEditingMemoryId(item.id);
  };

  const handleForgetPress = (item: MemoryResponse) => {
    setActionMenuMemory(null); // close action menu
    DeviceEventEmitter.emit('showGlobalAlert', {
      title: 'Forget this memory?',
      message: 'Are you sure you want the AI to forget this?',
      confirmText: 'Forget',
      cancelText: 'Keep it',
      isDestructive: true,
      onConfirm: () => handleDelete(item.id),
    });
  };

  const closeEditModal = () => {
    setEditingMemoryId(null);
    setEditContent('');
  };

  const handleSaveEdit = async () => {
    if (!editingMemoryId) return;
    if (!editContent.trim()) {
      DeviceEventEmitter.emit('showGlobalAlert', {
        title: 'Error',
        message: 'Memory content cannot be empty.',
      });
      return;
    }
    
    try {
      setSavingEdit(true);
      const updatedMemory = await updateMemory(editingMemoryId, { content: editContent.trim() });
      setMemories(prev => prev.map(m => m.id === editingMemoryId ? updatedMemory : m));
      DeviceEventEmitter.emit('showGlobalToast', 'Memory updated successfully');
      closeEditModal();
    } catch (error) {
      DeviceEventEmitter.emit('showGlobalAlert', {
        title: 'Error',
        message: 'Failed to update memory.',
      });
    } finally {
      setSavingEdit(false);
    }
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
        style={styles.moreBtn} 
        onPress={() => setActionMenuMemory(item)}
        disabled={deletingId === item.id}
      >
        {deletingId === item.id ? (
          <ActivityIndicator size="small" color="#EF4444" />
        ) : (
          <MoreHorizontal size={20} color={FuchsiaColors.slate} />
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={20} color={FuchsiaColors.slate} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>AI Memory</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={{ flex: 1 }}>
          <MemoryScreenSkeleton />
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

      {/* Edit Modal */}
      <Modal
        visible={!!editingMemoryId}
        transparent
        animationType="fade"
        onRequestClose={closeEditModal}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior="position" keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}>
            <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Edit Memory</ThemedText>
              <TouchableOpacity onPress={closeEditModal} style={styles.modalCloseBtn}>
                <X size={20} color={FuchsiaColors.slate} />
              </TouchableOpacity>
            </View>
            
            <ThemedText style={styles.modalSubtitle}>
              Update what the AI should remember about this specific detail.
            </ThemedText>
            
            <TextInput
              style={styles.modalInput}
              value={editContent}
              onChangeText={setEditContent}
              multiline
              autoFocus
              maxLength={500}
              placeholder="What should the AI remember?"
              placeholderTextColor={FuchsiaColors.slate}
            />

            <TouchableOpacity 
              onPress={handleSaveEdit}
              disabled={savingEdit}
              style={{ width: '100%' }}
            >
              <LinearGradient
                colors={['#86003C', '#B5004D', '#D4145A']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.modalSaveBtn}
              >
                {savingEdit ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <ThemedText style={styles.modalSaveText}>Save Changes</ThemedText>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Action Menu Bottom Sheet */}
      <Modal
        visible={!!actionMenuMemory}
        transparent
        animationType="fade"
        onRequestClose={() => setActionMenuMemory(null)}
      >
        <TouchableOpacity 
          style={styles.actionMenuOverlay} 
          activeOpacity={1} 
          onPress={() => setActionMenuMemory(null)}
        >
          <View style={[styles.actionMenuContent, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.actionMenuHandle} />
            <ThemedText style={styles.actionMenuTitle}>Manage Memory</ThemedText>
            
            <TouchableOpacity 
              style={styles.actionMenuOption} 
              onPress={() => actionMenuMemory && handleEditPress(actionMenuMemory)}
            >
              <View style={styles.actionMenuIconWrapper}>
                <PencilLine size={20} color={FuchsiaColors.ink} />
              </View>
              <ThemedText style={styles.actionMenuOptionText}>Edit Memory</ThemedText>
            </TouchableOpacity>

            <View style={styles.actionMenuDivider} />

            <TouchableOpacity 
              style={styles.actionMenuOption} 
              onPress={() => actionMenuMemory && handleForgetPress(actionMenuMemory)}
            >
              <View style={[styles.actionMenuIconWrapper, { backgroundColor: '#FEF2F2' }]}>
                <Trash size={20} color="#EF4444" />
              </View>
              <ThemedText style={[styles.actionMenuOptionText, { color: '#EF4444' }]}>Forget Memory</ThemedText>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
  headerTitle: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 18,
    fontWeight: '500',
    color: FuchsiaColors.ink,
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
  moreBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: FuchsiaColors.cloud,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalTitle: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 20,
    fontWeight: '600',
    color: FuchsiaColors.ink,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FuchsiaColors.mist,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubtitle: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 14,
    color: FuchsiaColors.slate,
    marginBottom: 20,
    lineHeight: 20,
  },
  modalInput: {
    backgroundColor: FuchsiaColors.cloud,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: FuchsiaColors.mist,
    padding: 16,
    height: 160,
    fontFamily: FuchsiaFonts.body,
    fontSize: 16,
    color: FuchsiaColors.ink,
    textAlignVertical: 'top',
    marginBottom: 24,
  },
  modalSaveBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  modalSaveText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  actionMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  actionMenuContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  actionMenuHandle: {
    width: 48,
    height: 5,
    backgroundColor: FuchsiaColors.mist,
    borderRadius: 2.5,
    alignSelf: 'center',
    marginBottom: 24,
  },
  actionMenuTitle: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 20,
    fontWeight: '600',
    color: FuchsiaColors.ink,
    marginBottom: 8,
    textAlign: 'center',
  },
  actionMenuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 16,
  },
  actionMenuIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: FuchsiaColors.cloud,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionMenuOptionText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 16,
    fontWeight: '500',
    color: FuchsiaColors.ink,
  },
  actionMenuDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.04)',
    marginVertical: 4,
  },
});
