import { Stack, router, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../theme';
import { watchAuthState } from '../services/auth';
import { isFirebaseRepositoryEnabled } from '../services/firebase';
import { foodService } from '../services/foodService';
import { ThemeProvider } from '../theme/ThemeProvider';
import { useTheme } from '../theme';
import { Text } from '../components/ui';
function AppNavigator(){const segments=useSegments();const {scheme}=useTheme();const [authReady,setAuthReady]=useState(!isFirebaseRepositoryEnabled);const [signedIn,setSignedIn]=useState(false);useEffect(()=>{if(!isFirebaseRepositoryEnabled)return;return watchAuthState(user=>{setSignedIn(!!user);if(user){void foodService.ensureCurrentUserProfile().catch(()=>undefined).finally(()=>setAuthReady(true));}else setAuthReady(true);});},[]);useEffect(()=>{if(!isFirebaseRepositoryEnabled||!authReady||!segments.length)return;const first=segments[0];if(!signedIn&&first!=='index'&&first!=='auth')router.replace('/');else if(signedIn&&first==='index')router.replace('/(tabs)/home');},[authReady,signedIn,segments]);if(!authReady)return <View accessibilityRole="progressbar" accessibilityLabel="Getting The List ready" style={{flex:1,backgroundColor:colors.paper,alignItems:'center',justifyContent:'center'}}><Ionicons name="restaurant-outline" size={30} color={colors.green}/><ActivityIndicator color={colors.green} style={{marginTop:16}}/><Text size={13} color={colors.muted} style={{marginTop:10}}>Getting your table ready…</Text></View>;return <><StatusBar style={scheme==='dark'?'light':'dark'}/><Stack screenOptions={{headerShown:false,contentStyle:{backgroundColor:colors.paper}}}/></>;}
export default function RootLayout(){return <ThemeProvider><AppNavigator/></ThemeProvider>;}
