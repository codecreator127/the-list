import { useRef } from 'react';
import { router } from 'expo-router';
import { Image, ScrollView, StyleSheet, Text as NativeText, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Text } from '../components/ui';
import { colors, radius, typefaces, useTheme } from '../theme';
import { isFirebaseRepositoryEnabled } from '../services/firebase';

const restaurants = [
  { name: 'Ramen Danbo', detail: 'Japanese · Haymarket', score: '5.00', image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=420&q=85' },
  { name: 'Bistecca', detail: 'Italian · Sydney CBD', score: '4.80', image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=420&q=85' },
  { name: 'Pellegrino 2000', detail: 'Italian · Surry Hills', score: '4.60', image: 'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=420&q=85' },
];

const steps = [
  { title: 'Find a place', body: 'Start with somewhere you’ve already eaten.', icon: 'search-outline' },
  { title: 'Rate your meal', body: 'Give it a score. Add a note or photo if you like.', icon: 'star-outline' },
  { title: 'Build your List', body: 'See where it ranks alongside your favourites.', icon: 'list-outline' },
] as const;

export default function Welcome() {
  useTheme();
  const { width } = useWindowDimensions();
  const stacked = width < 960;
  const narrow = width < 480;
  const gutter = narrow ? 20 : width < 1200 ? 32 : 56;
  const titleSize = narrow ? Math.min(50, Math.floor(width * 0.128)) : stacked ? 58 : Math.min(76, Math.floor(width * 0.058));
  const s = makeStyles();
  const scroll = useRef<ScrollView>(null);
  const howOffset = useRef(0);
  const start = () => router.push(isFirebaseRepositoryEnabled
    ? { pathname: '/auth', params: { mode: 'create' } }
    : '/(tabs)/home');
  const explore = () => {
    if (isFirebaseRepositoryEnabled) scroll.current?.scrollTo({ y: howOffset.current, animated: false });
    else router.push('/(tabs)/search');
  };
  const openList = () => router.push(isFirebaseRepositoryEnabled ? '/auth' : '/(tabs)/list');
  const signIn = () => router.push('/auth');

  return <ScrollView ref={scroll} style={s.root} contentContainerStyle={s.page}>
    <View style={[s.header, { paddingHorizontal: gutter }]}>
      <View style={s.wordmark}>
        <Ionicons name="restaurant-outline" size={22} color={colors.accent} />
        <Text size={18} weight="700">The List</Text>
      </View>
      <View style={s.actions}>
        {!stacked && <Button title="Explore" variant="ghost" size="small" onPress={explore} />}
        {isFirebaseRepositoryEnabled && <Button title="Sign in" variant="ghost" size="small" onPress={signIn} />}
        {!narrow && <Button title="Get started" size="small" onPress={start} />}
      </View>
    </View>

    <View style={[s.section, s.hero, { paddingHorizontal: gutter }, stacked && s.stack]}>
      <View style={stacked ? s.wideCopy : s.column}>
        <NativeText accessibilityRole="header" aria-level={1} style={[s.headline, { fontSize: titleSize, lineHeight: Math.ceil(titleSize * 1.10) }]}>
          Every place you’ve eaten. <NativeText style={s.emphasis}>Ranked.</NativeText>
        </NativeText>
        <Text size={16} color={colors.textSecondary} style={s.lede}>Rate the places you try, keep your favourites close, and find somewhere good to eat with friends.</Text>
        <View style={[s.actions, s.heroActions]}>
          <Button title="Start your List" icon="arrow-forward" onPress={start} />
          <Button title="Explore the app" variant="secondary" onPress={explore} />
        </View>
      </View>

      <View style={[s.previewStage, stacked ? s.stackedPreview : s.column, narrow && s.previewStageNarrow]}>
        <View style={s.preview}>
          <View style={s.previewHeading}>
            <Text size={20} weight="700">My List</Text>
            <Text size={12} color={colors.textSecondary}>Example ranking</Text>
          </View>
          {restaurants.map(({ name, detail, score, image }, index) => (
            <View key={name} style={s.restaurant}>
              <Text size={13} weight="700" color={colors.accent} style={s.rank}>{index + 1}</Text>
              <Image source={{ uri: image }} style={[s.thumbnail, narrow && s.thumbnailNarrow]} accessible={false} />
              <View style={s.restaurantInfo}>
                <Text size={14} weight="700">{name}</Text>
                <Text size={12} color={colors.textSecondary}>{detail}</Text>
              </View>
              <Text size={13} weight="700" style={s.score}>{score}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>

    <View style={[s.section, s.how, { paddingHorizontal: gutter }]}
      onLayout={event => { howOffset.current = event.nativeEvent.layout.y; }}>
      <NativeText accessibilityRole="header" aria-level={2} style={s.sectionTitle}>Make a List worth coming back to.</NativeText>
      <View style={[s.steps, width < 650 && s.stackSteps]}>
        {steps.map(step => (
          <View key={step.title} style={s.step}>
            <Ionicons name={step.icon} size={22} color={colors.accent} />
            <Text size={17} weight="700">{step.title}</Text>
            <Text size={14} color={colors.textSecondary}>{step.body}</Text>
          </View>
        ))}
      </View>
    </View>

    <View style={[s.section, s.social, { paddingHorizontal: gutter }, stacked && s.stack]}>
      <View style={stacked ? s.wideCopy : s.column}>
        <NativeText accessibilityRole="header" aria-level={2} style={s.sectionTitle}>Find a favourite you agree on.</NativeText>
        <Text size={16} color={colors.textSecondary} style={s.lede}>Open Combined List from My List to rank restaurants with selected friends and decide where to eat together.</Text>
        <Button title="Go to My List" variant="secondary" size="small" onPress={openList} style={s.socialAction} />
      </View>
      <View style={[s.socialStage, stacked ? s.stackedPreview : s.column, narrow && s.previewStageNarrow]}>
        <View style={[s.friendLists, narrow && s.friendListsNarrow]}>
          <ListExample title="Jordan’s List" rank={1} />
          <ListExample title="Sam’s List" rank={2} />
        </View>
        <Ionicons name="arrow-down" size={21} color={colors.accent} style={s.combineArrow} accessible={false} />
        <ListExample title="Combined List" rank={1} combined />
      </View>
    </View>

    <View style={[s.final, { paddingHorizontal: gutter }]}>
      <NativeText accessibilityRole="header" aria-level={2} style={[s.sectionTitle, s.finalTitle]}>What’s your number one?</NativeText>
      <Button title="Start your List" icon="arrow-forward" onPress={start} />
    </View>

    <View style={[s.footer, { paddingHorizontal: gutter }]}>
      <Text size={13} color={colors.textSecondary}>© 2026 The List</Text>
      <View style={s.actions}>
        <Button title="Explore" variant="ghost" size="small" onPress={explore} />
        <Button title="My List" variant="ghost" size="small" onPress={openList} />
      </View>
    </View>
  </ScrollView>;
}

function ListExample({ title, rank, combined = false }: { title: string; rank: number; combined?: boolean }) {
  const s = makeStyles();
  return <View style={[s.example, combined ? s.combined : s.friendExample]}>
    <Text size={13} weight="700" color={combined ? colors.onAccent : colors.accent} style={s.rank}>#{rank}</Text>
    <View style={s.restaurantInfo}>
      <Text size={12} color={combined ? colors.onAccent : colors.textSecondary}>{title}</Text>
      <Text size={15} weight="700" color={combined ? colors.onAccent : colors.textPrimary}>Ramen Danbo</Text>
    </View>
  </View>;
}

const makeStyles = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  page: { alignItems: 'center' },
  header: { width: '100%', maxWidth: 1320, minHeight: 74, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  section: { width: '100%', maxWidth: 1320 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 46, paddingTop: 50, paddingBottom: 54 },
  stack: { flexDirection: 'column', alignItems: 'stretch', gap: 26, paddingTop: 32, paddingBottom: 36 },
  column: { flex: 1, minWidth: 0 },
  wideCopy: { maxWidth: 590 },
  headline: { color: colors.textPrimary, fontFamily: typefaces.serif, letterSpacing: -1.4 },
  emphasis: { color: colors.accent, fontFamily: typefaces.serifItalic },
  lede: { maxWidth: 430, marginTop: 14, lineHeight: 24 },
  heroActions: { gap: 10, marginTop: 22 },
  previewStage: { padding: 24, backgroundColor: colors.surfaceStrong, borderRadius: radius.md },
  stackedPreview: { width: '100%', maxWidth: 650, alignSelf: 'center' },
  previewStageNarrow: { padding: 10 },
  preview: { paddingHorizontal: 12, backgroundColor: colors.surfaceElevated, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  previewHeading: { paddingVertical: 12, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  restaurant: { flexDirection: 'row', alignItems: 'center', minHeight: 68, paddingVertical: 9, gap: 8, borderTopWidth: 1, borderTopColor: colors.border },
  rank: { fontFamily: typefaces.mono },
  thumbnail: { width: 58, height: 48, borderRadius: radius.sm, backgroundColor: colors.surfaceStrong },
  thumbnailNarrow: { width: 42, height: 42 },
  restaurantInfo: { flex: 1, minWidth: 0 },
  score: { fontFamily: typefaces.mono },
  how: { paddingVertical: 30, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  sectionTitle: { maxWidth: 560, fontSize: 36, lineHeight: 40, fontFamily: typefaces.serif, color: colors.textPrimary },
  steps: { flexDirection: 'row', gap: 12, marginTop: 18 },
  stackSteps: { flexDirection: 'column' },
  step: { flex: 1, minWidth: 0, padding: 16, gap: 7, backgroundColor: colors.surface, borderRadius: radius.md },
  social: { paddingVertical: 52, flexDirection: 'row', alignItems: 'center', gap: 46 },
  socialAction: { alignSelf: 'flex-start', marginTop: 18 },
  socialStage: { padding: 24, backgroundColor: colors.surfaceStrong, borderRadius: radius.md },
  friendLists: { flexDirection: 'row', gap: 10 },
  friendListsNarrow: { flexDirection: 'column' },
  example: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0, padding: 12, borderRadius: radius.sm },
  friendExample: { flex: 1, backgroundColor: colors.surfaceElevated },
  combined: { backgroundColor: colors.accent },
  combineArrow: { alignSelf: 'center', marginVertical: 9 },
  final: { width: '100%', alignItems: 'center', gap: 16, paddingVertical: 38, backgroundColor: colors.surfaceStrong },
  finalTitle: { textAlign: 'center' },
  footer: { width: '100%', maxWidth: 1320, paddingVertical: 14, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
});
