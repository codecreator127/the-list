import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, FilterChip, Page, PlaceCard, ReviewCard, SectionTitle, Text } from '../../components/ui';
import { foodService } from '../../services/foodService';
import { watchAuthState } from '../../services/auth';
import { isFirebaseRepositoryEnabled } from '../../services/firebase';
import type { Place, Review, User } from '../../types/models';
import { colors, radius, space, useTheme } from '../../theme';

function PlaceCarousel({ places, onPlacePress }: { places: Place[]; onPlacePress: (id: string) => void }) {
  const s = makeStyles();
  const listRef = useRef<ScrollView>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const cardWidth = viewportWidth ? Math.max(1, Math.min(254, viewportWidth - 52)) : 254;
  const interval = cardWidth + 14;
  const trailingSpace = viewportWidth ? Math.max(24, viewportWidth - cardWidth) : 24;

  useEffect(() => { setActiveIndex(0); listRef.current?.scrollTo({ x: 0, animated: false }); }, [places.length]);

  if (!places.length) return <Text size={13} color={colors.muted} style={{ marginTop: 15 }}>Places you review will appear here.</Text>;

  return <View onLayout={event => setViewportWidth(event.nativeEvent.layout.width)} style={{ marginTop: 15 }}>
    <ScrollView
      ref={listRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={interval}
      snapToAlignment="start"
      decelerationRate="fast"
      disableIntervalMomentum
      onMomentumScrollEnd={event => setActiveIndex(Math.min(places.length - 1, Math.round(event.nativeEvent.contentOffset.x / interval)))}
      contentContainerStyle={{ paddingRight: trailingSpace }}
    >
      {places.map(item => <PlaceCard key={item.id} place={item} horizontal cardWidth={cardWidth} onPress={() => onPlacePress(item.id)}/>) }
    </ScrollView>
    {places.length > 1 ? <View style={s.carouselPagination} accessibilityLabel="Place carousel pagination">
      {places.map((item, index) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Show place ${index + 1} of ${places.length}`} accessibilityState={{ selected: activeIndex === index }} onPress={() => { setActiveIndex(index); listRef.current?.scrollTo({ x: index * interval, animated: true }); }} style={[s.carouselDot, activeIndex === index && s.carouselDotActive]}/>) }
    </View> : null}
  </View>;
}

export default function Home() {useTheme(); const s = makeStyles();
  const [reviews, setReviews] = useState<(Review & { user: User })[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [user, setUser] = useState<User>();
  const [selectedArea, setSelectedArea] = useState('All');
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => watchAuthState(authUser => {
    const userId = authUser?.uid ?? (isFirebaseRepositoryEnabled ? '' : 'u1');
    if (!userId) { setUser(undefined); return; }
    foodService.getUser(userId).then(setUser).catch(() => setUser(undefined));
  }), []);

  useEffect(() => {
    let active = true;
    Promise.all([foodService.getReviews(), foodService.getPlaces()]).then(([reviewRows, placeRows]) => {
      if (active) { setReviews(reviewRows); setPlaces(placeRows); setLoadError(''); setLoading(false); }
    }).catch(() => { if (active) { setLoadError('Could not load your List. Check Firebase configuration or switch to mock mode.'); setLoading(false); } });
    return () => { active = false; };
  }, []);

  const place = (id: string) => router.push(`/place/${id}`);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name.split(/\s+/)[0] ?? 'there';
  const today = new Intl.DateTimeFormat('en-AU', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()).toUpperCase();

  return <Page><View style={s.top}><View><Text size={13} weight="600" color={colors.muted}>{today}</Text><Text size={27} weight="700" style={{ marginTop: 5 }}>{greeting}, {firstName}</Text></View>{user ? <Avatar user={user}/> : null}</View>{loadError ? <Text size={12} color={colors.danger} style={{ marginTop: 12 }}>{loadError}</Text> : null}<View style={s.note}><View style={s.noteIcon}><Ionicons name="heart" size={17} color={colors.green}/></View><Text size={13} color={colors.greenDark} style={s.noteText}>Your places, notes, and local standouts.</Text></View><View style={{ marginTop: 28 }}><SectionTitle title="Places on the List" action="See all" onAction={() => router.push('/(tabs)/list')}/>{loading?<ActivityIndicator color={colors.green} style={{marginTop:24}}/>:<PlaceCarousel places={places.slice(0, 4)} onPlacePress={place}/>}</View><View style={{ marginTop: 31 }}><SectionTitle title="A little local love" action="Explore" onAction={() => router.push('/(tabs)/search')}/><Text size={13} color={colors.muted} style={{ marginTop: 5 }}>Places your neighbourhood keeps coming back to.</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 15 }} contentContainerStyle={{ gap: 9 }}>{['All', 'Surry Hills', 'Newtown', 'Bondi', 'Paddington'].map(area => <FilterChip key={area} label={area} selected={selectedArea === area} onPress={() => setSelectedArea(area)} accessibilityLabel={`Show ${area} places`}/>)}</ScrollView><View style={{ gap: 14, marginTop: 14 }}>{places.filter(item => selectedArea === 'All' || item.area === selectedArea).slice(0, 3).map(item => <PlaceCard key={item.id} place={item} onPress={() => place(item.id)}/>)}</View></View><View style={{ marginTop: 32 }}><SectionTitle title="Recent Reviews" action="All reviews" onAction={() => router.push('/(tabs)/search')}/>{reviews.length?reviews.slice(0, 3).map(review => <View key={review.id} style={{ marginTop: 2 }}><ReviewCard review={review}/></View>):!loading?<Text size={13} color={colors.muted} style={{marginTop:10}}>No recent reviews yet. Explore a place and share a note with your people.</Text>:null}</View></Page>;
}

const makeStyles = () => StyleSheet.create({ top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, note: { marginTop: space.lg, padding: space.md, backgroundColor: colors.soft, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: space.sm }, noteText: { flex: 1, flexShrink: 1, maxWidth: 280, lineHeight: 19, color: colors.textSecondary }, noteIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' }, carouselPagination: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, paddingTop: 10 }, carouselDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.line }, carouselDotActive: { width: 20, backgroundColor: colors.green } });
