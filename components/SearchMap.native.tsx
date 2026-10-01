import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Text } from './ui';
import { colors, radius, useTheme } from '../theme';
import type { PlaceSearchResult } from '../types/models';
import { DEFAULT_SEARCH_ORIGIN } from '../data/searchOptions';

const nativeMapsKey=process.env.EXPO_PUBLIC_GOOGLE_MAPS_NATIVE_API_KEY||process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
export default function SearchMap({places,onSelect,center=DEFAULT_SEARCH_ORIGIN}:{places:PlaceSearchResult[];onSelect:(place:PlaceSearchResult)=>void;center?:{latitude:number;longitude:number}}){ useTheme(); const s=makeStyles();
 const map=useRef<MapView>(null);const points=useMemo(()=>places.filter(place=>place.latitude!==undefined&&place.longitude!==undefined),[places]);
 useEffect(()=>{map.current?.animateToRegion({latitude:center.latitude,longitude:center.longitude,latitudeDelta:.18,longitudeDelta:.18},450);},[center.latitude,center.longitude]);
 if(!nativeMapsKey)return <View style={s.fallback}><Text size={13} color={colors.muted} style={{textAlign:'center'}}>Add a restricted native Google Maps key to enable the map. You can still browse search results below.</Text></View>;
 return <View style={s.frame}><MapView ref={map} provider={PROVIDER_GOOGLE} style={StyleSheet.absoluteFill} initialRegion={{latitude:center.latitude,longitude:center.longitude,latitudeDelta:.18,longitudeDelta:.18}} onMapReady={()=>map.current?.animateToRegion({latitude:center.latitude,longitude:center.longitude,latitudeDelta:.18,longitudeDelta:.18},350)}>{points.map(place=><Marker key={place.googlePlaceId} coordinate={{latitude:place.latitude!,longitude:place.longitude!}} title={place.name} description={place.address} onPress={()=>onSelect(place)}/>)}</MapView></View>;
}
const makeStyles=()=>StyleSheet.create({frame:{height:290,overflow:'hidden',borderRadius:radius.md,borderWidth:1,borderColor:colors.line,backgroundColor:colors.soft,marginTop:14},fallback:{height:150,marginTop:14,padding:24,borderRadius:radius.md,borderWidth:1,borderColor:colors.line,backgroundColor:colors.white,alignItems:'center',justifyContent:'center'}});
