import { memo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { RatingStars, Text } from './ui';
import { Entrance, PressableScale } from './motion';
import { colors, radius, typefaces, useTheme } from '../theme';
import type { RankedPlace } from '../features/myList';

export const ListRankedCard=memo(function ListRankedCard({item,onPress,reviewerCount}: {item:RankedPlace;onPress?:()=>void;reviewerCount?:number}) {
  useTheme();
  const s=makeStyles();
  const place=item.place;
  return <Entrance delay={Math.min((item.rank-1)*40,240)}>
    <PressableScale accessibilityRole="button" accessibilityLabel={`Rank ${item.rank}: ${place.name}, rated ${item.rating.toFixed(2)} out of 5.00${reviewerCount!==undefined?`, ${reviewerCount} ${reviewerCount===1?'review':'reviews'}`:''}`} onPress={onPress??(()=>router.push(`/place/${place.id}`))} hoverStyle={{borderColor:colors.accentHover}} style={s.card}>
      <Text size={11} color={colors.accent} style={s.rank}>{String(item.rank).padStart(2,'0')}</Text>
      {place.image?<Image source={{uri:place.image}} style={s.photo}/>:<View style={[s.photo,s.fallback]}><Ionicons name="restaurant-outline" size={23} color={colors.accent}/></View>}
      <View style={s.info}>
        <Text size={14} weight="600" numberOfLines={1}>{place.name}</Text>
        <Text size={10} color={colors.textMuted} numberOfLines={1} style={{marginTop:3}}>{place.cuisine?.trim()||place.category||'Other / unspecified'}{place.area?` · ${place.area}`:''}</Text>
        {reviewerCount!==undefined?<Text size={11} color={colors.textSecondary} style={{marginTop:5}}>{item.rating.toFixed(2)} · {reviewerCount} {reviewerCount===1?'review':'reviews'}</Text>:<View style={{marginTop:5}}><RatingStars value={item.rating} size={11}/></View>}
      </View>
      <Text size={14} weight="600" style={s.score}>{item.rating.toFixed(2)}<Text size={9} color={colors.textMuted}>/5.00</Text></Text>
    </PressableScale>
  </Entrance>;
});
const makeStyles=()=>StyleSheet.create({
  card:{minHeight:82,flexDirection:'row',alignItems:'center',gap:11,borderTopWidth:1,borderTopColor:colors.border,paddingVertical:11},
  rank:{width:20,fontFamily:typefaces.mono,letterSpacing:1},photo:{width:58,height:58,borderRadius:radius.sm,backgroundColor:colors.surfaceStrong},
  fallback:{alignItems:'center',justifyContent:'center'},info:{flex:1,minWidth:0},score:{minWidth:27,textAlign:'right',fontFamily:typefaces.serif},
});
