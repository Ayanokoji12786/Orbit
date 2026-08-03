import { useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import Animated, {
  type SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, GradientBackground, PressableScale } from '@/components/ui';
import { useAppTheme } from '@/design-system/useAppTheme';
import { useAppStateStore } from '@/stores/app-state-store';

const slides: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string }[] = [
  {
    icon: 'sparkles',
    title: 'Meet Orbit',
    subtitle: 'The AI-first way to meet, chat, and collaborate — built for teams, students, and creators.',
  },
  {
    icon: 'videocam',
    title: 'Beautiful, fast calls',
    subtitle: 'HD video and audio with noise suppression, tuned to feel great on any network.',
  },
  {
    icon: 'bulb',
    title: 'Your AI meeting partner',
    subtitle: 'Live summaries, action items, and answers to your questions — right when you need them.',
  },
];

export default function Onboarding() {
  const { colors, spacing } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const completeOnboarding = useAppStateStore((s) => s.completeOnboarding);
  const scrollX = useSharedValue(0);
  const [page, setPage] = useState(0);
  const scrollRef = useRef<Animated.ScrollView>(null);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const finish = () => {
    completeOnboarding();
    router.replace('/(auth)/sign-in');
  };

  const goNext = () => {
    if (page < slides.length - 1) {
      scrollRef.current?.scrollTo({ x: (page + 1) * SCREEN_WIDTH, animated: true });
      setPage(page + 1);
    } else {
      finish();
    }
  };

  return (
    <GradientBackground>
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <View style={[styles.topRow, { paddingHorizontal: spacing.lg }]}>
          <View />
          {page < slides.length - 1 && (
            <PressableScale onPress={finish} haptic="none">
              <AppText variant="bodyMedium" color="textSecondary">
                Skip
              </AppText>
            </PressableScale>
          )}
        </View>

        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(e) => {
            setPage(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH));
          }}>
          {slides.map((slide) => (
            <View key={slide.title} style={[styles.slide, { width: SCREEN_WIDTH, paddingHorizontal: spacing.xl }]}>
              <View style={[styles.iconWrap, { backgroundColor: colors.primaryMuted }]}>
                <Ionicons name={slide.icon} size={44} color={colors.primary} />
              </View>
              <AppText variant="displayMedium" style={{ textAlign: 'center', marginTop: spacing.xl }}>
                {slide.title}
              </AppText>
              <AppText
                variant="body"
                color="textSecondary"
                style={{ textAlign: 'center', marginTop: spacing.sm, maxWidth: 300 }}>
                {slide.subtitle}
              </AppText>
            </View>
          ))}
        </Animated.ScrollView>

        <View style={styles.dotsRow}>
          {slides.map((slide, i) => (
            <Dot key={slide.title} index={i} scrollX={scrollX} screenWidth={SCREEN_WIDTH} />
          ))}
        </View>

        <View style={{ paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + spacing.lg, paddingTop: spacing.lg }}>
          <Button label={page === slides.length - 1 ? 'Get Started' : 'Next'} onPress={goNext} />
        </View>
      </View>
    </GradientBackground>
  );
}

function Dot({
  index,
  scrollX,
  screenWidth,
}: {
  index: number;
  scrollX: SharedValue<number>;
  screenWidth: number;
}) {
  const { colors } = useAppTheme();
  const style = useAnimatedStyle(() => {
    const distance = screenWidth > 0 ? Math.abs(scrollX.value / screenWidth - index) : index === 0 ? 0 : 1;
    const active = distance < 0.5;
    return {
      width: active ? 22 : 8,
      opacity: 1 - Math.min(distance, 1) * 0.7,
    };
  });

  return <Animated.View style={[styles.dot, { backgroundColor: colors.primary }, style]} />;
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 44,
  },
  slide: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
});
