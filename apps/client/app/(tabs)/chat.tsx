import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Image, Animated, Keyboard } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { ThemedText } from '@/components/themed-text';
import { MarkdownText } from '@/components/ui/MarkdownText';
import { FuchsiaColors, FuchsiaFonts } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ImageIcon, X, Sparkles, Calendar } from 'lucide-react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ChatMessage, postChat, ContentPart, ingestMemories, getClothingItems, ClothingItemResponse, OutfitSuggestion, createOutfit, CalendarSuggestion, createCalendarOutfit, getOutfits, OutfitWithItemsResponse } from '@/api/client';
function TypingIndicator() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animateDot = (anim: Animated.Value) => {
      return Animated.sequence([
        Animated.timing(anim, { toValue: -4, duration: 250, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]);
    };

    Animated.loop(
      Animated.stagger(150, [
        animateDot(dot1),
        animateDot(dot2),
        animateDot(dot3),
      ])
    ).start();
  }, []);

  const dotStyle = { width: 6, height: 6, borderRadius: 3, backgroundColor: FuchsiaColors.deep, marginHorizontal: 2 };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: 20 }}>
      <Animated.View style={[dotStyle, { transform: [{ translateY: dot1 }] }]} />
      <Animated.View style={[dotStyle, { transform: [{ translateY: dot2 }] }]} />
      <Animated.View style={[dotStyle, { transform: [{ translateY: dot3 }] }]} />
    </View>
  );
}

function HeroCard() {
  return (
    <LinearGradient
      colors={['#86003C', '#B5004D', '#D4145A']}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={styles.heroCard}
    >
      <ThemedText style={styles.heroLabel}>AI Fashion Assistant</ThemedText>
      <ThemedText style={styles.heroTitle}>Tell me about your wardrobe or ask for styling tips</ThemedText>
      <ThemedText style={styles.heroBody}>
        I can analyze your outfits, suggest pairings for different occasions, and even check local weather for recommendations.
      </ThemedText>
    </LinearGradient>
  );
}

function OutfitSuggestionCard({ suggestion, closetItems, onSuggestAnother }: { suggestion: OutfitSuggestion, closetItems: Record<string, ClothingItemResponse>, onSuggestAnother?: () => void }) {
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isIgnored, setIsIgnored] = useState(false);

  const handleSave = async () => {
    if (isSaving || isSaved) return;
    setIsSaving(true);
    try {
      await createOutfit({
        name: suggestion.name,
        clothing_item_ids: suggestion.clothing_item_ids,
        wardrobe_ids: suggestion.wardrobe_ids,
      });
      setIsSaved(true);
    } catch (err) {
      console.error("Failed to save outfit:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const images = suggestion.clothing_item_ids
    .map(id => closetItems[id]?.image_url)
    .filter((url): url is string => !!url);

  return (
    <View style={styles.outfitCard}>
      <View style={styles.outfitCardHeader}>
        <Sparkles size={16} color={FuchsiaColors.deep} />
        <ThemedText style={styles.outfitCardTitle}>{suggestion.name}</ThemedText>
      </View>
      
      {images.length > 0 && (
        <View style={styles.outfitCardImages}>
          {images.map((url, idx) => (
            <Image key={idx} source={{ uri: url }} style={styles.outfitCardImage} />
          ))}
        </View>
      )}

      {suggestion.rationale && (
        <ThemedText style={styles.outfitCardRationale}>{suggestion.rationale}</ThemedText>
      )}

      {isIgnored ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={[styles.outfitCardBtnSecondary, { flex: 1, borderColor: FuchsiaColors.slate, opacity: 0.6 }]}>
            <ThemedText style={[styles.outfitCardBtnTextSecondary, { color: FuchsiaColors.slate }]}>
              Dismissed
            </ThemedText>
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {onSuggestAnother && !isSaved && (
            <TouchableOpacity 
              style={[styles.outfitCardBtnSecondary, { flex: 1 }]} 
              onPress={() => {
                setIsIgnored(true);
                onSuggestAnother();
              }}
              disabled={isSaving}
            >
              <ThemedText style={styles.outfitCardBtnTextSecondary}>
                Suggest Another
              </ThemedText>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={[styles.outfitCardBtn, isSaved && styles.outfitCardBtnSaved, { flex: 1 }]} 
            onPress={handleSave}
            disabled={isSaving || isSaved}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <ThemedText style={styles.outfitCardBtnText}>
                {isSaved ? "Saved to Closet!" : "Save to Closet"}
              </ThemedText>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function CalendarSuggestionCard({ suggestion, savedOutfits, onDismiss }: { suggestion: CalendarSuggestion, savedOutfits: Record<string, OutfitWithItemsResponse>, onDismiss?: () => void }) {
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isIgnored, setIsIgnored] = useState(false);

  const outfit = savedOutfits[suggestion.outfit_id];

  const handleSave = async () => {
    if (isSaving || isSaved) return;
    setIsSaving(true);
    try {
      await createCalendarOutfit({
        outfit_id: suggestion.outfit_id,
        date: suggestion.date,
        notes: suggestion.notes,
      });
      setIsSaved(true);
    } catch (err) {
      console.error("Failed to save calendar entry:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const images = outfit?.clothing_items
    .map(i => i.image_url)
    .filter((url): url is string => !!url) || [];

  return (
    <View style={styles.outfitCard}>
      <View style={styles.outfitCardHeader}>
        <Calendar size={16} color={FuchsiaColors.deep} />
        <ThemedText style={styles.outfitCardTitle}>
          Schedule for {suggestion.date}
        </ThemedText>
      </View>
      
      {outfit && (
        <ThemedText style={{ fontFamily: FuchsiaFonts.heading, fontSize: 14, color: FuchsiaColors.ink, marginBottom: 8 }}>
          {outfit.name}
        </ThemedText>
      )}

      {images.length > 0 && (
        <View style={styles.outfitCardImages}>
          {images.map((url, idx) => (
            <Image key={idx} source={{ uri: url }} style={styles.outfitCardImage} />
          ))}
        </View>
      )}

      {isIgnored ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={[styles.outfitCardBtnSecondary, { flex: 1, borderColor: FuchsiaColors.slate, opacity: 0.6 }]}>
            <ThemedText style={[styles.outfitCardBtnTextSecondary, { color: FuchsiaColors.slate }]}>
              Dismissed
            </ThemedText>
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {onDismiss && !isSaved && (
            <TouchableOpacity 
              style={[styles.outfitCardBtnSecondary, { flex: 1 }]} 
              onPress={() => {
                setIsIgnored(true);
                onDismiss();
              }}
              disabled={isSaving}
            >
              <ThemedText style={styles.outfitCardBtnTextSecondary}>
                Dismiss
              </ThemedText>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={[styles.outfitCardBtn, isSaved && styles.outfitCardBtnSaved, { flex: 1 }]} 
            onPress={handleSave}
            disabled={isSaving || isSaved}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <ThemedText style={styles.outfitCardBtnText}>
                {isSaved ? "Scheduled!" : "Add to Calendar"}
              </ThemedText>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [closetItems, setClosetItems] = useState<Record<string, ClothingItemResponse>>({});
  const [savedOutfits, setSavedOutfits] = useState<Record<string, OutfitWithItemsResponse>>({});

  useEffect(() => {
    getClothingItems().then((items) => {
      const map: Record<string, ClothingItemResponse> = {};
      items.forEach(i => map[i.id] = i);
      setClosetItems(map);
    }).catch(err => console.error("Failed to load closet items:", err));
    
    getOutfits().then((items) => {
      const map: Record<string, OutfitWithItemsResponse> = {};
      items.forEach(i => map[i.id] = i);
      setSavedOutfits(map);
    }).catch(err => console.error("Failed to load saved outfits:", err));
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardVisible(true);
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const androidBottomPadding = Platform.OS === 'android' && keyboardHeight > 0 
    ? keyboardHeight + insets.bottom 
    : 0;

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      let loc = await Location.getLastKnownPositionAsync({});
      if (!loc) {
        loc = await Location.getCurrentPositionAsync({});
      }
      setLocation(loc);
    })();
  }, []);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setImageBase64(`data:${result.assets[0].mimeType || 'image/jpeg'};base64,${result.assets[0].base64}`);
    }
  };

  const removeImage = () => {
    setImageUri(null);
    setImageBase64(null);
  };

  const sendMessage = async () => {
    if ((!input.trim() && !imageBase64) || isLoading) return;

    let content: string | ContentPart[] = input.trim();
    if (imageBase64) {
      content = [];
      if (input.trim()) {
        content.push({ type: 'text', text: input.trim() });
      }
      content.push({ type: 'image_url', image_url: { url: imageBase64 } });
    }

    const newUserMessage: ChatMessage = { role: 'user', content };
    const updatedMessages = [...messages, newUserMessage];
    
    setMessages(updatedMessages);
    setInput('');
    removeImage();
    setIsLoading(true);

    try {
      const response = await postChat({
        messages: updatedMessages,
        latitude: location?.coords.latitude,
        longitude: location?.coords.longitude,
      });
      
      const newMessage: ChatMessage = {
        ...response.message,
        outfit_suggestions: response.outfit_suggestions,
        calendar_suggestions: response.calendar_suggestions,
      };
      setMessages((prev) => [...prev, newMessage]);

      if (response.memory_suggestions && response.memory_suggestions.length > 0) {
        try {
          await ingestMemories({ memories: response.memory_suggestions });
        } catch (memError) {
          console.error("Failed to ingest memory suggestions:", memError);
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setIsLoading(false);
    }
  };
  const sendDirectMessage = async (displayMessage: string, hiddenPrompt?: string) => {
    if (isLoading) return;

    const uiMessage: ChatMessage = { role: 'user', content: displayMessage };
    const updatedUIMessages = [...messages, uiMessage];
    
    setMessages(updatedUIMessages);
    setIsLoading(true);

    try {
      // Send the explicit hidden prompt to the backend to force tool usage, 
      // without exposing the awkward instructions to the user.
      const backendMessage: ChatMessage = { role: 'user', content: hiddenPrompt || displayMessage };
      const backendMessages = [...messages, backendMessage];

      const response = await postChat({
        messages: backendMessages,
        latitude: location?.coords.latitude,
        longitude: location?.coords.longitude,
      });
      
      const newMessage: ChatMessage = {
        ...response.message,
        outfit_suggestions: response.outfit_suggestions,
        calendar_suggestions: response.calendar_suggestions,
      };
      setMessages((prev) => [...prev, newMessage]);

      if (response.memory_suggestions && response.memory_suggestions.length > 0) {
        try {
          await ingestMemories({ memories: response.memory_suggestions });
        } catch (memError) {
          console.error("Failed to ingest memory suggestions:", memError);
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setIsLoading(false);
    }
  };
  const renderMessageContent = (content: string | ContentPart[], isUser: boolean) => {
    const textColor = isUser ? '#fff' : FuchsiaColors.ink;
    
    if (typeof content === 'string') {
      return <MarkdownText style={[styles.messageText, { color: textColor }]}>{content}</MarkdownText>;
    }
    
    return (
      <View style={{ gap: 8 }}>
        {content.map((part, index) => {
          if (part.type === 'text') {
            return <MarkdownText key={index} style={[styles.messageText, { color: textColor }]}>{part.text}</MarkdownText>;
          }
          if (part.type === 'image_url') {
            return (
              <Image 
                key={index} 
                source={{ uri: part.image_url.url }} 
                style={styles.messageImage} 
                resizeMode="cover" 
              />
            );
          }
          return null;
        })}
      </View>
    );
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View style={{ marginBottom: 16 }}>
        <View style={[
          styles.messageBubble, 
          isUser ? styles.userBubble : styles.aiBubble
        ]}>
          {renderMessageContent(item.content, isUser)}
        </View>
        {item.outfit_suggestions && item.outfit_suggestions.length > 0 && (
          <View style={{ marginTop: 12, gap: 12 }}>
            {item.outfit_suggestions.map((suggestion, idx) => (
              <OutfitSuggestionCard 
                key={idx} 
                suggestion={suggestion} 
                closetItems={closetItems} 
                onSuggestAnother={() => sendDirectMessage(
                  "Show me a different option.", 
                  "Show me a different option. CRITICAL: You must choose different clothing items than your previous suggestions. Do not repeat the same outfit. Please use your suggest_outfits tool to officially propose it so I can save it."
                )}
              />
            ))}
          </View>
        )}
        {item.calendar_suggestions && item.calendar_suggestions.length > 0 && (
          <View style={{ marginTop: 12, gap: 12 }}>
            {item.calendar_suggestions.map((suggestion, idx) => (
              <CalendarSuggestionCard 
                key={idx} 
                suggestion={suggestion} 
                savedOutfits={savedOutfits} 
                onDismiss={() => sendDirectMessage("Actually, nevermind.")}
              />
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { paddingBottom: androidBottomPadding }]} edges={['top']}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        enabled={Platform.OS === 'ios'}
      >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(_, index) => index.toString()}
        renderItem={renderMessage}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListHeaderComponent={<HeroCard />}
      />
      
      {isLoading && (
        <View style={styles.loadingContainer}>
          <View style={[styles.messageBubble, styles.aiBubble, { paddingHorizontal: 16, paddingVertical: 12 }]}>
            <TypingIndicator />
          </View>
        </View>
      )}

      <View style={[
        styles.inputSection, 
        { 
          paddingBottom: isKeyboardVisible ? 12 : Math.max(insets.bottom, 12),
          marginBottom: isKeyboardVisible ? 0 : 80 
        }
      ]}>
        {imageUri && (
          <View style={styles.imagePreviewContainer}>
            <Image source={{ uri: imageUri }} style={styles.imagePreview} />
            <TouchableOpacity style={styles.removeImageButton} onPress={removeImage}>
              <X size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.inputBar}>
          <TouchableOpacity style={styles.plusBtn} onPress={pickImage}>
            <ImageIcon size={20} color={FuchsiaColors.slate} />
          </TouchableOpacity>
          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder="Ask your stylist..."
            placeholderTextColor={FuchsiaColors.slate}
            multiline
            maxLength={500}
          />
          <TouchableOpacity 
            style={[{ opacity: (!input.trim() && !imageBase64) || isLoading ? 0.5 : 1 }]} 
            onPress={sendMessage}
            disabled={(!input.trim() && !imageBase64) || isLoading}
          >
            <LinearGradient
              colors={['#86003C', '#B5004D', '#D4145A']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.sendBtn}
            >
              <MaterialIcons name={isLoading ? 'hourglass-empty' : 'send'} size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: FuchsiaColors.cloud,
  },
  listContent: {
    padding: 16,
    gap: 16,
    flexGrow: 1,
  },
  messageBubble: {
    padding: 14,
    borderRadius: 16,
    maxWidth: '85%',
  },
  userBubble: {
    backgroundColor: FuchsiaColors.deep,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 15,
    color: FuchsiaColors.ink,
    lineHeight: 22,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
    lineHeight: 22,
  },
  heroCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  heroLabel: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.7)',
  },
  heroTitle: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 20,
    color: '#fff',
    marginTop: 4,
    lineHeight: 26,
  },
  heroBody: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 8,
    lineHeight: 18,
  },
  loadingContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  loadingText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 14,
    color: FuchsiaColors.slate,
  },
  outfitCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    borderRadius: 16,
    padding: 16,
    width: '85%',
    alignSelf: 'flex-start',
  },
  outfitCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  outfitCardTitle: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 16,
    color: FuchsiaColors.ink,
  },
  outfitCardImages: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  outfitCardImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: FuchsiaColors.cloud,
  },
  outfitCardRationale: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 13,
    color: FuchsiaColors.slate,
    fontStyle: 'italic',
    marginBottom: 12,
    lineHeight: 18,
  },
  outfitCardBtn: {
    backgroundColor: FuchsiaColors.deep,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  outfitCardBtnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: FuchsiaColors.deep,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  outfitCardBtnSaved: {
    backgroundColor: '#10B981',
  },
  outfitCardBtnText: {
    color: '#fff',
    fontFamily: FuchsiaFonts.heading,
    fontSize: 14,
  },
  outfitCardBtnTextSecondary: {
    color: FuchsiaColors.deep,
    fontFamily: FuchsiaFonts.heading,
    fontSize: 14,
  },
  inputSection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 8,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    backgroundColor: FuchsiaColors.cloud,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    borderRadius: 20,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    fontFamily: FuchsiaFonts.body,
    fontSize: 15,
    color: FuchsiaColors.ink,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    textAlignVertical: 'center',
  },
  plusBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: FuchsiaColors.slate,
    opacity: 0.5,
  },
  imagePreviewContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    marginLeft: 40,
  },
  imagePreview: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: FuchsiaColors.ink,
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
