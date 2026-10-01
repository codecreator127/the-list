import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Page, Rating, Text } from '../../components/ui';
import { Entrance, PressableScale } from '../../components/motion';
import { watchAuthState } from '../../services/auth';
import { foodService } from '../../services/foodService';
import { isFirebaseRepositoryEnabled } from '../../services/firebase';
import type { RankedPlace } from '../../features/myList';
import { colors, radius, useTheme } from '../../theme';

function RankedPlaceCard({ item }: { item: RankedPlace }) {
  const styles = makeStyles();
  const place = item.place;
  return <Entrance delay={Math.min((item.rank - 1) * 40, 240)}>
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Rank ${item.rank}: ${place.name}, rated ${item.rating} out of 10`}
      onPress={() => router.push(`/place/${place.id}`)}
      hoverStyle={{ borderColor: colors.green }}
      style={styles.card}
    >
      <View style={styles.rank}><Text size={13} weight="700" color={colors.green}>#{item.rank}</Text></View>
      {place.image ? <Image source={{ uri: place.image }} style={styles.photo}/> : <View style={[styles.photo, styles.photoFallback]}><Ionicons name="restaurant-outline" size={25} color={colors.green}/></View>}
      <View style={styles.info}>
        <Text size={16} weight="700" numberOfLines={1}>{place.name}</Text>
        <Text size={12} color={colors.muted} numberOfLines={1} style={{ marginTop: 4 }}>{place.cuisine ?? place.category}{place.area ? ` · ${place.area}` : ''}</Text>
        {place.area && place.address && !place.address.toLowerCase().includes(place.area.toLowerCase()) ? <Text size={11} color={colors.muted} numberOfLines={1} style={{ marginTop: 3 }}>{place.address}</Text> : null}
        <View style={{ marginTop: 8 }}><Rating value={item.rating}/></View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted}/>
    </PressableScale>
  </Entrance>;
}

export default function ListScreen() {
  useTheme();
  const styles = makeStyles();
  const [items, setItems] = useState<RankedPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(!isFirebaseRepositoryEnabled);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    let requestId = 0;
    const unsubscribe = watchAuthState(user => {
      const currentRequestId = ++requestId;
      if (isFirebaseRepositoryEnabled && !user) {
        setSignedIn(false);
        setItems([]);
        setLoading(false);
        setError('');
        return;
      }
      setSignedIn(true);
      setLoading(true);
      setError('');
      foodService.getMyList().then(ranked => {
        if (active && requestId === currentRequestId) { setItems(ranked); setLoading(false); }
      }).catch(cause => {
        if (active && requestId === currentRequestId) {
          setError(cause instanceof Error ? cause.message : 'Could not load your List.');
          setLoading(false);
        }
      });
    });
    return () => { active = false; unsubscribe(); };
  }, [retry]));

  return <Page>
    <Text size={30} weight="700">Your List</Text>
    <Text size={14} color={colors.muted} style={{ marginTop: 6, marginBottom: 22, lineHeight: 21 }}>
      Places you’ve tried, ranked by your ratings.
    </Text>

    {loading ? <View style={styles.status}><ActivityIndicator color={colors.green}/><Text size={13} color={colors.muted} style={{ marginTop: 12 }}>Building your List…</Text></View>
      : !signedIn ? <View style={styles.empty}>
        <View style={styles.emptyIcon}><Ionicons name="person-outline" size={24} color={colors.green}/></View>
        <Text size={17} weight="700" style={{ marginTop: 12 }}>Sign in to see your List</Text>
        <Text size={13} color={colors.muted} style={{ marginTop: 6, textAlign: 'center', lineHeight: 19 }}>Your personal rankings are saved with your account.</Text>
        <View style={{ width: '100%', marginTop: 18 }}><Button title="Log in or create an account" icon="person-outline" onPress={() => router.push('/auth')}/></View>
      </View> : error ? <View style={styles.empty}>
        <Text size={15} weight="600">Couldn’t load your List</Text>
        <Text size={13} color={colors.muted} style={{ marginTop: 7, textAlign: 'center' }}>{error}</Text>
        <Button title="Try again" variant="secondary" size="small" onPress={() => setRetry(value => value + 1)} style={{ marginTop: 12 }}/>
      </View> : items.length ? <View>
        <Text size={12} weight="600" color={colors.muted} style={{ marginBottom: 12 }}>{items.length} {items.length === 1 ? 'place' : 'places'} · highest rated first</Text>
        <View style={{ gap: 11 }}>{items.map(item => <RankedPlaceCard key={item.place.id} item={item}/>)}</View>
      </View> : <View style={styles.empty}>
        <View style={styles.emptyIcon}><Ionicons name="list-outline" size={25} color={colors.green}/></View>
        <Text size={17} weight="700" style={{ marginTop: 12 }}>Your List is empty</Text>
        <Text size={13} color={colors.muted} style={{ marginTop: 6, textAlign: 'center', lineHeight: 19 }}>Review a place and it’ll appear here, ranked by your rating.</Text>
        <View style={{ width: '100%', marginTop: 18 }}><Button title="Discover places" icon="search-outline" onPress={() => router.push('/(tabs)/search')}/></View>
      </View>}
  </Page>;
}

const makeStyles = () => StyleSheet.create({
  status: { alignItems: 'center', paddingVertical: 48 },
  empty: { alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.md, padding: 24, borderWidth: 1, borderColor: colors.line },
  emptyIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: colors.white, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line },
  rank: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lime },
  photo: { width: 72, height: 72, borderRadius: 12, backgroundColor: colors.soft },
  photoFallback: { alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, minWidth: 0 },
});
