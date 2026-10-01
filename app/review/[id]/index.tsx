import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BackButton, Button, Page, Text } from '../../../components/ui';
import { foodService } from '../../../services/foodService';
import { isFirebaseRepositoryEnabled } from '../../../services/firebase';
import { watchAuthState } from '../../../services/auth';
import { reviewSubcategories, type Place, type ReviewSubcategory } from '../../../types/models';
import { colors, radius, useTheme } from '../../../theme';
import { PressableScale } from '../../../components/motion';

function StarScale({ value, onChange, label, compact = false, allowClear = false }: { value: number; onChange: (rating: number) => void; label: string; compact?: boolean; allowClear?: boolean }) {
  const s = makeStyles();
  return <View style={s.scaleRow}>
    {Array.from({ length: 10 }, (_, index) => {
      const score = index + 1;
      const selected = score <= value;
      return <PressableScale key={score} accessibilityRole="button" accessibilityLabel={`${label}: ${score} out of 10`} accessibilityState={{ selected: value === score }} onPress={() => onChange(allowClear && value === score ? 0 : score)} style={[s.scaleStar, compact && s.compactScaleStar, selected && s.selected]}>
        <Ionicons name={selected ? 'star' : 'star-outline'} size={compact ? 17 : 23} color={selected ? colors.star : colors.muted} />
      </PressableScale>;
    })}
  </View>;
}

const categoryLabels: Record<ReviewSubcategory, string> = { food: 'Food', service: 'Service', atmosphere: 'Atmosphere', value: 'Value' };

export default function WriteReview() {useTheme(); const s = makeStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [rating, setRating] = useState(0);
  const [subRatings, setSubRatings] = useState<Partial<Record<ReviewSubcategory, number>>>({});
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [place, setPlace] = useState<Place>();

  useEffect(() => { foodService.getPlace(id).then(setPlace).catch(() => setError('Could not load this place.')); }, [id]);
  useEffect(() => {
    if (!isFirebaseRepositoryEnabled) return;
    return watchAuthState(user => {
      if (!user) router.replace(`/auth?returnTo=${encodeURIComponent(`/review/${id}`)}`);
    });
  }, [id]);
  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => router.back(), 360);
    return () => clearTimeout(timer);
  }, [success]);

  async function submit() {
    if (saving) return;
    if (!rating) { setError('Choose a star rating to continue.'); return; }
    setError(''); setSaving(true);
    try { await foodService.addReview(id, rating, body.trim(), subRatings); setSuccess(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save your review. Please try again.'); setSaving(false); }
  }

  return <Page maxWidth={720}><View style={s.header}><BackButton onPress={() => router.back()} /><Text size={15} weight="600" style={{ marginLeft: 12 }}>Write a review</Text></View><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}><Text size={27} weight="700">How was {place?.name ?? 'your meal'}?</Text><Text size={14} color={colors.muted} style={{ marginTop: 7, lineHeight: 21 }}>Your honest note helps friends find a good place.</Text><View style={{ marginTop: 22 }}><View style={s.labelRow}><Text size={13} weight="600">Overall rating</Text><Text size={12} weight="700" color={rating ? colors.green : colors.muted}>{rating ? `${rating} / 10` : 'Choose 1–10'}</Text></View><StarScale label="Overall rating" value={rating} onChange={value => { setRating(value); setError(''); }} /></View><View style={s.categories}><Text size={15} weight="700">Optional details</Text><Text size={12} color={colors.muted} style={{ marginTop: 5, lineHeight: 18 }}>These category ratings together influence your overall score by just 10%.</Text>{reviewSubcategories.map(category => <View key={category} style={s.categoryRow}><View style={s.labelRow}><Text size={13} weight="600">{categoryLabels[category]}</Text><Text size={11} color={subRatings[category] ? colors.green : colors.muted}>{subRatings[category] ? `${subRatings[category]} / 10` : 'Optional'}</Text></View><StarScale compact allowClear label={categoryLabels[category]} value={subRatings[category] ?? 0} onChange={value => setSubRatings(current => { const next = { ...current }; if (value) next[category] = value; else delete next[category]; return next; })} /></View>)}</View><Text size={13} weight="600" style={{ marginTop: 22 }}>Your note (optional)</Text><TextInput accessibilityLabel="Your review note (optional)" value={body} onChangeText={setBody} multiline maxLength={500} textAlignVertical="top" placeholder="What did you order? What should someone know before they go?" placeholderTextColor={colors.muted} style={s.input} />{error ? <Text size={12} color={colors.danger} style={{ marginTop: 10 }}>{error}</Text> : null}<Text size={11} color={colors.muted} style={{ marginTop: 7 }}>{body.length}/500 characters</Text><View style={{ marginTop: 22 }}><Button title={success ? 'Review shared' : saving ? 'Saving…' : 'Share review'} icon={success ? 'checkmark-circle-outline' : undefined} disabled={saving} onPress={submit} /></View></KeyboardAvoidingView></Page>;
}

const makeStyles = () => StyleSheet.create({ header: { flexDirection: 'row', alignItems: 'center', marginBottom: 22 }, scaleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, paddingVertical: 8 }, scaleStar: { width: 42, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line }, compactScaleStar: { width: 42, height: 42, borderRadius: 11 }, selected: { backgroundColor: colors.lime, borderColor: colors.star }, labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, categories: { marginTop: 20, padding: 15, borderRadius: radius.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line }, categoryRow: { marginTop: 15 }, input: { minHeight: 175, marginTop: 12, padding: 15, borderRadius: radius.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, fontSize: 15, lineHeight: 23, color: colors.ink } });
