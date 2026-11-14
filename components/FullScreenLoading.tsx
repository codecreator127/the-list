import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, useTheme } from '../theme';
import { useReducedMotion } from './motion';
import { Text } from './ui';

export function FullScreenLoading({ message }: { message: string }) {
  useTheme();
  const reducedMotion = useReducedMotion();
  return <View style={[styles.screen, { backgroundColor: colors.background }]}
    accessibilityRole="progressbar" accessibilityLabel={message} accessibilityState={{ busy: true }}>
    <View style={[styles.mark, { backgroundColor: colors.surfaceStrong }]}>
      <Ionicons name="restaurant-outline" size={32} color={colors.accent} />
    </View>
    <Text size={30} weight="700">The List</Text>
    <Text size={14} color={colors.textSecondary} style={styles.message}>{message}</Text>
    {reducedMotion === false && <ActivityIndicator color={colors.accent} style={styles.indicator} />}
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  mark: { width: 68, height: 68, borderRadius: 34, justifyContent: 'center', alignItems: 'center' },
  message: { textAlign: 'center' },
  indicator: { marginTop: 6 },
});
