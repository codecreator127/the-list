import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { Avatar, Button, Input, Page, SectionTitle, Text } from '../../components/ui';
import { PressableScale } from '../../components/motion';
import { foodService } from '../../services/foodService';
import { isFirebaseRepositoryEnabled } from '../../services/firebase';
import { watchAuthState } from '../../services/auth';
import type { Friendship } from '../../services/repositories';
import type { User } from '../../types/models';
import { colors, radius } from '../../theme';

function relationshipId(userA: string, userB: string) {
  return [userA, userB].sort().join('_');
}

type FriendRow = { friendship: Friendship; user: User };

export default function FriendsScreen() {
  const [userId, setUserId] = useState('');
  const [signedIn, setSignedIn] = useState(!isFirebaseRepositoryEnabled);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [incoming, setIncoming] = useState<FriendRow[]>([]);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [searchError, setSearchError] = useState('');

  const refreshSocial = useCallback(async (id: string) => {
    const rows = await foodService.listFriendships();
    const rowsWithProfiles = await Promise.all(rows.map(async friendship => {
      const otherId = friendship.userIds.find(memberId => memberId !== id);
      if (!otherId) return undefined;
      return { friendship, user: await foodService.getUser(otherId) };
    }));
    const validRows = rowsWithProfiles.filter((row): row is FriendRow => !!row);
    setFriendships(rows);
    setFriends(validRows.filter(row => row.friendship.status === 'accepted'));
    setIncoming(validRows.filter(row => row.friendship.status === 'pending' && row.friendship.recipientId === id));
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    const unsubscribe = watchAuthState(authUser => {
      const id = authUser?.uid ?? (isFirebaseRepositoryEnabled ? '' : 'u1');
      setUserId(id);
      setSignedIn(!!id);
      if (!id) {
        setFriendships([]);
        setFriends([]);
        setIncoming([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      refreshSocial(id).catch(cause => {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load friends.');
      }).finally(() => {
        if (active) setLoading(false);
      });
    });
    return () => { active = false; unsubscribe(); };
  }, [refreshSocial]));

  useEffect(() => {
    let active = true;
    const query = search.trim().replace(/^@/, '').toLowerCase();
    if (!query || !signedIn) {
      setResults([]);
      setSearchError('');
      setSearching(false);
      return () => { active = false; };
    }

    setResults([]);
    setSearching(true);
    const timer = setTimeout(() => {
      setSearchError('');
      foodService.searchUsers(query).then(rows => {
        if (active) setResults(rows);
      }).catch(cause => {
        if (active) {
          setResults([]);
          setSearchError(cause instanceof Error ? cause.message : 'Could not search users.');
        }
      }).finally(() => {
        if (active) setSearching(false);
      });
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search, signedIn]);

  async function findUsers() {
    const query = search.trim().replace(/^@/, '').toLowerCase();
    if (!query) {
      setResults([]);
      setSearchError('');
      return;
    }
    setSearching(true);
    setSearchError('');
    try {
      setResults(await foodService.searchUsers(query));
    } catch (cause) {
      setSearchError(cause instanceof Error ? cause.message : 'Could not search users.');
    } finally {
      setSearching(false);
    }
  }

  async function retryLoad() {
    if (!userId) return;
    setLoading(true);
    setError('');
    try {
      await refreshSocial(userId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load friends.');
    } finally {
      setLoading(false);
    }
  }

  async function runAction(id: string, action: () => Promise<void>) {
    setBusyId(id);
    setError('');
    try {
      await action();
      await refreshSocial(userId);
      if (search.trim()) await findUsers();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update this friendship.');
    } finally {
      setBusyId('');
    }
  }

  function statusFor(user: User) {
    return friendships.find(row => row.id === relationshipId(userId, user.id));
  }

  function profileCard(user: User, friendship: Friendship, trailing?: ReactNode) {
    return <View key={friendship.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, marginTop: 9, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <PressableScale accessibilityRole="button" accessibilityLabel={`View ${user.name}'s profile`} onPress={() => router.push(`/user/${user.id}`)} style={{ width: '100%', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar user={user} size={44}/>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text size={14} weight="700" numberOfLines={1}>{user.name}</Text>
            <Text size={12} color={colors.textMuted} numberOfLines={1} style={{ marginTop: 2 }}>@{user.username ?? user.handle}</Text>
          </View>
        </PressableScale>
      </View>
      {trailing ? <View style={{ width: 170, flexShrink: 0, alignItems: 'flex-end', justifyContent: 'center' }}>{trailing}</View> : null}
    </View>;
  }

  return <Page>
    <Text size={30} weight="700">Friends</Text>
    <Text size={14} color={colors.textMuted} style={{ marginTop: 6, marginBottom: 22 }}>Find people and see what’s on their List.</Text>
    {!signedIn ? <View style={{ padding: 20, backgroundColor: colors.surface, borderRadius: radius.md, alignItems: 'center' }}>
      <Text size={15} weight="600">Sign in to find friends</Text>
      <Text size={13} color={colors.textMuted} style={{ marginTop: 6, textAlign: 'center' }}>Friend requests and Lists are connected to your account.</Text>
      <Button title="Log in or create an account" icon="person-outline" onPress={() => router.push('/auth')} style={{ marginTop: 15 }}/>
    </View> : <>
      <Text size={12} color={colors.textMuted} style={{ marginBottom: 8 }}>Results update as you type; usernames are not case-sensitive.</Text>
      <View style={{ flexDirection: 'row', gap: 9, alignItems: 'center' }}>
        <Input value={search} onChangeText={setSearch} onSubmitEditing={findUsers} returnKeyType="search" autoCapitalize="none" autoCorrect={false} placeholder="Search by username" accessibilityLabel="Search by username" style={{ flex: 1 }}/>
        <Button title="Search" size="small" loading={searching} disabled={searching} onPress={findUsers}/>
      </View>
      {searchError ? <Text size={12} color={colors.error} style={{ marginTop: 9 }}>{searchError}</Text> : null}
      {searching ? <View style={{ padding: 18, alignItems: 'center' }}><ActivityIndicator color={colors.accent}/></View>
        : results.length ? <View style={{ marginTop: 18 }}>
          <SectionTitle title="Search results"/>
          {results.map(user => {
            const friendship = statusFor(user);
            const busy = busyId === user.id;
            let controls: ReactNode;
            if (friendship?.status === 'accepted') {
              controls = <Text size={11} weight="700" color={colors.accent}>Friends</Text>;
            } else if (friendship?.status === 'pending' && friendship.requesterId === userId) {
              controls = <Button title={busy ? 'Canceling…' : 'Request sent'} size="small" variant="secondary" disabled={busy} onPress={() => runAction(user.id, () => foodService.respondToFriendRequest(friendship.id, 'cancelled'))}/>;
            } else if (friendship?.status === 'pending') {
              controls = <View style={{ flexDirection: 'row', gap: 5 }}><Button title="Accept" size="small" loading={busy} disabled={busy} onPress={() => runAction(user.id, () => foodService.respondToFriendRequest(friendship.id, 'accepted'))}/><Button title="Decline" size="small" variant="ghost" disabled={busy} onPress={() => runAction(user.id, () => foodService.respondToFriendRequest(friendship.id, 'declined'))}/></View>;
            } else {
              controls = <Button title={busy ? 'Sending…' : 'Add friend'} size="small" loading={busy} disabled={busy} onPress={() => runAction(user.id, () => foodService.sendFriendRequest(user.id))}/>;
            }
            const row = friendship ?? { id: `search-${user.id}`, userIds: [userId, user.id] as [string, string], requesterId: '', recipientId: '', status: 'declined' as const };
            return profileCard(user, row, controls);
          })}
        </View>
        : search.trim() && !searchError ? <Text size={13} color={colors.textMuted} style={{ marginTop: 16 }}>No users found for “{search.trim()}”. Try a username.</Text> : null}
      {error ? <View style={{ marginTop: 12 }}><Text size={12} color={colors.error}>{error}</Text><Button title="Try again" size="small" variant="secondary" onPress={retryLoad} style={{ alignSelf: 'flex-start', marginTop: 7 }}/></View> : null}
      <View style={{ marginTop: 26, marginBottom: 10 }}><SectionTitle title="Incoming requests"/></View>
      {loading ? <View style={{ paddingVertical: 22, alignItems: 'center' }}><ActivityIndicator color={colors.accent}/><Text size={12} color={colors.textMuted} style={{ marginTop: 8 }}>Loading your friends…</Text></View>
        : incoming.length ? incoming.map(({ friendship, user }) => profileCard(user, friendship, <View style={{ flexDirection: 'row', gap: 4 }}><Button title="Accept" size="small" loading={busyId === friendship.id} disabled={!!busyId} onPress={() => runAction(friendship.id, () => foodService.respondToFriendRequest(friendship.id, 'accepted'))}/><Button title="Decline" size="small" variant="ghost" disabled={!!busyId} onPress={() => runAction(friendship.id, () => foodService.respondToFriendRequest(friendship.id, 'declined'))}/></View>))
        : <Text size={13} color={colors.textMuted} style={{ paddingVertical: 10 }}>No incoming requests right now.</Text>}
      <View style={{ marginTop: 24, marginBottom: 10 }}><SectionTitle title={`Your friends · ${friends.length}`}/></View>
      {loading ? null : friends.length ? friends.map(({ friendship, user }) => profileCard(user, friendship, <Button title="Remove" size="small" variant="ghost" disabled={!!busyId} onPress={() => runAction(friendship.id, () => foodService.removeFriend(friendship.id))}/>))
        : <View style={{ padding: 22, backgroundColor: colors.surface, borderRadius: radius.md, alignItems: 'center' }}>
          <Text size={15} weight="600">Your table is waiting</Text>
          <Text size={13} color={colors.textMuted} style={{ marginTop: 6, textAlign: 'center' }}>Search by username to add your first friend.</Text>
        </View>}
    </>}
  </Page>;
}
