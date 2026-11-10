import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, useTheme } from '../theme';
import { useReducedMotion } from './motion';
import { Text } from './ui';

const sparks = [[-22, -12], [-9, -19], [13, -18], [23, -8], [17, 17], [-17, 16]] as const;

export function ReviewSavedCelebration() {
  useTheme();
  const reducedMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion !== false) return;
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 560,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [progress, reducedMotion]);

  const animated = reducedMotion === false;
  const scale = progress.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0.72, 1.15, 1] });

  return <View accessibilityRole="alert" style={[styles.banner, { backgroundColor: colors.surfaceStrong }]}>
    <View style={styles.badge} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {animated && sparks.map(([x, y], index) => <Animated.View key={index} style={[styles.spark, {
        backgroundColor: colors.success,
        opacity: progress.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 1, 0] }),
        transform: [{ translateX: Animated.multiply(progress, x) }, { translateY: Animated.multiply(progress, y) }],
      }]} />)}
      <Animated.View style={animated ? { transform: [{ scale }] } : undefined}>
        <Ionicons name="checkmark-circle" size={25} color={colors.success} />
      </Animated.View>
    </View>
    <Text size={13} weight="700">Review shared</Text>
  </View>;
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 9, borderRadius: radius.sm },
  badge: { width: 32, height: 30, alignItems: 'center', justifyContent: 'center' },
  spark: { position: 'absolute', width: 4, height: 4, borderRadius: 2 },
});
