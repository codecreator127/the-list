import { useCallback, useState } from 'react';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BackButton, Button, Page, Text } from '../components/ui';
import { getPassportProgress, isTastingPassportEnabled, passportCuisines, weeklyTastingTarget } from '../features/tastingPassport';
import { foodService } from '../services/foodService';
import { colors, radius, typefaces, useTheme } from '../theme';

type Progress = ReturnType<typeof getPassportProgress>;
type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; progress: Progress };

export default function TastingPassportRoute() {
  return isTastingPassportEnabled ? <TastingPassport /> : <Redirect href="/(tabs)/list" />;
}

function TastingPassport() {
  useTheme();
  const styles = makeStyles();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [retry, setRetry] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    setState({ status: 'loading' });
    foodService.getMyListWithReviews().then(({ items, reviews }) => {
      if (active) setState({ status: 'ready', progress: getPassportProgress(items.map(item => item.place), reviews, new Date()) });
    }).catch(() => {
      if (active) setState({ status: 'error' });
    });
    return () => { active = false; };
  }, [retry]));

  function explore(cuisine?: string) {
    router.navigate({ pathname: '/(tabs)/search', params: { cuisine: cuisine ?? 'All cuisines' } });
  }

  const progress = state.status === 'ready' ? state.progress : undefined;
  const weeklyDone = !!progress && progress.weeklyCount >= weeklyTastingTarget;

  return <Page maxWidth={740}>
    <View style={styles.header}>
      <BackButton onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/list')} />
      <Text size={15} weight="600">My List</Text>
    </View>
    <View style={styles.intro}>
      <Text size={11} weight="700" color={colors.accent} style={styles.eyebrow}>THE LIST FIELD GUIDE</Text>
      <View accessibilityRole="header"><Text size={34} weight="700">Tasting Passport</Text></View>
      <Text size={14} color={colors.textSecondary}>Review places you’ve tried to collect stamps, unlock milestones, and find your next cuisine.</Text>
    </View>
    {state.status === 'loading' && <ActivityIndicator accessibilityLabel="Loading tasting progress" color={colors.accent} />}
    {state.status === 'error' && <View style={styles.panel}>
      <Text weight="700">Couldn’t load your tasting progress.</Text>
      <Button title="Try again" variant="secondary" onPress={() => setRetry(value => value + 1)} />
    </View>}
    {progress && <>
      <View style={styles.panel}>
        <Text size={11} weight="700" color={colors.accent} style={styles.eyebrow}>WEEKLY CHALLENGE</Text>
        <Text size={21} weight="700">{weeklyDone ? 'Challenge complete' : 'Two new places this week'}</Text>
        <Text size={13} color={colors.textSecondary}>Review two restaurants for the first time. A new challenge starts each Monday.</Text>
        <View style={styles.progressTrack} accessibilityRole="progressbar"
          aria-valuemin={0} aria-valuemax={weeklyTastingTarget} aria-valuenow={Math.min(progress.weeklyCount, weeklyTastingTarget)}
          accessibilityLabel="Weekly tasting challenge">
          <View style={[styles.progressFill, { width: `${Math.min(progress.weeklyCount / weeklyTastingTarget, 1) * 100}%` }]} />
        </View>
        <Text size={13} weight="700" color={weeklyDone ? colors.success : colors.textSecondary}>
          {Math.min(progress.weeklyCount, weeklyTastingTarget)} of {weeklyTastingTarget} new places
        </Text>
        <Button title="Find a place to try" variant="secondary" icon="search" onPress={() => explore()} style={styles.action} />
      </View>
      <View style={styles.panel}>
        <View accessibilityRole="header"><Text size={22} weight="700">Cuisine stamps</Text></View>
        <Text size={13} color={colors.textSecondary}>{progress.stampedCuisines.size} of {passportCuisines.length} collected. Pick a cuisine to explore it.</Text>
        <View style={styles.stamps}>
          {passportCuisines.map(cuisine => {
            const earned = progress.stampedCuisines.has(cuisine);
            return <Button key={cuisine} title={cuisine} icon={earned ? 'checkmark-circle' : 'ellipse-outline'}
              accessibilityLabel={`Explore ${cuisine}, stamp ${earned ? 'collected' : 'available'}`}
              size="small" variant="secondary" onPress={() => explore(cuisine)} />;
          })}
        </View>
      </View>
      <View style={styles.panel}>
        <View accessibilityRole="header"><Text size={22} weight="700">Milestones</Text></View>
        {progress.badges.map(badge => <View key={badge.title} style={styles.badge}>
          <Ionicons name={badge.earned ? 'ribbon' : 'lock-closed-outline'} color={badge.earned ? colors.rating : colors.textMuted} size={22} />
          <View style={styles.badgeCopy}>
            <Text size={15} weight="700">{badge.title}</Text>
            <Text size={12} color={colors.textSecondary}>{badge.description}</Text>
          </View>
          <Text size={11} weight="700" color={badge.earned ? colors.success : colors.textMuted}>{badge.earned ? 'Earned' : 'In progress'}</Text>
        </View>)}
      </View>
    </>}
  </Page>;
}

const makeStyles = () => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  intro: { gap: 6, marginBottom: 18 },
  eyebrow: { letterSpacing: 1.2, fontFamily: typefaces.mono },
  panel: { gap: 10, backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, padding: 16, marginBottom: 14 },
  progressTrack: { height: 8, backgroundColor: colors.surfaceStrong, borderRadius: 4, overflow: 'hidden', marginTop: 4 },
  progressFill: { height: 8, backgroundColor: colors.accent, borderRadius: 4 },
  action: { alignSelf: 'flex-start' },
  stamps: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  badge: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderColor: colors.border, paddingTop: 8 },
  badgeCopy: { flex: 1, minWidth: 0 },
});
