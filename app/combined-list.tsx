import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, AppState, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, BackButton, Button, FilterChip, Page, SearchBar, Text } from '../components/ui';
import { PressableScale } from '../components/motion';
import { ListRankedCard } from '../components/ListRankedCard';
import { ListFilterControls, emptyListFilters } from '../components/ListFilters';
import { foodService } from '../services/foodService';
import { watchAuthState } from '../services/auth';
import { isFirebaseRepositoryEnabled } from '../services/firebase';
import { acceptedFriendIds } from '../features/personalization';
import { filterPersonalList } from '../features/listFilters';
import type { CombinedPlace } from '../features/combinedList';
import type { User } from '../types/models';
import { colors, typefaces, useTheme } from '../theme';

type Session=ReturnType<typeof foodService.createCombinedListSession>;
export default function CombinedListScreen() {
  useTheme();
  const [session,setSession]=useState<Session>();
  const [participants,setParticipants]=useState<User[]>([]);
  const [selected,setSelected]=useState<string[]>([]);
  const selectedRef=useRef<string[]>([]);
  const owner=useRef('');
  const [signedIn,setSignedIn]=useState(!isFirebaseRepositoryEnabled);
  const [participantLoading,setParticipantLoading]=useState(true);
  const [loading,setLoading]=useState(false);
  const [items,setItems]=useState<CombinedPlace[]>([]);
  const [unavailable,setUnavailable]=useState(0);
  const [error,setError]=useState('');
  const [retry,setRetry]=useState(0);
  const [selectorOpen,setSelectorOpen]=useState(true);
  const [friendSearch,setFriendSearch]=useState('');
  const [filters,setFilters]=useState(emptyListFilters);
  const deferredSearch=useDeferredValue(filters.search);
  const [visibleCount,setVisibleCount]=useState(40);
  const selectionKey=JSON.stringify([...selected].sort());
  const filtered=useMemo(()=>filterPersonalList(items,{...filters,search:deferredSearch}),[items,filters,deferredSearch]);
  useEffect(()=>setVisibleCount(40),[filters,items]);

  useFocusEffect(useCallback(()=>{
    let active=true, sequence=0;
    let stopFriendships:()=>void=()=>{};
    async function initialize(uid:string) {
      const request=++sequence;
      stopFriendships();
      setSession(undefined);setItems([]);setError('');setParticipantLoading(true);
      try {
        const nextSession=foodService.createCombinedListSession();
        const users=await nextSession.participants();
        if(!active || request!==sequence)return;
        const allowed=new Set(users.map(user=>user.id));
        const next=selectedRef.current.filter(id=>allowed.has(id));
        selectedRef.current=next;setSelected(next);setParticipants(users);setSession(nextSession);setParticipantLoading(false);
        let signature=[...allowed].sort().join(',');
        stopFriendships=foodService.watchMyFriendships(rows=>{
          if(!active || request!==sequence)return;
          const ids=[uid,...acceptedFriendIds(uid,rows)].sort();
          if(ids.join(',')===signature)return;
          signature=ids.join(',');
          const allowedNow=new Set(ids);
          selectedRef.current=selectedRef.current.filter(id=>allowedNow.has(id));
          setItems([]);setSelected([...selectedRef.current]);
          void initialize(uid);
        },cause=>{if(active && request===sequence){++sequence;setSession(undefined);setItems([]);setError(cause.message);setParticipantLoading(false);}});
      } catch(cause) {
        if(active && request===sequence){setError(cause instanceof Error?cause.message:'Could not load participants.');setParticipantLoading(false);}
      }
    }
    const stopAuth=watchAuthState(user=>{
      const uid=isFirebaseRepositoryEnabled?(user?.uid??''):'u1';
      setSignedIn(!!uid);
      if(!uid){++sequence;stopFriendships();owner.current='';selectedRef.current=[];setSelected([]);setSession(undefined);setItems([]);setParticipants([]);setParticipantLoading(false);return;}
      if(owner.current!==uid){owner.current=uid;selectedRef.current=[uid];}
      void initialize(uid);
    });
    // Refresh cached reviews and permissions when returning from another app/tab.
    const appState=AppState.addEventListener('change',state=>{if(state==='active' && owner.current)void initialize(owner.current);});
    return ()=>{active=false;++sequence;stopAuth();stopFriendships();appState.remove();};
  },[retry]));

  useEffect(()=>{
    let active=true;
    setItems([]);setUnavailable(0);
    if(!session || !selected.length){setLoading(false);return;}
    setLoading(true);setError('');
    const timer=setTimeout(()=>{
      void session.load(JSON.parse(selectionKey)).then(result=>{
        if(active){setItems(result.items);setUnavailable(result.unavailablePlaces);setLoading(false);}
      }).catch(cause=>{if(active){setItems([]);setError(cause instanceof Error?cause.message:'Could not create this Combined List.');setLoading(false);}});
    },150);
    return ()=>{active=false;clearTimeout(timer);};
  },[session,selectionKey]);

  function toggle(id:string) {
    const current=selectedRef.current;
    const next=current.includes(id)?current.filter(value=>value!==id):[...current,id];
    selectedRef.current=next;setItems([]);setLoading(!!next.length);setSelected(next);
  }
  const needle=friendSearch.trim().toLocaleLowerCase('en-AU').replace(/^@/,'');
  const friends=participants.filter(user=>user.id!==session?.userId);
  const visibleFriends=friends.filter(user=>`${user.name} ${user.username??user.handle}`.toLocaleLowerCase('en-AU').includes(needle));
  const participantRow=(user:User,self=false)=><PressableScale key={user.id} accessibilityRole="checkbox" accessibilityLabel={self?'Include yourself':`Include ${user.name}`} accessibilityState={{checked:selected.includes(user.id)}} onPress={()=>toggle(user.id)} style={{flexDirection:'row',alignItems:'center',gap:10,minHeight:54,paddingVertical:8}}>
    <Ionicons name={selected.includes(user.id)?'checkbox':'square-outline'} size={22} color={selected.includes(user.id)?colors.accent:colors.textMuted}/>
    <Avatar user={user} size={32}/><View style={{flex:1,minWidth:0}}><Text size={13} weight="600">{self?'You':user.name}</Text><Text size={11} color={colors.textMuted}>{user.username??user.handle?`@${user.username??user.handle}`:'List member'}</Text></View>
  </PressableScale>;

  return <Page maxWidth={920}>
    <View style={{flexDirection:'row',alignItems:'center',gap:12,marginBottom:16}}><BackButton onPress={()=>router.canGoBack()?router.back():router.replace('/(tabs)/list')}/><Text size={15} weight="600">Combined List</Text></View>
    <View style={{paddingHorizontal:24,paddingTop:22,paddingBottom:18,backgroundColor:colors.surfaceElevated,borderWidth:1,borderColor:colors.border}}>
      <Text size={10} weight="600" color={colors.textSecondary} style={{fontFamily:typefaces.mono,letterSpacing:1}}>COMBINED LIST</Text>
      <Text size={25} weight="700" style={{marginTop:12}}>A table for your people</Text>
      <Text size={13} color={colors.textMuted} style={{marginTop:7,lineHeight:20}}>Average ratings from you and selected friends. Each person contributes once per restaurant.</Text>
      {!signedIn?<View style={{paddingVertical:24}}><Text>Sign in to choose your friends.</Text><Button title="Sign in" onPress={()=>router.push('/auth')} style={{marginTop:12}}/></View>
        : participantLoading?<View style={{paddingVertical:28,alignItems:'center'}}><ActivityIndicator color={colors.accent}/><Text size={12} color={colors.textMuted} style={{marginTop:10}}>Loading your people…</Text></View>
        : <>
          {session?<View style={{marginTop:18,marginBottom:18}}>
            <Button title={selectorOpen?'Hide participants':'Choose participants'} icon="people-outline" variant="secondary" size="small" onPress={()=>setSelectorOpen(value=>!value)} style={{alignSelf:'flex-start'}}/>
            {selectorOpen?<View style={{marginTop:10}}>
              {participants.find(user=>user.id===session.userId)?participantRow(participants.find(user=>user.id===session.userId)!,true):null}
              {friends.length?<><SearchBar value={friendSearch} onChange={setFriendSearch} placeholder="Search accepted friends"/><ScrollView nestedScrollEnabled style={{maxHeight:280}}>{visibleFriends.map(user=>participantRow(user))}</ScrollView>{!visibleFriends.length?<Text size={12} color={colors.textMuted} style={{marginTop:10}}>No friends match that search.</Text>:null}</>
                :<Text size={12} color={colors.textMuted} style={{marginTop:8}}>No accepted friends yet. You can start with your own reviews.</Text>}
            </View>:null}
            <View style={{flexDirection:'row',flexWrap:'wrap',gap:7,marginTop:12}}>
              {participants.filter(user=>selected.includes(user.id)).map(user=><FilterChip key={user.id} label={user.id===session.userId?'You':user.name} selected onRemove={()=>toggle(user.id)}/>)}
            </View>
            <Text size={12} color={colors.textMuted} style={{marginTop:10}}>{selected.length} {selected.length===1?'person':'people'} · {loading?'Combining restaurants…':`${items.length} ${items.length===1?'restaurant':'restaurants'}`}</Text>
          </View>:null}
          {error?<View style={{paddingVertical:22}}><Text size={15} weight="600">Couldn’t create this Combined List</Text><Text size={13} color={colors.textMuted} style={{marginTop:7}}>{error}</Text><Button title="Try again" variant="secondary" size="small" onPress={()=>setRetry(value=>value+1)} style={{marginTop:12}}/></View>
            : loading?<View style={{paddingVertical:28,alignItems:'center'}}><ActivityIndicator color={colors.accent}/><Text size={12} color={colors.textMuted} style={{marginTop:10}}>Combining your reviews…</Text></View>
              : !selected.length?<Text size={13} color={colors.textMuted} style={{paddingVertical:25}}>Select at least one person to build a Combined List.</Text>
                : !items.length?<Text size={13} color={colors.textMuted} style={{paddingVertical:25}}>No restaurants have been reviewed by these participants yet.</Text>
                  : <>
                    <ListFilterControls items={items} filters={filters} onChange={setFilters}/>
                    <Text size={11} color={colors.textMuted} style={{paddingBottom:14}}>{filtered.length} of {items.length} restaurants · Original combined ranks</Text>
                    {filtered.slice(0,visibleCount).map(item=><ListRankedCard key={item.placeId} item={item} reviewerCount={item.reviewerCount} onPress={()=>router.push({pathname:'/place/[id]',params:{id:item.placeId,from:'combined',combinedUsers:selectionKey}})}/>)}
                    {!filtered.length?<View style={{paddingVertical:25}}><Text size={13} color={colors.textMuted}>No restaurants match these filters.</Text><Button title="Clear all filters" variant="secondary" size="small" onPress={()=>setFilters(emptyListFilters())} style={{marginTop:12}}/></View>:null}
                    {filtered.length>visibleCount?<Button title={`Show more · ${filtered.length-visibleCount} remaining`} variant="secondary" size="small" onPress={()=>setVisibleCount(value=>value+40)} style={{marginVertical:12}}/>:null}
                  </>}
          {unavailable?<Text size={11} color={colors.textMuted} style={{marginTop:12}}>{unavailable} {unavailable===1?'restaurant is':'restaurants are'} unavailable and couldn’t be included.</Text>:null}
        </>}
      <Text size={9} color={colors.textMuted} style={{fontFamily:typefaces.mono,letterSpacing:1,borderTopWidth:1,borderTopColor:colors.border,paddingTop:14,marginTop:16}}>READ-ONLY · NOTHING IS SAVED TO YOUR LIST</Text>
    </View>
  </Page>;
}
