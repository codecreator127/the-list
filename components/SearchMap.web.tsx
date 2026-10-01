import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './ui';
import { colors, radius, useTheme } from '../theme';
import { loadGoogleMapLibrary } from '../services/googlePlaces.web';
import type { PlaceSearchResult } from '../types/models';
import { DEFAULT_SEARCH_ORIGIN } from '../data/searchOptions';

export default function SearchMap({places,onSelect,center=DEFAULT_SEARCH_ORIGIN}:{places:PlaceSearchResult[];onSelect:(place:PlaceSearchResult)=>void;center?:{latitude:number;longitude:number}}){ useTheme(); const s=makeStyles();
 const host=useRef<View>(null);const map=useRef<any>(null);const apiRef=useRef<any>(null);const markers=useRef<any[]>([]);const select=useRef(onSelect);const placesRef=useRef(places);const centerRef=useRef(center);const [error,setError]=useState('');
 select.current=onSelect;placesRef.current=places;centerRef.current=center;
 const updateMarkers=(api:any,rows:PlaceSearchResult[])=>{markers.current.forEach(marker=>marker.setMap(null));markers.current=rows.filter(place=>place.latitude!==undefined&&place.longitude!==undefined).map(place=>{const marker=new api.Marker({map:map.current,position:{lat:place.latitude!,lng:place.longitude!},title:place.name});marker.addListener('click',()=>select.current(place));return marker;});};
 useEffect(()=>{let active=true;loadGoogleMapLibrary().then(api=>{if(!active||!host.current)return;apiRef.current=api;if(!map.current)map.current=new api.Map(host.current,{center:{lat:centerRef.current.latitude,lng:centerRef.current.longitude},zoom:12,mapTypeControl:false,streetViewControl:false,fullscreenControl:false});updateMarkers(api,placesRef.current);},cause=>{if(active)setError(cause instanceof Error?cause.message:'Could not load the map.');});return()=>{active=false;};},[]);
 useEffect(()=>{if(map.current)map.current.setCenter({lat:center.latitude,lng:center.longitude});},[center.latitude,center.longitude]);
 useEffect(()=>{if(apiRef.current&&map.current)updateMarkers(apiRef.current,places);},[places]);
 return <View style={s.frame}>{error?<View style={s.fallback}><Text size={13} color={colors.muted}>{error}</Text></View>:<View ref={host} collapsable={false} style={s.map}/>}</View>;
}
const makeStyles=()=>StyleSheet.create({frame:{height:290,overflow:'hidden',borderRadius:radius.md,borderWidth:1,borderColor:colors.line,backgroundColor:colors.soft,marginTop:14},map:{height:290,width:'100%'},fallback:{flex:1,alignItems:'center',justifyContent:'center',padding:24}});
