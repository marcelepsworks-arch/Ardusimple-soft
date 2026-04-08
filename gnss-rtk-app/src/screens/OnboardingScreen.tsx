/**
 * OnboardingScreen — shown on first launch.
 * 3 slides introducing key features, then straight to registration.
 */

import React, {useState, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';

const {width: SCREEN_W} = Dimensions.get('window');

interface Props {
  onComplete: () => void;
}

const SLIDES = [
  {
    icon: '📡',
    title: 'Connect your receiver',
    body: 'Pair any ArduSimple BLE receiver in seconds. Supports ZED-F9P, ZED-F9R, UM982, Septentrio Mosaic and more.',
    accent: '#3b82f6',
  },
  {
    icon: '🛰️',
    title: 'RTK centimetre accuracy',
    body: 'Connect to any NTRIP caster for real-time corrections. Achieve < 2 cm horizontal accuracy in the field.',
    accent: '#8b5cf6',
  },
  {
    icon: '📐',
    title: 'Full survey toolkit',
    body: 'Collect points, stake out targets, run COGO calculations, build DTM surfaces, and export to CAD and GIS.',
    accent: '#10b981',
  },
  {
    icon: '🎁',
    title: '10 days free',
    body: 'All features unlocked during your trial. No credit card needed. Subscribe when you\'re ready.',
    accent: '#f59e0b',
  },
];

export function OnboardingScreen({onComplete}: Props) {
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    setActiveIdx(idx);
  }

  function goNext() {
    if (activeIdx < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({x: (activeIdx + 1) * SCREEN_W, animated: true});
    } else {
      onComplete();
    }
  }

  const isLast = activeIdx === SLIDES.length - 1;

  return (
    <View style={styles.container}>
      {/* Skip */}
      <TouchableOpacity style={styles.skipBtn} onPress={onComplete}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        scrollEventThrottle={16}>
        {SLIDES.map((slide, i) => (
          <View key={i} style={[styles.slide, {width: SCREEN_W}]}>
            <View style={[styles.iconCircle, {backgroundColor: slide.accent + '22', borderColor: slide.accent + '44'}]}>
              <Text style={styles.icon}>{slide.icon}</Text>
            </View>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.body}>{slide.body}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Dots */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === activeIdx && {
                backgroundColor: SLIDES[activeIdx].accent,
                width: 20,
              },
            ]}
          />
        ))}
      </View>

      {/* CTA button */}
      <TouchableOpacity
        style={[styles.cta, {backgroundColor: SLIDES[activeIdx].accent}]}
        onPress={goNext}
        activeOpacity={0.85}>
        <Text style={styles.ctaText}>
          {isLast ? 'Get Started' : 'Next'}
        </Text>
      </TouchableOpacity>

      <View style={{height: 40}} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center'},

  skipBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 10,
  },
  skipText: {fontSize: 14, color: '#6b7280'},

  slide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingBottom: 40,
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
  },
  icon: {fontSize: 64},
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#f9fafb',
    textAlign: 'center',
    marginBottom: 16,
  },
  body: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 24,
  },

  dots: {flexDirection: 'row', gap: 6, marginBottom: 28},
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#374151',
    transition: 'width 0.3s',
  } as any,

  cta: {
    width: SCREEN_W - 48,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  ctaText: {fontSize: 16, fontWeight: '800', color: '#fff'},
});
