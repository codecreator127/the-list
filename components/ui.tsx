import { getReviewScore } from '../features/reviewScoring';
import { ReviewPhoto } from './ReviewPhoto';
import { notifyPhotoViewport } from './photoViewport';
import React, { useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text as NativeText, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { colors, controls, radius, shadow, space, typefaces, typography } from '../theme';
import type { Place, Review, User } from '../types/models';
import { useTheme } from '../theme';
import { PressableScale } from './motion';

type IconName = ComponentProps<typeof Ionicons>['name'];
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type ButtonSize = 'small' | 'medium' | 'large';

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
function buttonHover(variant: ButtonVariant, s: ReturnType<typeof makeStyles>) {
  return variant === 'primary' ? s.buttonPrimaryHover : variant === 'destructive' ? s.buttonDangerHover : variant === 'ghost' ? s.buttonGhostHover : s.buttonSurfaceHover;
}
export function Button({title,onPress,secondary=false,variant,size='medium',disabled=false,icon,loading=false,accessibilityLabel,style}: {title:string;onPress?:()=>void;secondary?:boolean;variant?:ButtonVariant;size?:ButtonSize;disabled?:boolean;icon?:IconName;loading?:boolean;accessibilityLabel?:string;style?:StyleProp<ViewStyle>}) {
  useTheme();
  const s=makeStyles(), dimensions=controls[size];
  const [pressed,setPressed]=useState(false);
  const chosenVariant=variant??(secondary?'secondary':'primary');
  const tone=buttonColors(chosenVariant), inactive=disabled||loading;
  return <PressableScale disabled={inactive} onPress={onPress} onPressIn={()=>setPressed(true)} onPressOut={()=>setPressed(false)} accessibilityRole="button" accessibilityLabel={accessibilityLabel??title} accessibilityState={{disabled:inactive,busy:loading}} hoverStyle={buttonHover(chosenVariant,s)} style={[s.button,{minHeight:dimensions.minHeight,paddingHorizontal:dimensions.paddingHorizontal,paddingVertical:dimensions.paddingVertical,backgroundColor:tone.backgroundColor,borderColor:tone.borderColor},pressed&&!inactive&&chosenVariant==='primary'&&s.buttonPrimaryPressed,pressed&&!inactive&&chosenVariant==='destructive'&&s.buttonDangerPressed,inactive&&s.disabled,style]}>
    {loading?<ActivityIndicator size="small" color={tone.icon}/>:icon?<Ionicons name={icon} size={dimensions.iconSize} color={tone.icon}/>:null}
    <Text size={dimensions.fontSize} weight="700" color={tone.text} style={s.buttonLabel}>{title}</Text>
  </PressableScale>;
}
export function IconButton({icon,onPress,label,variant='ghost',size='medium',disabled=false,style}: {icon:IconName;onPress?:()=>void;label:string;variant?:ButtonVariant;size?:ButtonSize;disabled?:boolean;style?:StyleProp<ViewStyle>}) {
  useTheme();
  const s=makeStyles(), tone=buttonColors(variant), dimension=controls[size].minHeight;
  return <PressableScale disabled={disabled} onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}} hoverStyle={buttonHover(variant,s)} style={[s.iconButton,{width:dimension,height:dimension,backgroundColor:tone.backgroundColor,borderColor:tone.borderColor},disabled&&s.disabled,style]}><Ionicons name={icon} size={controls[size].iconSize+1} color={tone.icon}/></PressableScale>;
}
export function Card({children,style}: any) { useTheme(); const s=makeStyles(); return <View style={[s.genericCard,style]}>{children}</View>; }
export function Input({variant='default',...props}: TextInputProps & {variant?:'default'|'bare'}) {
  useTheme();
  const [focused,setFocused]=useState(false);
  const s = makeStyles();
  const inputStyle = StyleSheet.flatten<TextStyle>([s.inputField,props.multiline&&s.inputMultiline,variant==='bare'&&s.inputBare,props.style]);
  // iOS Safari zooms focused inputs with text smaller than 16px.
  const webFocusReset = Platform.OS === 'web'
    ? ({ outlineStyle: 'none', outlineWidth: 0, fontSize: Math.max(16, inputStyle.fontSize ?? 16) } as any)
    : null;
  return <TextInput {...props} onFocus={event=>{setFocused(true);props.onFocus?.(event);}} onBlur={event=>{setFocused(false);props.onBlur?.(event);}} placeholderTextColor={props.placeholderTextColor ?? colors.textMuted} style={[inputStyle,webFocusReset,variant==='default'&&focused&&s.inputFocused,props.editable===false&&s.disabled]}/>;
}
export function Avatar({user,size=42}: {user:User;size?:number}) { useTheme(); const s=makeStyles(); return <View style={[s.avatar,{width:size,height:size,borderRadius:size/2,backgroundColor:colors.surfaceStrong,overflow:'hidden'}]}>{user.avatarUrl?<Image source={{uri:user.avatarUrl}} style={{width:size,height:size}}/>:<Text size={size*.32} weight="700" color={colors.textPrimary}>{user.initials}</Text>}</View>; }
export function RatingStars({value,size=14}: {value:number;size?:number}) {
  const safeValue=Math.max(0,Math.min(5,value));
  return <View style={{flexDirection:'row',alignItems:'center',gap:2}} accessibilityLabel={`${safeValue.toFixed(2)} out of 5.00 stars`}>
    {Array.from({length:5},(_,index)=>{
      const fill=Math.max(0,Math.min(1,safeValue-index));
      return <View key={index} style={{width:size,height:size}}>
        <Ionicons name="star-outline" size={size} color={colors.border}/>
        {fill>0?<View pointerEvents="none" style={{position:'absolute',left:0,top:0,bottom:0,width:`${fill*100}%`,overflow:'hidden'}}><Ionicons name="star" size={size} color={colors.rating}/></View>:null}
      </View>;
    })}
  </View>;
}
export function Rating({value,size=14}: {value:number;size?:number}) { return <View style={{flexDirection:'row',alignItems:'center',gap:5}}><Ionicons name="star" size={size} color={colors.rating}/><Text size={size} weight="700">{Number(value).toFixed(2)} / 5.00</Text></View>; }
export function Badge({children}:any) { useTheme(); const s=makeStyles(); return <View style={s.badge}><Text size={11} weight="600" color={colors.textSecondary}>{children}</Text></View>; }
export function FilterChip({label,selected=false,onPress,onRemove,accessibilityLabel}: {label:string;selected?:boolean;onPress?:()=>void;onRemove?:()=>void;accessibilityLabel?:string}) {
  useTheme();const s=makeStyles(), action=onPress??onRemove;
  const content=<><Text size={controls.small.fontSize} weight="600" color={selected?colors.onAccent:colors.textSecondary} style={s.chipLabel}>{label}</Text>{onRemove?<Ionicons name="close" size={16} color={selected?colors.onAccent:colors.accent}/>:null}</>;
  if(!action)return <View style={[s.filterChip,selected&&s.filterChipSelected]}>{content}</View>;
  return <PressableScale accessibilityRole="button" accessibilityState={{selected}} accessibilityLabel={accessibilityLabel??(onRemove?`Remove ${label}`:label)} onPress={action} hoverStyle={selected?s.chipSelectedHover:s.chipHover} style={[s.filterChip,selected&&s.filterChipSelected]}>{content}</PressableScale>;
}
export function SearchBar({value,onChange,onFocus,onBlur,placeholder='Search places, dishes, areas'}:any) {
  useTheme();const s=makeStyles();const [focused,setFocused]=useState(false);
  return <View style={[s.search,focused&&s.inputFocused]}><Ionicons name="search" size={19} color={colors.textMuted}/><Input variant="bare" accessibilityLabel={placeholder} value={value} onChangeText={onChange} onFocus={event=>{setFocused(true);onFocus?.(event);}} onBlur={event=>{setFocused(false);onBlur?.(event);}} placeholder={placeholder} style={s.searchInput}/>{value?<IconButton icon="close" label="Clear search" size="small" onPress={()=>onChange('')} style={s.searchClear}/>:null}</View>;
}
export function PlaceCard({place,onPress,horizontal=false,cardWidth=254}: {place:Place;onPress:()=>void;horizontal?:boolean;cardWidth?:number}) { useTheme(); const s=makeStyles(); return <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open ${place.name}`} hoverStyle={{borderColor:colors.accentHover}} style={[s.placeCard,horizontal&&{width:cardWidth,marginRight:14}]}><Image source={{uri:place.image}} style={horizontal?s.placeImageWide:s.placeImage}/><View style={s.placeInfo}><View style={s.rowBetween}><Text size={17} weight="700" numberOfLines={1} style={{flex:1,marginRight:8}}>{place.name}</Text>{place.reviewCount>0?<View style={{alignItems:'flex-end'}}><Rating value={place.averageRating}/><Text size={10} color={colors.textMuted} style={{marginTop:3}}>{place.reviewCount} {place.reviewCount===1?'review':'reviews'}</Text></View>:<Text size={10} color={colors.textMuted}>No List reviews yet</Text>}</View><Text size={12} color={colors.textSecondary} style={{marginTop:4}}>{place.cuisine??place.category} · {place.area}</Text>{place.googleRating!==undefined?<Text size={10} color={colors.textMuted} style={{marginTop:5}}>Google {place.googleRating.toFixed(1)}{place.googlePlaceId&&!place.googlePlaceId.startsWith('mock:')?' · Google Maps':''}</Text>:place.googlePlaceId&&!place.googlePlaceId.startsWith('mock:')?<Text size={10} color={colors.textMuted} style={{marginTop:5}}>Google Maps</Text>:null}</View></PressableScale>; }
export function ReviewCard({review,onAuthorPress}: {review:Review&{user:User};onAuthorPress?:()=>void}) { useTheme(); const s=makeStyles(); const categories=Object.entries(review.subRatings??{}).filter((entry):entry is [string,number]=>typeof entry[1]==='number'); return <Card style={s.reviewCard}><View style={s.rowBetween}><Pressable disabled={!onAuthorPress} accessibilityRole={onAuthorPress?'button':undefined} accessibilityLabel={onAuthorPress?`View ${review.user.name} profile`:undefined} onPress={onAuthorPress} style={{flexDirection:'row',alignItems:'center',gap:10,flex:1,minWidth:0,marginRight:8}}><Avatar user={review.user} size={38}/><View style={{flex:1,minWidth:0}}><Text size={13} weight="600" numberOfLines={1}>{review.user.name}</Text><Text size={11} color={colors.textMuted} style={{marginTop:2}}>{review.date}</Text></View></Pressable><Rating value={getReviewScore(review)} size={13}/></View>{categories.length?<Text size={11} color={colors.textMuted} style={{marginTop:10}}>{categories.map(([key,value])=>`${key[0].toUpperCase()}${key.slice(1)} ${(value / 2).toFixed(2)}/5.00`).join('  ·  ')}</Text>:null}<Text size={14} color={colors.textPrimary} style={{lineHeight:21,marginTop:12}}>{review.text}</Text>{review.photo ? <ReviewPhoto uri={review.photo.url} label={`Photo from ${review.user.name}'s review`} /> : null}</Card>; }
export function Page({children,scroll=true,maxWidth=920}:any) { useTheme(); const s=makeStyles(); const content=<View style={s.pageInner}>{children}</View>; return scroll?<ScrollView onScroll={Platform.OS === 'web' ? undefined : notifyPhotoViewport} scrollEventThrottle={200} style={s.page} showsVerticalScrollIndicator={false} contentContainerStyle={{alignItems:'center'}}><View style={{width:'100%',maxWidth,overflow:'hidden'}}>{content}</View></ScrollView>:<View style={[s.page,{alignItems:'center'}]}><View style={{width:'100%',maxWidth,flex:1,overflow:'hidden'}}>{content}</View></View>; }
export function SectionTitle({title,action,onAction}:any) { useTheme(); const s=makeStyles(); return <View style={[s.rowBetween,{gap:12,flexWrap:'wrap'}]}><Text size={19} weight="700" style={{flexShrink:1}}>{title}</Text>{action&&<Button title={action} variant="ghost" size="small" onPress={onAction}/>}</View>; }
export function BackButton({onPress}:any) { useTheme(); return <IconButton icon="arrow-back" label="Go back" variant="secondary" onPress={onPress}/>; }
const makeStyles=()=>StyleSheet.create({
  genericCard:{backgroundColor:colors.surface,borderRadius:radius.md,padding:space.lg,borderWidth:1,borderColor:colors.border,...shadow},
  inputField:{minWidth:0,minHeight:controls.medium.minHeight,paddingHorizontal:14,paddingVertical:11,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,backgroundColor:colors.surfaceElevated,fontSize:16,color:colors.textPrimary,fontFamily:typefaces.sansRegular,lineHeight:24},
  inputMultiline:{minHeight:144,textAlignVertical:'top'},
  inputBare:{minHeight:44,paddingHorizontal:0,paddingVertical:0,borderWidth:0,borderRadius:0,backgroundColor:'transparent'},
  inputFocused:{borderColor:colors.focus},
  page:{flex:1,backgroundColor:colors.background},
  pageInner:{paddingHorizontal:space.xl,paddingTop:space.lg+2,paddingBottom:136,width:'100%'},
  button:{minWidth:0,maxWidth:'100%',flexShrink:1,borderRadius:radius.md,borderWidth:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:space.sm},
  buttonLabel:{flexShrink:1,textAlign:'center',lineHeight:20},
  buttonPrimaryHover:{backgroundColor:colors.accentHover,borderColor:colors.accentHover},
  buttonPrimaryPressed:{backgroundColor:colors.accentPressed,borderColor:colors.accentPressed},
  buttonDangerPressed:{opacity:.82},
  buttonDangerHover:{opacity:.9},
  buttonSurfaceHover:{backgroundColor:colors.surfaceHover,borderColor:colors.border},
  buttonGhostHover:{backgroundColor:colors.surfaceHover},
  iconButton:{flexShrink:0,borderRadius:radius.md,borderWidth:1,alignItems:'center',justifyContent:'center'},
  disabled:{opacity:.45},
  avatar:{alignItems:'center',justifyContent:'center'},
  badge:{paddingHorizontal:10,paddingVertical:6,borderRadius:3,backgroundColor:colors.surfaceStrong,alignSelf:'flex-start'},
  filterChip:{maxWidth:'100%',minHeight:controls.small.minHeight,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:space.sm,paddingHorizontal:12,paddingVertical:10,borderRadius:radius.md,backgroundColor:colors.surfaceElevated,borderWidth:1,borderColor:colors.border},
  chipLabel:{flexShrink:1,lineHeight:20},
  filterChipSelected:{backgroundColor:colors.accent,borderColor:colors.accent},
  chipHover:{borderColor:colors.accentHover},
  chipSelectedHover:{backgroundColor:colors.accentHover,borderColor:colors.accentHover},
  search:{minHeight:52,borderRadius:3,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,flexDirection:'row',alignItems:'center',paddingLeft:16,paddingRight:8,gap:10},
  searchInput:{flex:1,fontSize:16,color:colors.textPrimary,fontFamily:typefaces.sansRegular,lineHeight:24},
  searchClear:{borderWidth:0,backgroundColor:'transparent'},
  placeCard:{width:'100%',borderRadius:3,backgroundColor:colors.surface,overflow:'hidden',borderWidth:1,borderColor:colors.border,...shadow},
  placeImage:{width:'100%',height:170,backgroundColor:colors.surfaceElevated},
  placeImageWide:{width:'100%',height:158,backgroundColor:colors.surfaceElevated},
  placeInfo:{padding:14},
  rowBetween:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  reviewCard:{padding:16,marginTop:12},
});
