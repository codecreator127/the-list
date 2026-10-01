import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Page, Text } from '../../components/ui';
import { Entrance, PressableScale } from '../../components/motion';
import { watchAuthState } from '../../services/auth';
import { foodService } from '../../services/foodService';
import { isFirebaseRepositoryEnabled } from '../../services/firebase';
import type { RankedPlace } from '../../features/myList';
import { colors, typefaces, useTheme } from '../../theme';

function RankedPlaceCard({ item }: { item: RankedPlace }) {
  const styles = makeStyles();
  const place = item.place;
  const starFill = item.rating / 2;
  return <Entrance delay={Math.min((item.rank - 1) * 40, 240)}>
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Rank ${item.rank}: ${place.name}, rated ${item.rating} out of 10`}
      onPress={() => router.push(`/place/${place.id}`)}
      hoverStyle={{ borderColor: colors.accentHover }}
      style={styles.card}
    >
      <Text size={11} color={colors.accent} style={styles.rank}>{String(item.rank).padStart(2, '0')}</Text>
      {place.image ? <Image source={{ uri: place.image }} style={styles.photo}/> : <View style={[styles.photo, styles.photoFallback]}><Ionicons name="restaurant-outline" size={23} color={colors.accent}/></View>}
      <View style={styles.info}>
        <Text size={14} weight="600" numberOfLines={1}>{place.name}</Text>
        <Text size={10} color={colors.textMuted} numberOfLines={1} style={{ marginTop: 3 }}>{place.cuisine ?? place.category}{place.area ? ` · ${place.area}` : ''}</Text>
        <View style={styles.stars} accessibilityLabel={`${item.rating.toFixed(1)} out of 10`}>{Array.from({ length: 5 }, (_, index) => <Ionicons key={index} name="star" size={11} color={index < starFill ? colors.rating : colors.border}/>)}</View>
      </View>
      <Text size={14} weight="600" color={colors.textPrimary} style={styles.score}>{item.rating.toFixed(1)}<Text size={9} color={colors.textMuted}>/10</Text></Text>
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

  return <Page maxWidth={920}>
    <View style={styles.ledger}>
        <View style={styles.ledgerHeader}><Text size={10} weight="600" color={colors.textSecondary} style={styles.mono}>MY LIST</Text><View style={styles.profileDot}><Ionicons name="person" size={12} color={colors.onAccent}/></View></View>
        <View style={styles.listIntro}><Text size={10} color={colors.textMuted} style={styles.mono}>YOUR PLACES</Text><View style={styles.count}><Text size={31} color={colors.textPrimary} style={styles.serif}>{items.length}</Text><Text size={10} color={colors.textMuted}> {items.length === 1 ? 'spot' : 'spots'}</Text></View></View>

        {loading ? <View style={styles.status}><ActivityIndicator color={colors.accent}/><Text size={12} color={colors.textMuted} style={{ marginTop: 12 }}>Building your List…</Text></View>
          : !signedIn ? <View style={styles.empty}><Ionicons name="person-outline" size={24} color={colors.accent}/><Text size={16} weight="600" style={{ marginTop: 12 }}>Sign in to see your List</Text><Text size={13} color={colors.textMuted} style={{ marginTop: 6, textAlign: 'center', lineHeight: 19 }}>Your personal rankings are saved with your account.</Text><Button title="Log in or create an account" icon="person-outline" onPress={() => router.push('/auth')} style={{ marginTop: 17 }}/></View>
          : error ? <View style={styles.empty}><Text size={15} weight="600">Couldn’t load your List</Text><Text size={13} color={colors.textMuted} style={{ marginTop: 7, textAlign: 'center' }}>{error}</Text><Button title="Try again" variant="secondary" size="small" onPress={() => setRetry(value => value + 1)} style={{ marginTop: 12 }}/></View>
          : items.length ? <View>{items.map(item => <RankedPlaceCard key={item.place.id} item={item}/>)}</View>
          : <View style={styles.empty}><Ionicons name="list-outline" size={25} color={colors.accent}/><Text size={16} weight="600" style={{ marginTop: 12 }}>Your List is empty</Text><Text size={13} color={colors.textMuted} style={{ marginTop: 6, textAlign: 'center', lineHeight: 19 }}>Review a place and it’ll appear here, ranked by your rating.</Text></View>}

        <View style={styles.ledgerFooter}><PressableScale accessibilityRole="button" accessibilityLabel="Add a place to your List" onPress={() => router.push('/(tabs)/search')} style={styles.addPlace}><Ionicons name="add" size={17} color={colors.textPrimary}/><Text size={11} weight="600">Add a place</Text></PressableScale><Text size={9} color={colors.textMuted} style={styles.mono}>{loading ? 'LOADING' : 'RANKED BY YOUR RATING'}</Text></View>
    </View>
  </Page>;
}

const makeStyles = () => StyleSheet.create({
  ledger: { width: '100%', maxWidth: 920, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 22, paddingBottom: 18, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border },
  ledgerHeader: { minHeight: 38, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 14 },
  mono: { fontFamily: typefaces.mono, letterSpacing: 1 },
  profileDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  listIntro: { minHeight: 70, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: 14 },
  count: { flexDirection: 'row', alignItems: 'baseline' },
  serif: { fontFamily: typefaces.serif },
  status: { alignItems: 'center', paddingVertical: 46, borderTopWidth: 1, borderTopColor: colors.border },
  empty: { alignItems: 'center', paddingHorizontal: 15, paddingVertical: 38, borderTopWidth: 1, borderTopColor: colors.border },
  card: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 11, borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 11 },
  rank: { width: 20, fontFamily: typefaces.mono, letterSpacing: 1 },
  photo: { width: 58, height: 58, borderRadius: 2, backgroundColor: colors.surfaceStrong },
  photoFallback: { alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, minWidth: 0 },
  stars: { flexDirection: 'row', gap: 1, marginTop: 5 },
  score: { minWidth: 27, textAlign: 'right', fontFamily: typefaces.serif },
  ledgerFooter: { minHeight: 39, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 13, marginTop: 2 },
  addPlace: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
