import { useCallback, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Image, Linking, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BackButton, Button, Page, Rating, ReviewCard, Text, Badge } from '../../../components/ui';
import { PressableScale } from '../../../components/motion';
import { foodService } from '../../../services/foodService';
import type { Place, Review, User } from '../../../types/models';
import { colors, radius, useTheme } from '../../../theme';
import { parseCombinedParticipants } from '../../../features/combinedList';
import { acceptedFriendIds } from '../../../features/personalization';
import { firebaseAuth } from '../../../services/auth';
import { isFirebaseRepositoryEnabled } from '../../../services/firebase';

export default function PlaceScreen() {
  useTheme();
  const s = makeStyles();
  const { id, from, combinedUsers } = useLocalSearchParams<{ id: string; from?: string; combinedUsers?: string }>();
  const [combined,setCombined]=useState<Awaited<ReturnType<typeof foodService.getRestaurantDetails>>['combined']>();
  const [place, setPlace] = useState<Place>();
  const [reviews, setReviews] = useState<(Review & { user: User })[]>([]);
  const [myReview, setMyReview] = useState<Review>();
  const [friendReviews, setFriendReviews] = useState<(Review & { user: User })[]>([]);
  const [friendAverage, setFriendAverage] = useState<number>();
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState('');

  useFocusEffect(useCallback(() => {
    let active = true;
    setError('');
    setLoading(true);
    setFriendReviews([]);
    setCombined(undefined);
    let ids:string[]|undefined;
    try { ids=parseCombinedParticipants(combinedUsers); }
    catch(cause){setError(cause instanceof Error?cause.message:'Invalid participants.');setLoading(false);return;}
    let lastFriendIds:string|undefined;
    const stopFriendships=ids?foodService.watchMyFriendships(rows=>{
      if(!active)return;
      const uid=isFirebaseRepositoryEnabled?firebaseAuth?.currentUser?.uid??'':'u1';
      const signature=acceptedFriendIds(uid,rows).sort().join(',');
      if(lastFriendIds!==undefined && signature!==lastFriendIds){setCombined(undefined);setLoading(true);setRetry(value=>value+1);}
      lastFriendIds=signature;
    },()=>{if(active){setCombined(undefined);setError('Could not verify Combined List access. Return to your List and try again.');}}):()=>{};
    foodService.getRestaurantDetails(id,ids)
      .then(({place: found, reviews: rows, myReview: ownReview, friendReviews: friends, friendAverage: average,combined:combinedResult}) => {
        if (!active) return;
        setPlace(found);
        setReviews(rows);
        setMyReview(ownReview);
        setFriendReviews(friends);
        setFriendAverage(average);
        setCombined(combinedResult);
        setLoading(false);
        if (!found) setError('This place could not be found.');
      })
      .catch(cause => {
        if (active) { setError(cause instanceof Error ? cause.message : 'Could not load this place.'); setLoading(false); }
      });
    return () => { active = false;stopFriendships(); };
  }, [id, retry, combinedUsers]));

  const goToMain = () => {
    if(from==='combined'){if(router.canGoBack())router.back();else router.replace('/combined-list');return;}
    if (from === 'search') {
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/search');
      return;
    }
    router.replace('/(tabs)/home');
  };

  if (error) return <Page>
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}><BackButton onPress={goToMain} /></View>
    <Text size={16} weight="600">Couldn’t load this place</Text>
    <Text size={13} color={colors.muted} style={{ marginTop: 7, lineHeight: 20 }}>{error}</Text>
    <Button title="Try again" variant="secondary" onPress={() => setRetry(value => value + 1)} style={{marginTop: 14}}/>
  </Page>;
  if (loading || !place) return <Page><Text>Finding this place…</Text></Page>;

  const openMap = () => {
    const placeId = place.googlePlaceId && !place.googlePlaceId.startsWith('mock:') ? place.googlePlaceId : undefined;
    const query = placeId ? place.name : place.latitude !== undefined && place.longitude !== undefined ? `${place.latitude},${place.longitude}` : place.address;
    const placeIdParam = placeId ? `&query_place_id=${encodeURIComponent(placeId)}` : '';
    void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}${placeIdParam}`);
  };

  return <Page>
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
      <BackButton onPress={goToMain} /><Text size={14} weight="600" style={{ marginLeft: 12 }}>The List</Text>
    </View>
    <View style={s.hero}>
      {place.image ? <Image source={{ uri: place.image }} style={s.image} /> : <View style={[s.image, { backgroundColor: colors.greenDark }]} />}
      <View style={s.overlay} />
      <View style={s.title}>
        <Badge>{place.cuisine ?? place.category}</Badge>
        <Text size={30} weight="700" color="white" style={{ marginTop: 10 }}>{place.name}</Text>
        <Text size={13} color="#F1F1EA" style={{ marginTop: 4 }}>{place.area || 'Sydney'}{place.price ? ` · ${place.price}` : ''}</Text>
      </View>
    </View>
    <View style={s.score}>
      <View>
        <Text size={12} weight="600" color={colors.muted}>THE LIST</Text>
        {place.reviewCount > 0 ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 4 }}>
          <Rating value={place.averageRating} /><Text size={12} color={colors.muted}>{place.reviewCount} {place.reviewCount === 1 ? 'review' : 'reviews'}</Text>
        </View> : <Text size={15} weight="600" style={{ marginTop: 5 }}>No List reviews yet</Text>}
      </View>
    </View>
    {combined?<View style={{marginTop:18,padding:16,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,backgroundColor:colors.surfaceElevated}}>
      <Text size={13} weight="700">Your Combined List</Text>
      <Text size={18} weight="700" color={colors.accent} style={{marginTop:7}}>{combined.rating.toFixed(2)} · {combined.reviewerCount} {combined.reviewerCount===1?'review':'reviews'}</Text>
      <Text size={12} color={colors.textMuted} style={{marginTop:5}}>Average of these individual ratings</Text>
      {combined.contributions.map(row=><View key={row.userId} style={{flexDirection:'row',justifyContent:'space-between',gap:12,paddingTop:12}}><Text size={13} style={{flex:1}}>{row.user.name}</Text><Rating value={row.rating} size={13}/></View>)}
    </View>:combinedUsers?<View style={{marginTop:18}}><Text size={13} color={colors.textMuted}>No selected participants have reviewed this restaurant.</Text></View>:null}
    {place.googleRating !== undefined ? <View style={s.googleRating}>
      <Ionicons name="star" size={15} color={colors.star} /><Text size={13} weight="600">{place.googleRating.toFixed(1)}</Text><Text size={12} color={colors.muted}>Google rating</Text>
    </View> : null}
    {place.googlePlaceId && !place.googlePlaceId.startsWith('mock:') && place.photoAttributions?.[0] ? <Pressable onPress={() => place.photoAttributions?.[0].uri && Linking.openURL(place.photoAttributions[0].uri!)}>
      <Text size={10} color={colors.muted} style={{ marginTop: 7 }}>Photo: {place.photoAttributions[0].displayName}</Text>
    </Pressable> : null}
    {place.description ? <Text size={14} color={colors.textSecondary} style={{ lineHeight: 22, marginTop: 16 }}>{place.description}</Text> : null}
    <PressableScale accessibilityRole="button" accessibilityLabel="View restaurant on map" onPress={openMap} hoverStyle={{borderColor:colors.accent}} style={s.address}>
      <Ionicons name="location-outline" size={19} color={colors.green} />
      <View style={{ flex: 1 }}>
        <Text size={13} weight="600">{place.address || place.area}</Text>
        <Text size={11} color={colors.muted} style={{ marginTop: 3 }}>{place.latitude !== undefined && place.longitude !== undefined ? `${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)} · View on map` : 'Sydney, NSW · View on map'}</Text>
      </View>
      <Ionicons name="open-outline" size={17} color={colors.muted} />
    </PressableScale>
    {place.googlePlaceId && !place.googlePlaceId.startsWith('mock:') ? <Text size={11} color={colors.muted} style={{ marginTop: 8 }}>Google Maps</Text> : null}
    <View style={{ marginTop: 24 }}>
      {myReview ? <View style={s.ownReview}>
        <Ionicons name="checkmark-circle-outline" size={19} color={colors.green} />
        <View style={{ flex: 1, minWidth:120 }}>
          <Text size={13} weight="600">You’ve reviewed this place</Text>
          <Text size={11} color={colors.muted} style={{ marginTop: 3 }}>Your {myReview.rating.toFixed(2)} / 5.00 rating is on your List.</Text>
        </View>
        <Button title="Edit review" icon="create-outline" variant="ghost" size="small" onPress={() => router.push(`/review/${place.id}?mode=edit`)} />
      </View> : <Button title="Write a review" icon="create-outline" onPress={() => router.push(`/review/${place.id}`)} />}
    </View>
    <View style={{marginTop: 30}}>
      <Text size={20} weight="700">From your friends</Text>
      {friendReviews.length > 1 && friendAverage !== undefined ? <View style={{marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap'}}><Rating value={friendAverage}/><Text size={12} color={colors.textMuted}>Average from {friendReviews.length} friends</Text></View> : null}
      {friendReviews.length ? friendReviews.map(review => <ReviewCard key={review.id} review={review} onAuthorPress={() => router.push(`/user/${review.userId}`)}/>)
        : <View style={[s.empty, {marginTop: 12}]}><Text size={13} color={colors.textMuted}>None of your friends have reviewed this place yet.</Text><Button title="Find friends" variant="ghost" size="small" onPress={() => router.push('/(tabs)/friends')} style={{marginTop: 8}}/></View>}
    </View>
    <View style={{ marginTop: 30, marginBottom: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text size={20} weight="700">Notes from the List</Text>
      <Text size={12} weight="600" color={colors.green}>{reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}</Text>
    </View>
    {reviews.length ? reviews.map(review => <ReviewCard key={review.id} review={review} />) : <View style={s.empty}><Text size={14} color={colors.muted}>Be the first to leave a note for this place.</Text></View>}
  </Page>;
}

const makeStyles = () => StyleSheet.create({
  hero: { height: 250, borderRadius: radius.lg, overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: colors.green },
  image: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(22,34,26,.34)' },
  title: { padding: 19 },
  score: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 },
  googleRating: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 13, paddingHorizontal: 11, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  address: { marginTop: 18, padding: 14, borderRadius: radius.md, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderColor: colors.line },
  ownReview: { minHeight: 58, padding: 16, borderWidth:1,borderColor:colors.border,borderRadius: radius.md, backgroundColor: colors.surface, flexDirection: 'row', flexWrap:'wrap',alignItems: 'center', gap: 12 },
  empty: { padding: 20, backgroundColor: colors.white, borderRadius: radius.md, alignItems: 'center' },
});
