import { ListRankedCard } from '../../components/ListRankedCard';
import { ListFilterControls, emptyListFilters } from '../../components/ListFilters';
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Page, Text } from '../../components/ui';
import { PressableScale } from '../../components/motion';
import { watchAuthState } from '../../services/auth';
import { foodService } from '../../services/foodService';
import { isFirebaseRepositoryEnabled } from '../../services/firebase';
import type { RankedPlace } from '../../features/myList';
import { filterPersonalList } from '../../features/listFilters';
import { colors, typefaces, useTheme } from '../../theme';

export default function ListScreen() {
  useTheme();
  const styles = makeStyles();
  const [items, setItems] = useState<RankedPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(!isFirebaseRepositoryEnabled);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [filters,setFilters]=useState(emptyListFilters);
  const deferredSearch=useDeferredValue(filters.search);
  const [visibleCount,setVisibleCount]=useState(40);
  const filtered=useMemo(()=>filterPersonalList(items,{...filters,search:deferredSearch}),[items,filters,deferredSearch]);
  const resetFilters=()=>setFilters(emptyListFilters());
  useEffect(()=>{setVisibleCount(40);},[filters,items]);
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
        {signedIn ? <Button title="Combined List" icon="people-outline" variant="secondary" size="small" onPress={()=>router.push('/combined-list')} style={{alignSelf:'flex-start',marginBottom:14}}/> : null}
        {signedIn && !loading && !error && items.length ? <>
          <ListFilterControls items={items} filters={filters} onChange={setFilters} placeholder="Search your restaurants"/>
          <Text size={11} color={colors.textMuted} style={{paddingBottom:14}}>{filtered.length} of {items.length} places · Original List ranks</Text>
        </> : null}
        {loading ? <View style={styles.status}><ActivityIndicator color={colors.accent}/><Text size={12} color={colors.textMuted} style={{ marginTop: 12 }}>Building your List…</Text></View>
          : !signedIn ? <View style={styles.empty}><Ionicons name="person-outline" size={24} color={colors.accent}/><Text size={16} weight="600" style={{ marginTop: 12 }}>Sign in to see your List</Text><Text size={13} color={colors.textMuted} style={{ marginTop: 6, textAlign: 'center', lineHeight: 19 }}>Your personal rankings are saved with your account.</Text><Button title="Log in or create an account" icon="person-outline" onPress={() => router.push('/auth')} style={{ marginTop: 17 }}/></View>
          : error ? <View style={styles.empty}><Text size={15} weight="600">Couldn’t load your List</Text><Text size={13} color={colors.textMuted} style={{ marginTop: 7, textAlign: 'center' }}>{error}</Text><Button title="Try again" variant="secondary" size="small" onPress={() => setRetry(value => value + 1)} style={{ marginTop: 12 }}/></View>
          : items.length ? filtered.length ? <View>{filtered.slice(0, visibleCount).map(item => <ListRankedCard key={item.place.id} item={item}/>)}{filtered.length > visibleCount ? <Button title={`Show more · ${filtered.length - visibleCount} remaining`} variant="secondary" size="small" onPress={() => setVisibleCount(value => value + 40)} style={{marginVertical: 12}}/> : null}</View>
            : <View style={styles.empty}><Text size={16} weight="600">No matching restaurants</Text><Text size={13} color={colors.textMuted} style={{marginTop: 7, textAlign: 'center'}}>Try a different name or clear a filter to see more of your List.</Text><Button title="Clear all filters" variant="secondary" size="small" onPress={resetFilters} style={{marginTop: 12}}/></View>
          : <View style={styles.empty}><Ionicons name="list-outline" size={25} color={colors.accent}/><Text size={16} weight="600" style={{ marginTop: 12 }}>Your List is empty</Text><Text size={13} color={colors.textMuted} style={{ marginTop: 6, textAlign: 'center', lineHeight: 19 }}>Review a place and it’ll appear here, ranked by your rating.</Text><Button title="Explore places" size="small" onPress={() => router.push('/(tabs)/search')} style={{marginTop: 12}}/></View>}

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
  ledgerFooter: { minHeight: 39, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 13, marginTop: 2 },
  addPlace: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
