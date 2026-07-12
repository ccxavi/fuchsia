import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, HelpCircle, ChevronDown } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { FuchsiaColors, FuchsiaFonts } from '@/constants/theme';
import { useState, useEffect } from 'react';
import Animated, { Layout, FadeIn, FadeOut, useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

const FAQ_CATEGORIES = [
  {
    title: 'Clothes & Outfits',
    faqs: [
      {
        question: 'How do I add clothes to my closet?',
        answer: 'Tap the + button on the Closet tab and select "Add Item". You can upload a photo from your gallery or take a new one. The app will automatically remove the background to make it look clean! Be sure to add details like category and color for better AI suggestions.',
      },
      {
        question: 'Why did the background removal fail on my photo?',
        answer: 'For the best results, try to take photos of your clothes against a solid, contrasting background (like a dark shirt on a white bedsheet) in bright, even lighting. Complex backgrounds can sometimes confuse the AI.',
      },
      {
        question: 'How do I create a new outfit?',
        answer: 'Tap the + button and select "Create Outfit". You can manually select items from your closet to build a look, or you can ask the AI Stylist to generate one for you based on a prompt or occasion.',
      },
      {
        question: 'Can I edit an outfit after saving it?',
        answer: 'Yes! Navigate to the outfit in your closet, tap it, and you can manage the items in it or change its details anytime.',
      },
      {
        question: 'Can I upload a photo of myself wearing an outfit?',
        answer: 'Yes! While you create the core outfit by combining individual clothing items from your closet, you can upload photos (like a mirror selfie) of yourself wearing the outfit. These photos are saved to your Recent Looks!',
      },
    ]
  },
  {
    title: 'Wardrobes & Calendar',
    faqs: [
      {
        question: 'What are Wardrobes and how do I use them?',
        answer: 'Wardrobes act like folders to organize your clothes and outfits. You can create a "Summer Vacation" wardrobe, a "Workwear" wardrobe, or a "Gym" wardrobe to keep things organized. Both items and outfits can belong to multiple wardrobes at once.',
      },
      {
        question: 'How do I log what I wore today?',
        answer: 'Go to the Calendar tab, select a date, and tap to log an outfit. Logging your outfits helps the app track what you wear most often and powers your "Recent Looks" on the home screen.',
      },
      {
        question: 'Can I schedule outfits for future dates?',
        answer: 'Yes! To plan ahead, navigate to an Outfit in your closet and select the option to log or schedule it. You can choose any future date to add it to your Calendar, helping you plan for upcoming events, work weeks, or trips.',
      },
    ]
  },
  {
    title: 'AI Stylist & Privacy',
    faqs: [
      {
        question: 'What can the AI Stylist do?',
        answer: 'The AI Stylist is your personal fashion assistant! You can ask it for outfit recommendations ("What should I wear to a summer wedding?"), ask it to generate new outfit combinations from your closet, or ask for general style advice.',
      },
      {
        question: 'How does AI Memory work?',
        answer: 'The AI Stylist remembers your preferences over time. If you tell it "I hate wearing yellow" or "I prefer oversized fits", it will save that to its Memory. You can manage and delete these memories in the AI Stylist section of your Profile.',
      },
      {
        question: 'How does the daily weather insight work?',
        answer: 'The home screen uses your current location to fetch local weather data and suggest the perfect outfits for the day. You must allow location access for this feature to work properly.',
      },
      {
        question: 'Is my data private?',
        answer: 'Yes, all of your closet data—including your uploaded photos, outfits, and calendar logs—is securely stored and strictly private to your account. It is not shared with anyone.',
      },
    ]
  }
];

function FaqItem({ faq, isExpanded, onPress }: { faq: any, isExpanded: boolean, onPress: () => void }) {
  const rotation = useSharedValue(isExpanded ? 180 : 0);
  
  useEffect(() => {
    rotation.value = withTiming(isExpanded ? 180 : 0, { duration: 250 });
  }, [isExpanded]);

  const chevronStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }]
    };
  });

  return (
    <AnimatedTouchableOpacity
      layout={Layout.duration(250)}
      style={[styles.faqCard, isExpanded && styles.faqCardExpanded]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.questionRow}>
        <ThemedText style={styles.questionText}>{faq.question}</ThemedText>
        <Animated.View style={chevronStyle}>
          <ChevronDown size={20} color={FuchsiaColors.slate} />
        </Animated.View>
      </View>
      {isExpanded && (
        <Animated.View 
          entering={FadeIn.duration(300).delay(50)} 
          exiting={FadeOut.duration(150)}
          style={styles.answerContainer}
        >
          <ThemedText style={styles.answerText}>{faq.answer}</ThemedText>
        </Animated.View>
      )}
    </AnimatedTouchableOpacity>
  );
}

export default function HelpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [expandedIndex, setExpandedIndex] = useState<string | null>(null);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={20} color={FuchsiaColors.ink} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Help Center</ThemedText>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.iconContainer}>
          <HelpCircle size={48} color={FuchsiaColors.vibrant} />
          <ThemedText style={styles.pageTitle}>Frequently Asked Questions</ThemedText>
          <ThemedText style={styles.pageSubtitle}>Everything you need to know about Fuchsia.</ThemedText>
        </View>

        <View style={styles.faqContainer}>
          {FAQ_CATEGORIES.map((category, catIndex) => (
            <View key={catIndex} style={styles.categorySection}>
              <ThemedText style={styles.categoryTitle}>{category.title}</ThemedText>
              {category.faqs.map((faq, faqIndex) => {
                const uniqueIndex = `${catIndex}-${faqIndex}`;
                const isExpanded = expandedIndex === uniqueIndex;
                return (
                  <FaqItem
                    key={faqIndex}
                    faq={faq}
                    isExpanded={isExpanded}
                    onPress={() => setExpandedIndex(isExpanded ? null : uniqueIndex)}
                  />
                );
              })}
            </View>
          ))}
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
  pageTitle: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 22,
    color: FuchsiaColors.ink,
    marginTop: 16,
    textAlign: 'center',
  },
  pageSubtitle: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 15,
    color: FuchsiaColors.slate,
    marginTop: 8,
    textAlign: 'center',
  },
  faqContainer: {
    gap: 24,
  },
  categorySection: {
    gap: 12,
  },
  categoryTitle: {
    fontFamily: FuchsiaFonts.heading,
    fontSize: 18,
    color: FuchsiaColors.ink,
    marginLeft: 4,
    marginBottom: 4,
  },
  faqCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    padding: 16,
    overflow: 'hidden',
  },
  faqCardExpanded: {
    borderColor: FuchsiaColors.mist,
    backgroundColor: '#FAFAFA',
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  questionText: {
    fontFamily: FuchsiaFonts.bodySemiBold,
    fontSize: 15,
    color: FuchsiaColors.ink,
    flex: 1,
    lineHeight: 22,
    paddingRight: 16,
  },
  answerContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  answerText: {
    fontFamily: FuchsiaFonts.body,
    fontSize: 14,
    color: FuchsiaColors.slate,
    lineHeight: 22,
  },
});
