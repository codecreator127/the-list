import { useEffect, useRef, type ComponentProps } from 'react';
import { Animated, Easing, Modal, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PodiumChange } from '../features/podium';
import { colors, radius, typefaces, useTheme } from '../theme';
import { useReducedMotion } from './motion';
import { Button, Text } from './ui';

type NamedChange = PodiumChange & { name?: string };
type RankStyle = { label: string; icon: ComponentProps<typeof Ionicons>['name']; colour: string; ink: string };
const medals: Record<PodiumChange['rank'], RankStyle> = {
  1: { label: 'New #1', icon: 'trophy', colour: '#F6C761', ink: '#472E08' },
  2: { label: 'New #2', icon: 'flash', colour: '#C4D3E1', ink: '#293D50' },
  3: { label: 'New #3', icon: 'ribbon', colour: '#EAA888', ink: '#502B1A' },
};
const burst = [
  [-52, -23], [-32, -40], [0, -47], [32, -40], [52, -23], [-53, 24], [53, 24],
] as const;

function PodiumMedal({ rank, delay }: { rank: PodiumChange['rank']; delay: number }) {
  const reducedMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const medal = medals[rank];

  useEffect(() => {
    if (reducedMotion !== false) {
      progress.setValue(0);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      delay,
      duration: rank === 1 ? 820 : 620,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [delay, progress, rank, reducedMotion]);

  const animated = reducedMotion === false;
  const phase = [0, 0.55, 1];
  const motion = rank === 1
    ? { translateY: progress.interpolate({ inputRange: phase, outputRange: [18, -9, 0] }) }
    : { translateX: progress.interpolate({ inputRange: phase, outputRange: [rank === 2 ? -20 : 0, rank === 2 ? 5 : 0, 0] }) };
  const scale = progress.interpolate({ inputRange: phase, outputRange: rank === 3 ? [0.55, 1.22, 1] : [0.8, 1.1, 1] });
  const rotate = progress.interpolate({ inputRange: phase, outputRange: rank === 3 ? ['-24deg', '10deg', '0deg'] : ['0deg', '0deg', '0deg'] });

  return <View style={styles.medalSpace} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
    {animated && rank === 1 && burst.map(([x, y], index) => <Animated.View key={index} style={[
      styles.spark, { backgroundColor: index % 2 ? medals[2].colour : medal.colour,
        opacity: progress.interpolate({ inputRange: [0, 0.2, 0.6, 1], outputRange: [0, 1, 1, 0] }),
        transform: [{ translateX: Animated.multiply(progress, x) }, { translateY: Animated.multiply(progress, y) }, { rotate: '45deg' }],
      },
    ]} />)}
    {animated && rank === 2 && <Animated.View style={[styles.trail, {
      backgroundColor: medal.colour,
      opacity: progress.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.65, 0] }),
      transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-29, 26] }) }],
    }]} />}
    <Animated.View testID={`podium-medal-${rank}`} style={[
      styles.medal, { backgroundColor: medal.colour },
      animated && { transform: [motion, { scale }, { rotate }] },
    ]}>
      <Ionicons name={medal.icon} color={medal.ink} size={23} />
    </Animated.View>
  </View>;
}

export function PodiumCelebration({ changes, onClose }: { changes: NamedChange[]; onClose: () => void }) {
  useTheme();
  return <Modal transparent animationType="none" onRequestClose={onClose}>
    <View style={[styles.backdrop, { backgroundColor: colors.scrim }]} accessibilityViewIsModal>
      <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
        <ScrollView bounces={false} contentContainerStyle={styles.content}>
          <Text size={11} weight="700" color={colors.accent} style={[styles.eyebrow, { fontFamily: typefaces.mono }]}>THE LIST PODIUM</Text>
          <View accessibilityRole="header"><Text size={30} weight="700" style={styles.title}>Your podium changed</Text></View>
          <Text size={14} color={colors.textSecondary} style={styles.description}>Your saved review shook up the top of your List.</Text>
          <View style={styles.rows}>
            {changes.map((change, index) => <View key={change.rank} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <PodiumMedal rank={change.rank} delay={index * 120} />
              <View style={styles.rowText}>
                <Text size={12} weight="700" color={colors.accent}>{medals[change.rank].label}</Text>
                <Text size={16} weight="700">{change.name ?? 'A new restaurant takes this spot'}</Text>
              </View>
            </View>)}
          </View>
          <Button title="Continue" onPress={onClose} />
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 18 },
  card: { width: '100%', maxWidth: 430, maxHeight: '100%', borderWidth: 1, borderRadius: radius.md },
  content: { padding: 20 },
  eyebrow: { letterSpacing: 1.5 },
  title: { marginTop: 7 },
  description: { marginTop: 5, lineHeight: 20 },
  rows: { marginTop: 16, marginBottom: 18, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 62, borderWidth: 1, borderRadius: radius.sm, paddingRight: 12 },
  rowText: { flex: 1, minWidth: 0, paddingVertical: 8, gap: 3 },
  medalSpace: { width: 78, alignItems: 'center', justifyContent: 'center' },
  medal: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  spark: { position: 'absolute', width: 6, height: 6, borderRadius: 1 },
  trail: { position: 'absolute', width: 38, height: 3, borderRadius: 2 },
});
