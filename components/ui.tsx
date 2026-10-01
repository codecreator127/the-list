import React, { useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text as NativeText, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { colors, radius, shadow, space, typefaces, typography } from '../theme';
import type { Place, Review, User } from '../types/models';
import { useTheme } from '../theme';
import { PressableScale } from './motion';

type IconName = ComponentProps<typeof Ionicons>['name'];
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type ButtonSize = 'small' | 'medium' | 'large';

const buttonHeight: Record<ButtonSize, number> = { small: 40, medium: 48, large: 54 };
const buttonPadding: Record<ButtonSize, number> = { small: 14, medium: 18, large: 22 };
const buttonTextSize: Record<ButtonSize, number> = { small: 12, medium: 14, large: 15 };
const iconSizes: Record<ButtonSize, number> = { small: 16, medium: 18, large: 19 };

function buttonColors(variant: ButtonVariant) {
  if (variant === 'secondary') return { backgroundColor: colors.surfaceElevated, borderColor: colors.border, text: colors.textPrimary, icon: colors.accent };
  if (variant === 'ghost') return { backgroundColor: 'transparent', borderColor: 'transparent', text: colors.accent, icon: colors.accent };
  if (variant === 'destructive') return { backgroundColor: colors.error, borderColor: colors.error, text: colors.onAccent, icon: colors.onAccent };
  return { backgroundColor: colors.accent, borderColor: colors.accent, text: colors.onAccent, icon: colors.onAccent };
}

export function Text({ children, size=15, color=colors.textPrimary, weight='400', style, numberOfLines }: any) {
  useTheme();
  const fontFamily=size>=27?typefaces.serif:weight==='700'?typefaces.sansBold:weight==='600'?typefaces.sansSemibold:weight==='500'?typefaces.sansMedium:typefaces.sansRegular;
  const lineHeight=size>=24?size*typography.compactLineHeight:size*typography.bodyLineHeight;
  return <NativeText numberOfLines={numberOfLines} style={[{fontSize:size,color,fontFamily,lineHeight,fontWeight:'normal',letterSpacing:0},style]}>{children}</NativeText>;
}
export function Button({title,onPress,secondary=false,variant,size='medium',disabled=false,icon,loading=false,accessibilityLabel,style}: {title:string;onPress?:()=>void;secondary?:boolean;variant?:ButtonVariant;size?:ButtonSize;disabled?:boolean;icon?:IconName;loading?:boolean;accessibilityLabel?:string;style?:ViewStyle}) { useTheme(); const s=makeStyles(); const [pressed,setPressed]=useState(false); const chosenVariant=variant??(secondary?'secondary':'primary'); const tone=buttonColors(chosenVariant); const inactive=disabled||loading; const hoverStyle=chosenVariant==='primary'?s.buttonPrimaryHover:chosenVariant==='ghost'?s.buttonGhostHover:s.buttonSurfaceHover; return <PressableScale disabled={inactive} onPress={onPress} onPressIn={()=>setPressed(true)} onPressOut={()=>setPressed(false)} accessibilityRole="button" accessibilityLabel={accessibilityLabel??title} accessibilityState={{disabled:inactive}} hoverStyle={hoverStyle} style={[s.button,{height:buttonHeight[size],paddingHorizontal:buttonPadding[size],backgroundColor:tone.backgroundColor,borderColor:tone.borderColor},chosenVariant==='ghost'&&s.buttonGhost,pressed&&chosenVariant==='primary'&&s.buttonPrimaryPressed,pressed&&chosenVariant==='destructive'&&s.buttonDangerPressed,inactive&&s.disabled,style]}>{loading?<ActivityIndicator size="small" color={tone.icon}/>:icon?<Ionicons name={icon} size={iconSizes[size]} color={tone.icon}/>:null}<Text size={buttonTextSize[size]} weight="700" color={tone.text}>{title}</Text></PressableScale>; }
export function IconButton({icon,onPress,label,variant='ghost',size='medium',disabled=false,style}: {icon:IconName;onPress?:()=>void;label:string;variant?:ButtonVariant;size?:ButtonSize;disabled?:boolean;style?:ViewStyle}) { useTheme(); const s=makeStyles(); const tone=buttonColors(variant); const dimension=buttonHeight[size]; return <PressableScale disabled={disabled} onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}} hitSlop={4} hoverStyle={variant==='ghost'?s.iconGhostHover:s.buttonSurfaceHover} style={[s.iconButton,{width:dimension,height:dimension,borderRadius:dimension/2,backgroundColor:tone.backgroundColor,borderColor:tone.borderColor},disabled&&s.disabled,style]}><Ionicons name={icon} size={iconSizes[size]+1} color={tone.icon}/></PressableScale>; }
export function Card({children,style}: any) { useTheme(); const s=makeStyles(); return <View style={[s.genericCard,style]}>{children}</View>; }
export function Input(props: TextInputProps) { useTheme(); const s=makeStyles(); const [focused,setFocused]=useState(false); const webFocusReset=Platform.OS==='web'?({outlineStyle:'none',outlineWidth:0} as any):null; return <TextInput {...props} onFocus={event=>{setFocused(true);props.onFocus?.(event);}} onBlur={event=>{setFocused(false);props.onBlur?.(event);}} placeholderTextColor={props.placeholderTextColor ?? colors.textMuted} style={[s.inputField,webFocusReset,props.style,focused&&s.inputFocused]}/>; }
export function Avatar({user,size=42}: {user:User;size?:number}) { useTheme(); const s=makeStyles(); return <View style={[s.avatar,{width:size,height:size,borderRadius:size/2,backgroundColor:user.color,overflow:'hidden'}]}>{user.avatarUrl?<Image source={{uri:user.avatarUrl}} style={{width:size,height:size}}/>:<Text size={size*.32} weight="700" color={colors.textPrimary}>{user.initials}</Text>}</View>; }
export function Rating({value,size=14}: {value:number;size?:number}) { return <View style={{flexDirection:'row',alignItems:'center',gap:5}}><Ionicons name="star" size={size} color={colors.rating}/><Text size={size} weight="700">{Number(value).toFixed(1)} / 10</Text></View>; }
export function Badge({children}:any) { useTheme(); const s=makeStyles(); return <View style={s.badge}><Text size={11} weight="600" color={colors.textSecondary}>{children}</Text></View>; }
export function FilterChip({label,selected=false,onPress,onRemove,accessibilityLabel}: {label:string;selected?:boolean;onPress?:()=>void;onRemove?:()=>void;accessibilityLabel?:string}) { useTheme(); const s=makeStyles(); const Wrapper = onPress ? PressableScale : View; return <Wrapper accessibilityRole={onPress?'button':undefined as any} accessibilityState={onPress?{selected}:undefined as any} accessibilityLabel={accessibilityLabel ?? label} onPress={onPress as any} hoverStyle={selected?s.chipSelectedHover:s.chipHover} style={[s.filterChip,selected&&s.filterChipSelected] as any}><Text size={12} weight="700" color={selected?colors.onAccent:colors.textSecondary}>{label}</Text>{onRemove?<Pressable accessibilityRole="button" accessibilityLabel={`Remove ${label}`} hitSlop={8} onPress={onRemove}><Ionicons name="close" size={14} color={selected?colors.onAccent:colors.accent}/></Pressable>:null}</Wrapper>; }
export function SearchBar({value,onChange,onFocus,onBlur,placeholder='Search places, dishes, areas'}:any) { useTheme(); const s=makeStyles(); return <View style={s.search}><Ionicons name="search" size={19} color={colors.textMuted}/><Input value={value} onChangeText={onChange} onFocus={onFocus} onBlur={onBlur} placeholder={placeholder} placeholderTextColor={colors.textMuted} style={s.searchInput}/>{value?<IconButton icon="close" label="Clear search" size="small" onPress={()=>onChange('')} style={s.searchClear}/>:null}</View>; }
export function PlaceCard({place,onPress,horizontal=false,cardWidth=254}: {place:Place;onPress:()=>void;horizontal?:boolean;cardWidth?:number}) { useTheme(); const s=makeStyles(); return <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open ${place.name}`} hoverStyle={{borderColor:colors.accentHover}} style={[s.placeCard,horizontal&&{width:cardWidth,marginRight:14}]}><Image source={{uri:place.image}} style={horizontal?s.placeImageWide:s.placeImage}/><View style={s.placeInfo}><View style={s.rowBetween}><Text size={17} weight="700" numberOfLines={1} style={{flex:1,marginRight:8}}>{place.name}</Text>{place.reviewCount>0?<View style={{alignItems:'flex-end'}}><Rating value={place.averageRating}/><Text size={10} color={colors.textMuted} style={{marginTop:3}}>{place.reviewCount} {place.reviewCount===1?'review':'reviews'}</Text></View>:<Text size={10} color={colors.textMuted}>No List reviews yet</Text>}</View><Text size={12} color={colors.textSecondary} style={{marginTop:4}}>{place.cuisine??place.category} · {place.area}</Text>{place.googleRating!==undefined?<Text size={10} color={colors.textMuted} style={{marginTop:5}}>Google {place.googleRating.toFixed(1)}{place.googlePlaceId&&!place.googlePlaceId.startsWith('mock:')?' · Google Maps':''}</Text>:place.googlePlaceId&&!place.googlePlaceId.startsWith('mock:')?<Text size={10} color={colors.textMuted} style={{marginTop:5}}>Google Maps</Text>:null}</View></PressableScale>; }
export function ReviewCard({review}: {review:Review&{user:User}}) { useTheme(); const s=makeStyles(); const categories=Object.entries(review.subRatings??{}).filter((entry):entry is [string,number]=>typeof entry[1]==='number'); return <Card style={s.reviewCard}><View style={s.rowBetween}><View style={{flexDirection:'row',alignItems:'center',gap:10}}><Avatar user={review.user} size={38}/><View><Text size={13} weight="600">{review.user.name}</Text><Text size={11} color={colors.textMuted} style={{marginTop:2}}>{review.date}</Text></View></View><Rating value={review.rating} size={13}/></View>{categories.length?<Text size={11} color={colors.textMuted} style={{marginTop:10}}>{categories.map(([key,value])=>`${key[0].toUpperCase()}${key.slice(1)} ${value}/10`).join('  ·  ')}</Text>:null}<Text size={14} color={colors.textPrimary} style={{lineHeight:21,marginTop:12}}>{review.text}</Text></Card>; }
export function Page({children,scroll=true,maxWidth=920}:any) { useTheme(); const s=makeStyles(); const content=<View style={s.pageInner}>{children}</View>; return scroll?<ScrollView style={s.page} showsVerticalScrollIndicator={false} contentContainerStyle={{alignItems:'center'}}><View style={{width:'100%',maxWidth,overflow:'hidden'}}>{content}</View></ScrollView>:<View style={[s.page,{alignItems:'center'}]}><View style={{width:'100%',maxWidth,flex:1,overflow:'hidden'}}>{content}</View></View>; }
export function SectionTitle({title,action,onAction}:any) { useTheme(); const s=makeStyles(); return <View style={s.rowBetween}><Text size={19} weight="700">{title}</Text>{action&&<Button title={action} variant="ghost" size="small" onPress={onAction}/>}</View>; }
export function BackButton({onPress}:any) { useTheme(); return <IconButton icon="arrow-back" label="Go back" variant="secondary" onPress={onPress}/>; }
const makeStyles=()=>StyleSheet.create({
  genericCard:{backgroundColor:colors.surface,borderRadius:3,padding:16,borderWidth:1,borderColor:colors.border,...shadow},
  inputField:{fontSize:15,color:colors.textPrimary,fontFamily:typefaces.sansRegular,lineHeight:typography.body*typography.bodyLineHeight},
  inputFocused:{borderColor:colors.focus,borderWidth:1},
  page:{flex:1,backgroundColor:colors.background},
  pageInner:{paddingHorizontal:space.xl,paddingTop:space.lg+2,paddingBottom:136,width:'100%'},
  button:{borderRadius:3,borderWidth:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},
  buttonPrimaryHover:{backgroundColor:colors.accentHover,borderColor:colors.accentHover},
  buttonPrimaryPressed:{backgroundColor:colors.accentPressed,borderColor:colors.accentPressed},
  buttonDangerPressed:{opacity:.82},
  buttonSurfaceHover:{backgroundColor:colors.surfaceHover,borderColor:colors.border},
  buttonGhost:{paddingHorizontal:10},
  buttonGhostHover:{backgroundColor:colors.surfaceHover},
  iconButton:{borderWidth:1,alignItems:'center',justifyContent:'center'},
  iconGhostHover:{backgroundColor:colors.surfaceHover},
  disabled:{opacity:.45},
  avatar:{alignItems:'center',justifyContent:'center'},
  badge:{paddingHorizontal:10,paddingVertical:6,borderRadius:3,backgroundColor:colors.surfaceStrong,alignSelf:'flex-start'},
  filterChip:{minHeight:40,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,paddingHorizontal:13,borderRadius:3,backgroundColor:colors.surfaceElevated,borderWidth:1,borderColor:colors.border},
  filterChipSelected:{backgroundColor:colors.accent,borderColor:colors.accent},
  chipHover:{borderColor:colors.accentHover},
  chipSelectedHover:{backgroundColor:colors.accentHover,borderColor:colors.accentHover},
  search:{minHeight:52,borderRadius:3,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,flexDirection:'row',alignItems:'center',paddingLeft:16,paddingRight:8,gap:10},
  searchInput:{flex:1,fontSize:14,color:colors.textPrimary,fontFamily:typefaces.sansRegular,lineHeight:21},
  searchClear:{borderWidth:0,backgroundColor:'transparent'},
  placeCard:{width:'100%',borderRadius:3,backgroundColor:colors.surface,overflow:'hidden',borderWidth:1,borderColor:colors.border,...shadow},
  placeImage:{width:'100%',height:170,backgroundColor:colors.surfaceElevated},
  placeImageWide:{width:'100%',height:158,backgroundColor:colors.surfaceElevated},
  placeInfo:{padding:14},
  rowBetween:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  reviewCard:{padding:16,marginTop:12},
});





