import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { PlayfairDisplay_500Medium, PlayfairDisplay_500Medium_Italic } from '@expo-google-fonts/playfair-display';
import { DMMono_400Regular, DMMono_500Medium } from '@expo-google-fonts/dm-mono';
import { useColorScheme } from 'react-native';
import { ActivityIndicator, View } from 'react-native';
import { useEffect, useState, type PropsWithChildren } from 'react';
import { setActivePalette, ThemeContext, type ThemeMode } from './index';
import { colors } from './index';

const preferenceKey = 'the-list-theme-mode';
export function ThemeProvider({ children }: PropsWithChildren) {
  const [fontsLoaded] = useFonts({ DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold, PlayfairDisplay_500Medium, PlayfairDisplay_500Medium_Italic, DMMono_400Regular, DMMono_500Medium });
  const systemScheme = useColorScheme() === 'light' ? 'light' : 'dark';
  const [mode, setModeState] = useState<ThemeMode>('dark');
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { AsyncStorage.getItem(preferenceKey).then(value => { if (value === 'light' || value === 'dark' || value === 'system') setModeState(value); }).catch(() => {}).finally(() => setLoaded(true)); }, []);
  const setMode = (next: ThemeMode) => { setModeState(next); void AsyncStorage.setItem(preferenceKey, next).catch(() => {}); };
  const scheme = mode === 'system' ? systemScheme : mode;
  setActivePalette(scheme);
  if (!fontsLoaded) return <View accessibilityRole="progressbar" accessibilityLabel="Loading The List typefaces" style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.accent}/></View>;
  return <ThemeContext.Provider value={{ mode: loaded ? mode : 'system', scheme, setMode }}>{children}</ThemeContext.Provider>;
}
