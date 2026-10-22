import { ReviewPhoto } from '../../components/ReviewPhoto';
import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Image, ScrollView, View } from 'react-native';
import { Avatar, Button, Card, Page, Rating, SectionTitle, Text } from '../../components/ui';
import { PressableScale } from '../../components/motion';
import { foodService } from '../../services/foodService';
import { watchAuthState } from '../../services/auth';
import { isFirebaseRepositoryEnabled } from '../../services/firebase';
import type { HomeData, HomeReview } from '../../services/personalizedData';
import type { Place } from '../../types/models';
import { colors, typefaces, useTheme } from '../../theme';

function Attribution({place}: {place: Place}) {
  return place.googlePlaceId && !place.googlePlaceId.startsWith('mock:') ? <Text size={9} color={colors.textMuted} numberOfLines={1} style={{marginTop: 6}}>{place.photoAttributions?.[0] ? `Photo: ${place.photoAttributions[0].displayName} · ` : ''}Google Maps</Text> : null;
}
function ActivityCard({review, friend = false}: {review: HomeReview; friend?: boolean}) {
  return <Card style={{marginTop: 12}}>
    {friend ? <PressableScale accessibilityRole="button" accessibilityLabel={`View ${review.user.name}'s profile`} onPress={() => router.push(`/user/${review.userId}`)} style={{flexDirection: 'row', gap: 9, alignItems: 'center', marginBottom: 12}}>
      <Avatar user={review.user} size={30}/><View style={{flex: 1}}><Text size={12} weight="600">{review.user.name}</Text><Text size={10} color={colors.textMuted}>{review.date}</Text></View>
    </PressableScale> : null}
    <PressableScale accessibilityRole="button" accessibilityLabel={`Open ${review.place.name}, rated ${review.rating.toFixed(2)} out of 5`} onPress={() => router.push(`/place/${review.placeId}`)} style={{gap: 8}}>
      <Text size={16} weight="600">{review.place.name}</Text>
      <View style={{flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap'}}><Rating value={review.rating} size={12}/><Text size={11} color={colors.textMuted}>{review.place.area}{!friend ? ` · ${review.date}` : ''}</Text></View>
      {review.text ? <Text size={13} color={colors.textSecondary} numberOfLines={2}>{review.text}</Text> : null}
      <Attribution place={review.place}/>{review.photo ? <ReviewPhoto uri={review.photo.url} /> : null}
    </PressableScale>
  </Card>;
}
function EmptySection({message, action, onPress}: {message: string; action?: string; onPress?: () => void}) {
  return <View style={{paddingVertical: 17}}><Text size={13} color={colors.textMuted} style={{lineHeight: 20}}>{message}</Text>{action && onPress ? <Button title={action} size="small" variant="ghost" onPress={onPress} style={{alignSelf: 'flex-start', marginTop: 7}}/> : null}</View>;
}
export default function Home() {
  useTheme();
  const [data, setData] = useState<HomeData>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    let request = 0;
    const unsubscribe = watchAuthState(user => {
      const requestId = ++request;
      setData(undefined); setError('');
      if (isFirebaseRepositoryEnabled && !user) { setLoading(false); return; }
      setLoading(true);
      foodService.getHomeData().then(result => {
        if (active && request === requestId) { setData(result); setLoading(false); }
      }).catch(cause => {
        if (active && request === requestId) { setError(cause instanceof Error ? cause.message : 'Could not load your activity.'); setLoading(false); }
      });
    });
    return () => { active = false; request++; unsubscribe(); };
  }, [retry]));
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const explore = () => router.push('/(tabs)/search');
  const friends = () => router.push('/(tabs)/friends');
  return <Page>
    <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}><View style={{flex: 1}}><Text size={10} color={colors.accent} style={{fontFamily: typefaces.mono, letterSpacing: 2}}>FOR YOU</Text><Text size={29} style={{marginTop: 6}}>{greeting}{data ? `, ${data.user.name.split(/\s+/)[0]}` : ''}</Text><Text size={13} color={colors.textMuted} style={{marginTop: 7}}>Your latest meals. A few tips from your people.</Text></View>{data ? <Avatar user={data.user} size={42}/> : null}</View>
    {loading ? <View style={{padding: 40, alignItems: 'center'}}><ActivityIndicator color={colors.accent}/><Text size={13} color={colors.textMuted} style={{marginTop: 12}}>Gathering your places…</Text></View>
      : error ? <Card style={{marginTop: 24}}><Text size={16} weight="600">Couldn’t load For You</Text><Text size={13} color={colors.error} style={{marginTop: 8}}>{error}</Text><Button title="Try again" variant="secondary" onPress={() => setRetry(value => value + 1)} style={{marginTop: 14}}/></Card>
      : !data ? <EmptySection message="Sign in to see your recent meals and friends’ favourites." action="Log in" onPress={() => router.push('/auth')}/>
      : <>
        {data.unavailablePlaces ? <View style={{marginTop: 18}}><Text size={12} color={colors.textMuted}>Some restaurant details are unavailable right now.</Text><Button title="Retry details" size="small" variant="ghost" onPress={() => setRetry(value => value + 1)} style={{alignSelf: 'flex-start'}}/></View> : null}
        <View style={{marginTop: 28}}><SectionTitle title="Recent Activity" action="Your List" onAction={() => router.push('/(tabs)/list')}/><Text size={12} color={colors.textMuted}>Places you’ve recently reviewed or updated.</Text>
          {data.recent.length ? data.recent.map(review => <ActivityCard key={review.id} review={review}/>) : <EmptySection message={data.unavailablePlaces ? 'Your recent restaurants could not be displayed. Try loading their details again.' : 'Your first review starts your List. Find somewhere good and leave a rating.'} action="Explore places" onPress={explore}/>}
        </View>
        <View style={{marginTop: 28}}><SectionTitle title="Highly Rated by Friends"/><Text size={12} color={colors.textMuted} style={{marginTop: 6}}>4.00+ from recent friend reviews, with new-to-you places first.</Text>
          {data.highlyRated.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 14, paddingVertical: 14}}>
            {data.highlyRated.map(item => <View key={item.place.id} style={{width: 250}}><PressableScale accessibilityRole="button" accessibilityLabel={`Open ${item.place.name}, friends average ${item.average.toFixed(2)}`} onPress={() => router.push(`/place/${item.place.id}`)} style={{backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 3, overflow: 'hidden'}}>
              {item.place.image ? <Image source={{uri: item.place.image}} style={{width: '100%', height: 128, backgroundColor: colors.surfaceStrong}}/> : <View style={{height: 70, backgroundColor: colors.surfaceStrong}}/>}
              <View style={{padding: 14}}><Text size={16} weight="600" numberOfLines={1}>{item.place.name}</Text><Text size={11} color={colors.textMuted} style={{marginTop: 4}}>{item.place.cuisine ?? item.place.category} · {item.place.area}</Text><View style={{marginTop: 10}}><Rating value={item.average} size={13}/></View><Text size={11} color={colors.textSecondary} style={{marginTop: 5}}>{item.friendCount} {item.friendCount === 1 ? 'friend' : 'friends'} · {item.reviewed ? 'On your List' : 'New to your List'}</Text><Attribution place={item.place}/></View>
            </PressableScale></View>)}
          </ScrollView> : <EmptySection message={!data.friendCount ? 'Add a few friends to discover their favourite places.' : data.unavailablePlaces ? 'Some suggestions could not be displayed. Try loading their details again.' : 'No places rated 4.00 or higher in your friends’ recent reviews yet.'} action={!data.friendCount ? 'Find friends' : 'Explore places'} onPress={!data.friendCount ? friends : explore}/>}
        </View>
        <View style={{marginTop: 28}}><SectionTitle title="Friends’ Activity" action="Friends" onAction={friends}/><Text size={12} color={colors.textMuted}>A few recent notes from your table.</Text>
          {data.activity.length ? data.activity.map(review => <ActivityCard key={review.id} review={review} friend/>) : <EmptySection message={!data.friendCount ? 'Good recommendations start with people you trust.' : data.unavailablePlaces ? 'Recent friend activity could not be displayed. Try loading restaurant details again.' : 'Your friends haven’t shared any recent reviews yet.'} action={!data.friendCount ? 'Find friends' : undefined} onPress={friends}/>}
        </View>
      </>}
  </Page>;
}
