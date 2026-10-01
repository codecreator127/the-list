import { createContext, useContext } from 'react';

type SemanticPalette = {
	background: string;
	surface: string;
	surfaceElevated: string;
	surfaceStrong: string;
	surfaceHover: string;
	textPrimary: string;
	textSecondary: string;
	textMuted: string;
	accent: string;
	accentHover: string;
	accentPressed: string;
	onAccent: string;
	rating: string;
	border: string;
	error: string;
	disabled: string;
	focus: string;
	scrim: string;
	shadow: string;
};

type Palette = SemanticPalette & {
	ink: string;
	muted: string;
	paper: string;
	white: string;
	line: string;
	green: string;
	greenDark: string;
	lime: string;
	orange: string;
	star: string;
	soft: string;
	danger: string;
};

function withLegacyAliases(palette: SemanticPalette): Palette {
	return {
		...palette,
		ink: palette.textPrimary,
		muted: palette.textMuted,
		paper: palette.background,
		white: palette.surface,
		line: palette.border,
		green: palette.accent,
		greenDark: palette.surfaceStrong,
		lime: palette.surfaceStrong,
		orange: palette.accent,
		star: palette.rating,
		soft: palette.surface,
		danger: palette.error,
	};
}

const light = withLegacyAliases({
	background: '#F4F0E5',
	surface: '#E6E7DC',
	surfaceElevated: '#FBF8EF',
	surfaceStrong: '#D8DED1',
	surfaceHover: '#DCE1D5',
	textPrimary: '#252820',
	textSecondary: '#55594F',
	textMuted: '#73766B',
	accent: '#A84310',
	accentHover: '#913B0D',
	accentPressed: '#7D310A',
	onAccent: '#FFF8EA',
	rating: '#94600A',
	border: '#CFD2C6',
	error: '#B63E35',
	disabled: '#8A897F',
	focus: '#974108',
	scrim: 'rgba(23, 24, 22, 0.62)',
	shadow: '#20251D',
});

const dark = withLegacyAliases({
	background: '#111311',
	surface: '#1C211E',
	surfaceElevated: '#191C19',
	surfaceStrong: '#26332C',
	surfaceHover: '#303B34',
	textPrimary: '#F3EEE5',
	textSecondary: '#D1C9BC',
	textMuted: '#A7A69D',
	accent: '#E8875C',
	accentHover: '#F0A179',
	accentPressed: '#D16C47',
	onAccent: '#17120F',
	rating: '#F6B94A',
	border: '#343832',
	error: '#E7675D',
	disabled: '#716D62',
	focus: '#FF9138',
	scrim: 'rgba(17, 19, 17, 0.72)',
	shadow: '#090A09',
});
let activePalette: Palette = light;
export function setActivePalette(scheme: 'light' | 'dark') { activePalette = scheme === 'dark' ? dark : light; }
export const colors = new Proxy({} as Palette, { get: (_target, key: keyof Palette) => activePalette[key] });
export type ThemeMode = 'system' | 'light' | 'dark';
export type ThemeContextValue = { mode: ThemeMode; scheme: 'light' | 'dark'; setMode: (mode: ThemeMode) => void };
export const ThemeContext = createContext<ThemeContextValue>({ mode: 'system', scheme: 'light', setMode: () => {} });
export const useTheme = () => useContext(ThemeContext);
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, huge: 44 };
export const radius = { sm: 3, md: 3, lg: 3, pill: 3 };
export const typefaces = {
	sansRegular: 'DMSans_400Regular',
	sansMedium: 'DMSans_500Medium',
	sansSemibold: 'DMSans_600SemiBold',
	sansBold: 'DMSans_700Bold',
	serif: 'PlayfairDisplay_500Medium',
	serifItalic: 'PlayfairDisplay_500Medium_Italic',
	mono: 'DMMono_400Regular',
	monoMedium: 'DMMono_500Medium',
} as const;
export const shadow = new Proxy({ shadowColor: '', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 2 }, {
	get: (target, key: string | symbol) => key === 'shadowColor' ? activePalette.shadow : Reflect.get(target, key),
});
export const typography = { xs: 11, sm: 13, body: 15, subtitle: 19, title: 27, display: 42, regular: '400', medium: '500', semibold: '600', bold: '700', compactLineHeight: 1.12, bodyLineHeight: 1.5 } as const;
