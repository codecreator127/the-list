import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import { useEffect, useState, type PropsWithChildren } from 'react';
import { setActivePalette, ThemeContext, type ThemeMode } from './index';

const preferenceKey = 'the-list-theme-mode';
export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme() === 'light' ? 'light' : 'dark';
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { AsyncStorage.getItem(preferenceKey).then(value => { if (value === 'light' || value === 'dark' || value === 'system') setModeState(value); }).catch(() => {}).finally(() => setLoaded(true)); }, []);
  const setMode = (next: ThemeMode) => { setModeState(next); void AsyncStorage.setItem(preferenceKey, next).catch(() => {}); };
  const scheme = mode === 'system' ? systemScheme : mode;
  setActivePalette(scheme);
  return <ThemeContext.Provider value={{ mode: loaded ? mode : 'system', scheme, setMode }}>{children}</ThemeContext.Provider>;
}
