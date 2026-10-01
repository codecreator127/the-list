import { router } from 'expo-router';
import { Image, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Float, PressableScale } from '../components/motion';
import { Text, Button, Badge } from '../components/ui';
import { colors, radius, typefaces } from '../theme';
import { isFirebaseRepositoryEnabled } from '../services/firebase';

const restaurants = [
	{ name: 'Ramen Danbo', detail: 'Japanese · Haymarket', score: '5.0', image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=85' },
	{ name: 'Bistecca', detail: 'Italian · Sydney CBD', score: '4.8', image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=85' },
	{ name: 'Pellegrino 2000', detail: 'Italian · Surry Hills', score: '4.6', image: 'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=800&q=85' },
];

const steps = [
	{ number: '01', title: 'Discover', body: 'Find the places you have been meaning to try.', icon: 'search-outline' as const },
	{ number: '02', title: 'Rate', body: 'Give every meal a score that feels like you.', icon: 'star-outline' as const },
	{ number: '03', title: 'Rank', body: 'Watch your personal List take shape.', icon: 'arrow-up-outline' as const },
];

const serif = typefaces.serif;

export default function Welcome() {
	const { width } = useWindowDimensions();
	const compact = width < 760;
	const styles = makeStyles();
	const start = () => router.replace(isFirebaseRepositoryEnabled ? '/auth?mode=create' : '/(tabs)/home');
	const signIn = () => router.push('/auth');
	const openSearch = () => router.push('/(tabs)/search');
	const openList = () => router.push('/(tabs)/list');

	return <ScrollView style={styles.root} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
		<View style={styles.header}>
			<PressableScale accessibilityRole="button" accessibilityLabel="The List home" onPress={() => router.replace('/')} style={styles.wordmark}>
				<Ionicons name="restaurant-outline" size={21} color={colors.accent}/><Text size={18} weight="700">The List</Text>
			</PressableScale>
			{!compact ? <View style={styles.nav}><PressableScale onPress={openSearch} style={styles.navLink}><Text size={14} color={colors.textPrimary}>Explore</Text><View style={styles.navDot}/></PressableScale><PressableScale onPress={openList} style={styles.navLink}><Text size={14} color={colors.textMuted}>My List</Text></PressableScale></View> : null}
			<View style={styles.headerActions}>{!compact && isFirebaseRepositoryEnabled ? <PressableScale onPress={signIn} style={styles.signIn}><Text size={14} color={colors.textMuted}>Sign in</Text></PressableScale> : null}<Button title={compact ? 'Get started' : 'Get started'} icon="arrow-up" size="small" onPress={start} style={styles.headerButton}/></View>
		</View>

		<View style={[styles.hero, compact && styles.heroCompact]}>
			<View style={[styles.heroCopy, compact && styles.heroCopyCompact]}>
				<View style={styles.eyebrow}><View style={styles.eyebrowLine}/><Text size={10} weight="600" color={colors.textMuted}>A BETTER WAY TO REMEMBER WHERE YOU EAT</Text></View>
				<Text size={compact ? 54 : 76} weight="500" style={[styles.heroTitle, { lineHeight: compact ? 58 : 81 }]}>Every place{ '\n' }you’ve eaten.{ '\n' }<Text size={compact ? 54 : 76} weight="500" color={colors.accent} style={styles.serifItalic}>Ranked.</Text></Text>
				<Text size={16} color={colors.textMuted} style={styles.heroDescription}>Rate the places you try and build your definitive List of the best food you’ve found.</Text>
				<View style={[styles.heroActions, compact && styles.heroActionsCompact]}><Button title="Start your List" icon="arrow-up" size="large" onPress={start} style={styles.heroButton}/><PressableScale onPress={openSearch} style={styles.textLink}><Text size={14} weight="600">Explore the app</Text><Ionicons name="arrow-down" size={16} color={colors.textPrimary}/></PressableScale></View>
				<View style={styles.heroNote}><View style={styles.avatarStack}><View style={[styles.avatar, styles.avatarOne]}/><View style={[styles.avatar, styles.avatarTwo]}/><View style={[styles.avatar, styles.avatarThree]}/></View><Text size={11} color={colors.textMuted} style={styles.noteCopy}>Made for people who care{ '\n' }where they eat.</Text></View>
			</View>

			<View style={[styles.heroVisual, compact && styles.heroVisualCompact]}>
				<View style={[styles.stamp, compact && styles.stampCompact]}><Text size={10} weight="600" color={colors.textMuted}>YOUR</Text><Text size={18} weight="700" color={colors.accent}>LIST</Text></View>
				<Float style={styles.previewFloat} distance={9} duration={3000}>
				<View style={[styles.listPreview, compact && styles.listPreviewCompact]}>
					<View style={styles.previewTop}><Text size={10} weight="600" color={colors.textMuted} style={styles.mono}>MY LIST</Text><View style={styles.profileDot}><Text size={9} weight="700" color={colors.onAccent}>JD</Text></View></View>
					<View style={styles.listIntro}><View><Text size={10} color={colors.textMuted} style={styles.mono}>JORDAN’S PLACES</Text></View><Text size={31} weight="500" style={styles.serif}>12 <Text size={11} color={colors.textMuted}>spots</Text></Text></View>
					{restaurants.map((restaurant, index) => <View key={restaurant.name} style={styles.restaurantRow}>
						<Text size={11} color={colors.accent} style={styles.mono}>{`0${index + 1}`}</Text><Image source={{ uri: restaurant.image }} style={styles.restaurantImage}/>
						<View style={styles.restaurantInfo}><Text size={13} weight="600" numberOfLines={1}>{restaurant.name}</Text><Text size={10} color={colors.textMuted} numberOfLines={1} style={{ marginTop: 3 }}>{restaurant.detail}</Text><View style={styles.stars}>{Array.from({ length: 5 }, (_, star) => <Ionicons key={star} name="star" size={10} color={colors.rating}/>)}</View></View><Text size={14} style={styles.serif}>{restaurant.score}</Text>
					</View>)}
					<View style={styles.previewFooter}><View style={styles.addPlace}><Ionicons name="add" size={15} color={colors.textPrimary}/><Text size={10} weight="600">Add a place</Text></View><Text size={9} color={colors.textMuted} style={styles.mono}>UPDATED JUST NOW</Text></View>
				</View>
				</Float>
				<View style={[styles.floatingNote, compact && styles.floatingNoteCompact]}><View style={styles.pulseDot}/><Text size={11} color={colors.textMuted}>Your next favourite{ '\n' }<Text size={11} weight="700" color={colors.textPrimary}>could be anywhere.</Text></Text></View>
			</View>
		</View>

		<View style={styles.introBand}><Text size={10} weight="600" color={colors.textMuted} style={styles.mono}>NOT ANOTHER REVIEW APP</Text><Text size={compact ? 38 : 56} weight="500" style={[styles.introTitle, { lineHeight: compact ? 43 : 62 }]}>A running record of{ '\n' }<Text size={compact ? 38 : 56} color={colors.accent} style={styles.serifItalic}>everywhere</Text>{ '\n'}you’ve loved to eat.</Text></View>

		<View style={[styles.section, compact && styles.sectionCompact]}>
			<View style={styles.sectionLabel}><Text size={10} weight="600" color={colors.textMuted} style={styles.mono}>THE SIMPLE PART</Text><Text size={10} color={colors.textMuted} style={styles.mono}>01 — 03</Text></View>
			<View style={[styles.stepsGrid, compact && styles.stepsGridCompact]}>{steps.map(step => <View key={step.number} style={[styles.step, compact && styles.stepCompact]}><View style={styles.stepTop}><Text size={14} color={colors.accent} style={styles.mono}>{step.number}</Text><Ionicons name={step.icon} size={20} color={colors.accent}/></View><Text size={35} weight="500" style={styles.serif}>{step.title}</Text><Text size={14} color={colors.textMuted} style={styles.stepBody}>{step.body}</Text><View style={styles.stepRule}/></View>)}</View>
		</View>

		<View style={[styles.snapshot, compact && styles.snapshotCompact]}>
			<View style={styles.snapshotCopy}><View style={styles.eyebrow}><View style={styles.eyebrowLine}/><Text size={10} weight="600" color={colors.textMuted}>A LIST WORTH KEEPING</Text></View><Text size={compact ? 39 : 55} weight="500" style={[styles.snapshotTitle, { lineHeight: compact ? 43 : 58 }]}>Somewhere between a diary and a <Text size={compact ? 39 : 55} color={colors.accent} style={styles.serifItalic}>hot take.</Text></Text><Text size={14} color={colors.textMuted} style={styles.snapshotBody}>Because the best recommendations are the ones you make for yourself. The List keeps them all in one place, in an order that actually means something.</Text><PressableScale onPress={start} style={styles.textLink}><Text size={14} weight="600">Make your first entry</Text><Ionicons name="arrow-up" size={16} color={colors.textPrimary}/></PressableScale></View>
			<View style={styles.snapshotImageWrap}><Image source={{ uri: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1200&q=85' }} style={[styles.snapshotImage, compact && styles.snapshotImageCompact]}/><View style={styles.imageCaption}><Text size={10} color={colors.textPrimary} style={styles.mono}>THE PLACES{ '\n' }THAT STAY WITH YOU</Text></View></View>
		</View>

		<View style={[styles.socialSection, compact && styles.socialSectionCompact]}>
			<View style={styles.socialHeading}><View style={styles.eyebrow}><View style={styles.eyebrowLine}/><Text size={10} weight="600" color={colors.textMuted}>COMING SOON</Text></View><Text size={compact ? 56 : 74} weight="500" style={[styles.socialTitle, { lineHeight: compact ? 59 : 78 }]}>Your List.{ '\n' }<Text size={compact ? 56 : 74} color={colors.accent} style={styles.serifItalic}>Their Lists.</Text>{ '\n' }One verdict.</Text></View>
			<View style={styles.socialCard}><View style={[styles.convergeCard, styles.convergeOne]}><Text size={13} color={colors.accent} style={styles.mono}>01</Text><View><Text size={12} weight="700">Ramen Danbo</Text><Text size={9} color={colors.textMuted}>Jordan’s List</Text></View></View><View style={[styles.convergeCard, styles.convergeTwo]}><Text size={13} color={colors.accent} style={styles.mono}>02</Text><View><Text size={12} weight="700">Ramen Danbo</Text><Text size={9} color={colors.textMuted}>Sam’s List</Text></View></View><View style={[styles.convergeCard, styles.convergeThree]}><Text size={13} color={colors.accent} style={styles.mono}>01</Text><View><Text size={12} weight="700">Ramen Danbo</Text><Text size={9} color={colors.textMuted}>Our List</Text></View></View><Text size={13} color={colors.textSecondary} style={styles.socialCaption}>When your Lists meet,{ '\n' }the answer gets clearer.</Text></View>
		</View>

		<View style={styles.finalCta}><Text size={10} weight="600" color={colors.onAccent} style={styles.mono}>START WITH ONE</Text><Text size={compact ? 48 : 76} weight="500" color={colors.onAccent} style={[styles.finalTitle, { lineHeight: compact ? 53 : 82 }]}>What’s your{ '\n' }<Text size={compact ? 48 : 76} color={colors.textPrimary} style={styles.serifItalic}>number one?</Text></Text><Button title="Start your List" icon="arrow-up" variant="secondary" size="large" onPress={start} style={styles.finalButton}/></View>

		<View style={[styles.footer, compact && styles.footerCompact]}><View><PressableScale onPress={() => router.replace('/')} style={styles.wordmark}><Ionicons name="restaurant-outline" size={19} color={colors.accent}/><Text size={16} weight="700">The List</Text></PressableScale><Text size={12} color={colors.textMuted} style={{ marginTop: 10 }}>Your places. Ranked.</Text></View><View style={styles.footerLinks}><PressableScale onPress={openSearch}><Text size={12}>Explore</Text></PressableScale><PressableScale onPress={openList}><Text size={12}>My List</Text></PressableScale><PressableScale onPress={signIn}><Text size={12}>Sign in</Text></PressableScale></View><Text size={11} color={colors.textMuted} style={styles.copyright}>© 2026 The List</Text></View>
	</ScrollView>;
}

const makeStyles = () => StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.background },
	scrollContent: { alignItems: 'center' },
	header: { width: '100%', maxWidth: 1320, minHeight: 82, paddingHorizontal: 44, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
	wordmark: { flexDirection: 'row', alignItems: 'center', gap: 8 },
	nav: { flexDirection: 'row', alignItems: 'center', gap: 32 },
	navLink: { minHeight: 42, alignItems: 'center', justifyContent: 'center', position: 'relative' },
	navDot: { position: 'absolute', bottom: 1, width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accent },
	headerActions: { flexDirection: 'row', alignItems: 'center', gap: 22 },
	signIn: { paddingVertical: 10 },
	headerButton: { minHeight: 40, height: 40, borderRadius: 3, backgroundColor: colors.textPrimary, borderColor: colors.textPrimary },
	hero: { width: '100%', maxWidth: 1320, minHeight: 650, paddingHorizontal: 64, paddingVertical: 76, flexDirection: 'row', alignItems: 'center', gap: 64 },
	heroCompact: { minHeight: 0, paddingHorizontal: 22, paddingTop: 58, paddingBottom: 55, flexDirection: 'column', alignItems: 'stretch', gap: 24 },
	heroCopy: { flex: 1, paddingBottom: 18 },
	heroCopyCompact: { paddingBottom: 0 },
	eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
	eyebrowLine: { width: 21, height: 1, backgroundColor: colors.accent },
	heroTitle: { marginTop: 25, marginBottom: 24, fontFamily: serif, letterSpacing: -1.2 },
	serif: { fontFamily: serif },
	serifItalic: { fontFamily: typefaces.serifItalic },
	heroDescription: { maxWidth: 360, lineHeight: 25 },
	heroActions: { flexDirection: 'row', alignItems: 'center', gap: 26, marginTop: 32 },
	heroActionsCompact: { flexWrap: 'wrap', gap: 18 },
	heroButton: { borderRadius: 3, backgroundColor: colors.textPrimary, borderColor: colors.textPrimary },
	textLink: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderBottomColor: colors.textMuted, paddingBottom: 4 },
	heroNote: { flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: 54 },
	avatarStack: { flexDirection: 'row', alignItems: 'center' },
	avatar: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.background, marginLeft: -5 },
	avatarOne: { backgroundColor: colors.accentPressed, marginLeft: 0 },
	avatarTwo: { backgroundColor: colors.surfaceStrong },
	avatarThree: { backgroundColor: colors.rating },
	noteCopy: { lineHeight: 15 },
	heroVisual: { flex: 1, minHeight: 520, alignItems: 'center', justifyContent: 'center', position: 'relative' },
	heroVisualCompact: { minHeight: 470, marginHorizontal: -8 },
	stamp: { position: 'absolute', top: 28, left: 10, zIndex: 1, width: 78, height: 78, borderRadius: 39, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-12deg' }] },
	stampCompact: { top: 4, left: 0 },
	previewFloat: { width: '100%', alignItems: 'center' },
	listPreview: { width: '96%', maxWidth: 440, paddingHorizontal: 24, paddingTop: 22, paddingBottom: 18, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border, ...{ shadowColor: colors.shadow, shadowOffset: { width: 12, height: 18 }, shadowOpacity: 0.35, shadowRadius: 28, elevation: 8 }, transform: [{ rotate: '2deg' }] },
	listPreviewCompact: { width: '96%', paddingHorizontal: 16 },
	previewTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 14 },
	mono: { fontFamily: typefaces.mono, letterSpacing: 1 },
	profileDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
	listIntro: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 22, paddingBottom: 12 },
	restaurantRow: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 10 },
	restaurantImage: { width: 54, height: 54, borderRadius: 2, backgroundColor: colors.surfaceStrong },
	restaurantInfo: { flex: 1, minWidth: 0 },
	stars: { flexDirection: 'row', gap: 1, marginTop: 5 },
	previewFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14, marginTop: 3 },
	addPlace: { flexDirection: 'row', alignItems: 'center', gap: 5 },
	floatingNote: { position: 'absolute', bottom: 28, right: -7, backgroundColor: colors.surfaceStrong, paddingHorizontal: 15, paddingVertical: 12, borderRadius: 2, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
	floatingNoteCompact: { bottom: 13, right: -1 },
	pulseDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent, marginTop: 4 },
	introBand: { width: '100%', alignItems: 'center', backgroundColor: colors.surface, paddingHorizontal: 20, paddingVertical: 96 },
	introTitle: { marginTop: 22, textAlign: 'center', fontFamily: serif, letterSpacing: -0.6 },
	section: { width: '100%', maxWidth: 1320, paddingHorizontal: 64, paddingTop: 92, paddingBottom: 100 },
	sectionCompact: { paddingHorizontal: 22, paddingTop: 70, paddingBottom: 76 },
	sectionLabel: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 14 },
	stepsGrid: { flexDirection: 'row', gap: 48 },
	stepsGridCompact: { flexDirection: 'column', gap: 0 },
	step: { flex: 1, paddingTop: 32 },
	stepCompact: { flex: 0, paddingTop: 28 },
	stepTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 45 },
	stepBody: { maxWidth: 210, lineHeight: 21, marginTop: 10 },
	stepRule: { height: 1, backgroundColor: colors.border, marginTop: 36 },
	snapshot: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 70, paddingHorizontal: 64, paddingVertical: 90, backgroundColor: colors.surface },
	snapshotCompact: { flexDirection: 'column', alignItems: 'stretch', gap: 38, paddingHorizontal: 22, paddingVertical: 70 },
	snapshotCopy: { flex: 0.8 },
	snapshotTitle: { fontFamily: serif, marginTop: 25, marginBottom: 22, letterSpacing: -0.7 },
	snapshotBody: { maxWidth: 400, lineHeight: 23, marginBottom: 24 },
	snapshotImageWrap: { flex: 1.2, position: 'relative' },
	snapshotImage: { width: '100%', height: 470, backgroundColor: colors.surfaceStrong },
	snapshotImageCompact: { height: 360 },
	imageCaption: { position: 'absolute', bottom: 15, left: 16 },
	socialSection: { width: '100%', maxWidth: 1320, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 60, paddingHorizontal: 64, paddingVertical: 110 },
	socialSectionCompact: { flexDirection: 'column', alignItems: 'stretch', gap: 32, paddingHorizontal: 22, paddingVertical: 78 },
	socialHeading: { flex: 1 },
	socialTitle: { fontFamily: serif, marginTop: 25, letterSpacing: -0.8 },
	socialCard: { flex: 1, minHeight: 390, backgroundColor: colors.surfaceStrong, padding: 28, position: 'relative', overflow: 'hidden' },
	convergeCard: { position: 'absolute', minWidth: 220, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 15, paddingVertical: 13, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
	convergeOne: { top: 43, left: 27, transform: [{ rotate: '-5deg' }] },
	convergeTwo: { top: 128, right: 15, transform: [{ rotate: '4deg' }] },
	convergeThree: { bottom: 88, left: 53, backgroundColor: colors.textPrimary, transform: [{ rotate: '-2deg' }] },
	socialCaption: { position: 'absolute', right: 22, bottom: 17, textAlign: 'right', lineHeight: 18 },
	finalCta: { width: '100%', alignItems: 'center', backgroundColor: colors.accent, paddingHorizontal: 20, paddingVertical: 96 },
	finalTitle: { marginTop: 24, marginBottom: 34, textAlign: 'center', fontFamily: serif, letterSpacing: -0.8 },
	finalButton: { minWidth: 170, borderRadius: 3, backgroundColor: colors.background, borderColor: colors.background },
	footer: { width: '100%', maxWidth: 1320, minHeight: 145, paddingHorizontal: 64, paddingVertical: 40, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
	footerCompact: { minHeight: 0, paddingHorizontal: 22, paddingVertical: 36, flexWrap: 'wrap', alignItems: 'center', gap: 26 },
	footerLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 24 },
	copyright: { textAlign: 'right' },
});
