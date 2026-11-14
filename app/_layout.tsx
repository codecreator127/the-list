import { Stack, router, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../theme';
import { watchAuthState } from '../services/auth';
import { isFirebaseRepositoryEnabled } from '../services/firebase';
import { foodService } from '../services/foodService';
import { ThemeProvider } from '../theme/ThemeProvider';
import { useTheme } from '../theme';
import { FullScreenLoading } from '../components/FullScreenLoading';
function AppNavigator(){const segments=useSegments();const {scheme}=useTheme();const [authReady,setAuthReady]=useState(!isFirebaseRepositoryEnabled);const [signedIn,setSignedIn]=useState(false);useEffect(() => {
  if (!isFirebaseRepositoryEnabled) return;
  let firstAuthState = true;
  return watchAuthState(user => {
    const restoringSession = firstAuthState && !!user;
    firstAuthState = false;
    setSignedIn(!!user);
    // The sign-in screen initializes profiles for interactive sign-ins.
    if (restoringSession) void foodService.ensureCurrentUserProfile().catch(() => undefined).finally(() => setAuthReady(true));
    else setAuthReady(true);
  });
}, []);useEffect(()=>{if(!isFirebaseRepositoryEnabled||!authReady||!segments.length)return;const first=segments[0];if(!signedIn&&first!=='index'&&first!=='auth'&&first!=='review')router.replace('/');else if(signedIn&&first==='index')router.replace('/(tabs)/home');},[authReady,signedIn,segments]);if(!authReady)return <FullScreenLoading message="Getting your table ready…" />;return <><StatusBar style={scheme==='dark'?'light':'dark'}/><Stack screenOptions={{headerShown:false,contentStyle:{backgroundColor:colors.paper}}}/></>;}
export default function RootLayout(){return <ThemeProvider><AppNavigator/></ThemeProvider>;}
