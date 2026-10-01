import { createContext, useContext } from 'react';

const light = { ink: '#1D231F', muted: '#687068', paper: '#F6F6F0', white: '#FFFFFF', line: '#E4E6DD', green: '#315F42', greenDark: '#274D36', lime: '#E6ECD2', orange: '#E89B5D', star: '#D88B2F', soft: '#EEF1E8', danger: '#B5453B' };
const dark = { ink: '#F2F3EE', muted: '#A7ADA3', paper: '#171A17', white: '#232823', line: '#383F38', green: '#91B99A', greenDark: '#B4D0B6', lime: '#394334', orange: '#E89B5D', star: '#E6AA5D', soft: '#2C332D', danger: '#EF9384' };
let activePalette: typeof light = light;
export function setActivePalette(scheme: 'light' | 'dark') { activePalette = scheme === 'dark' ? dark : light; }
export const colors = new Proxy({} as typeof light, { get: (_target, key: keyof typeof light) => activePalette[key] });
export type ThemeMode = 'system' | 'light' | 'dark';
export type ThemeContextValue = { mode: ThemeMode; scheme: 'light' | 'dark'; setMode: (mode: ThemeMode) => void };
export const ThemeContext = createContext<ThemeContextValue>({ mode: 'system', scheme: 'light', setMode: () => {} });
export const useTheme = () => useContext(ThemeContext);
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, huge: 44 };
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };
export const shadow = { shadowColor: '#273728', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 2 };
export const typography = { xs: 11, sm: 13, body: 15, subtitle: 19, title: 27, display: 42, regular: '400', medium: '500', semibold: '600', bold: '700' } as const;
