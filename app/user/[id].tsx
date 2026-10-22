import { useCallback, useState } from 'react';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, BackButton, Button, Page, RatingStars, SectionTitle, Text } from '../../components/ui';
import { PressableScale } from '../../components/motion';
import { foodService } from '../../services/foodService';
import type { RankedPlace } from '../../features/myList';
import type { User } from '../../types/models';
import { colors, radius, typefaces, useTheme } from '../../theme';

function FriendListEntry({ item }: { item: RankedPlace }) {
  const place = item.place;
  const styles = makeStyles();
  return <PressableScale
    accessibilityRole="button"
    accessibilityLabel={`Rank ${item.rank}: ${place.name}, rated ${item.rating.toFixed(2)} out of 5.00`}
    onPress={() => router.push(`/place/${place.id}`)}
    hoverStyle={{ borderColor: colors.accentHover }}
    style={styles.card}
  >
    <Text size={11} color={colors.accent} style={styles.rank}>{String(item.rank).padStart(2, '0')}</Text>
    {place.image ? <Image source={{ uri: place.image }} style={styles.photo}/> : <View style={[styles.photo, styles.photoFallback]}><Ionicons name="restaurant-outline" size={23} color={colors.accent}/></View>}
    <View style={styles.info}>
      <Text size={14} weight="600" numberOfLines={1}>{place.name}</Text>
      <Text size={10} color={colors.textMuted} numberOfLines={1} style={{ marginTop: 3 }}>{place.cuisine ?? place.category}{place.area ? ` · ${place.area}` : ''}</Text>
      <View style={styles.stars}><RatingStars value={item.rating} size={11}/></View>
    </View>
    <Text size={14} weight="600" color={colors.textPrimary} style={styles.score}>{item.rating.toFixed(2)}<Text size={9} color={colors.textMuted}>/5.00</Text></Text>
  </PressableScale>;
}

export default function FriendProfileScreen() {
  useTheme();
  const styles = makeStyles();
  const params = useLocalSearchParams<{ id: string }>();
  const userId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [user, setUser] = useState<User>();
  const [items, setItems] = useState<RankedPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([foodService.getUser(userId), foodService.getUserList(userId)]).then(([profile, list]) => {
      if (active) { setUser(profile); setItems(list); }
    }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : 'Could not load this friend’s List.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId, retry]));

  return <Page maxWidth={920}>
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
      <BackButton onPress={() => router.back()}/>
      <Text size={16} weight="600" style={{ marginLeft: 12 }}>Friend profile</Text>
    </View>
    {user ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, marginBottom: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
      <Avatar user={user} size={60}/>
      <View style={{ flex: 1 }}>
        <Text size={21} weight="700">{user.name}</Text>
        <Text size={13} color={colors.textMuted} style={{ marginTop: 4 }}>@{user.username ?? user.handle}</Text>
      </View>
    </View> : null}
    <View style={{ marginBottom: 8 }}><SectionTitle title={user ? `${user.name}’s List` : 'Their List'}/></View>
    <Text size={12} color={colors.textMuted} style={{ marginBottom: 12 }}>A personal ranking, shared with friends. This List is read-only.</Text>
    {loading ? <View style={{ alignItems: 'center', paddingVertical: 42 }}><ActivityIndicator color={colors.accent}/><Text size={12} color={colors.textMuted} style={{ marginTop: 10 }}>Loading their List…</Text></View>
      : error ? <View style={{ alignItems: 'center', paddingVertical: 28, paddingHorizontal: 12, backgroundColor: colors.surface }}>
        <Text size={15} weight="600">Couldn’t open this List</Text>
        <Text size={13} color={colors.textMuted} style={{ marginTop: 7, textAlign: 'center' }}>{error}</Text>
        <Button title="Try again" size="small" variant="secondary" onPress={() => setRetry(value => value + 1)} style={{ marginTop: 12 }}/>
      </View>
      : items.length ? <View style={styles.list}>{items.map(item => <FriendListEntry key={item.place.id} item={item}/>)}</View>
        : <View style={{ alignItems: 'center', paddingVertical: 38, paddingHorizontal: 15, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Ionicons name="list-outline" size={25} color={colors.accent}/>
          <Text size={16} weight="600" style={{ marginTop: 12 }}>Their List is empty</Text>
          <Text size={13} color={colors.textMuted} style={{ marginTop: 6, textAlign: 'center', lineHeight: 19 }}>Places they review will appear here, ranked by their rating.</Text>
        </View>}
  </Page>;
}

function makeStyles() { return StyleSheet.create({
  list: { width: '100%', paddingHorizontal: 24, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border },
  card: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 11, borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 11 },
  rank: { width: 20, fontFamily: typefaces.mono, letterSpacing: 1 },
  photo: { width: 58, height: 58, borderRadius: radius.sm, backgroundColor: colors.surfaceStrong },
  photoFallback: { alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, minWidth: 0 },
  stars: { flexDirection: 'row', gap: 1, marginTop: 5 },
  score: { minWidth: 27, textAlign: 'right', fontFamily: typefaces.serif },
}); }
