import { useEffect, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BackButton, Button, Input, Page, Text } from '../../../components/ui';
import { foodService } from '../../../services/foodService';
import { isFirebaseRepositoryEnabled } from '../../../services/firebase';
import { watchAuthState } from '../../../services/auth';
import { reviewSubcategories, type Place, type Review, type ReviewSubcategory } from '../../../types/models';
import { colors, radius, typefaces, useTheme } from '../../../theme';
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

export default function WriteReview() {
  useTheme();
  const s = makeStyles();
  const { id, mode } = useLocalSearchParams<{ id: string; mode?: string }>();
  const isEditing = mode === 'edit';
  const [rating, setRating] = useState(0);
  const [subRatings, setSubRatings] = useState<Partial<Record<ReviewSubcategory, number>>>({});
  const [body, setBody] = useState('');
  const [originalReview, setOriginalReview] = useState<Review>();
  const [reviewLoaded, setReviewLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmationVisible, setDeleteConfirmationVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [place, setPlace] = useState<Place>();
  const submissionInProgress = useRef(false);
  const deletionInProgress = useRef(false);

  const hasChanges = !!originalReview && (
    rating !== originalReview.rating
    || body.trim() !== originalReview.text
    || reviewSubcategories.some(category => subRatings[category] !== originalReview.subRatings?.[category])
  );

  useEffect(() => {
    let active = true;
    setReviewLoaded(!isEditing);
    setError('');

    async function load() {
      const [foundPlace, ownReview] = await Promise.all([
        foodService.getPlace(id),
        isEditing ? foodService.getMyReview(id) : Promise.resolve(undefined),
      ]);
      if (!active) return;
      setPlace(foundPlace);
      if (isEditing) {
        if (!ownReview) {
          setError('Your review could not be found.');
          return;
        }
        setOriginalReview(ownReview);
        setRating(ownReview.rating);
        setSubRatings(ownReview.subRatings ?? {});
        setBody(ownReview.text);
        setReviewLoaded(true);
      }
      if (!foundPlace) setError('This place could not be found.');
    }

    const loadReview = () => {
      void load().catch(cause => {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load this place.');
      });
    };

    if (isEditing && isFirebaseRepositoryEnabled) {
      let started = false;
      const unsubscribe = watchAuthState(user => {
        if (user && !started) {
          started = true;
          loadReview();
        }
      });
      return () => { active = false; unsubscribe(); };
    }

    loadReview();
    return () => { active = false; };
  }, [id, isEditing]);

  useEffect(() => {
    if (!isFirebaseRepositoryEnabled) return;
    const returnTo = `/review/${id}${isEditing ? '?mode=edit' : ''}`;
    return watchAuthState(user => {
      if (!user) router.replace(`/auth?returnTo=${encodeURIComponent(returnTo)}`);
    });
  }, [id, isEditing]);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => router.back(), 360);
    return () => clearTimeout(timer);
  }, [success]);

  async function submit() {
    if (submissionInProgress.current || deletionInProgress.current || (isEditing && !hasChanges)) return;
    if (!rating) { setError('Choose a star rating to continue.'); return; }
    setError('');
    submissionInProgress.current = true;
    setSaving(true);
    try {
      if (isEditing) await foodService.updateReview(id, rating, body.trim(), subRatings);
      else await foodService.addReview(id, rating, body.trim(), subRatings);
      setSuccess(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save your review. Please try again.');
      submissionInProgress.current = false;
      setSaving(false);
    }
  }

  async function deleteReview() {
    if (!isEditing || !originalReview || deletionInProgress.current || submissionInProgress.current) return;
    deletionInProgress.current = true;
    setDeleting(true);
    setError('');
    try {
      await foodService.deleteReview(id);
      setDeleteConfirmationVisible(false);
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/profile');
    } catch (cause) {
      setDeleteConfirmationVisible(false);
      setError(cause instanceof Error ? cause.message : 'Could not delete your review. Please try again.');
      deletionInProgress.current = false;
      setDeleting(false);
    }
  }

  if (isEditing && !reviewLoaded && !error) {
    return <Page maxWidth={720}><Text>Loading your review…</Text></Page>;
  }

  return <Page maxWidth={720}>
    <View style={s.header}>
      <BackButton onPress={() => router.back()} />
      <Text size={15} weight="600" style={{ marginLeft: 12 }}>{isEditing ? 'Edit review' : 'Write a review'}</Text>
    </View>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Text size={27} weight="700">How was {place?.name ?? 'your meal'}?</Text>
      <Text size={14} color={colors.muted} style={{ marginTop: 7, lineHeight: 21 }}>Your honest note helps friends find a good place.</Text>
      <View style={{ marginTop: 22 }}>
        <View style={s.labelRow}>
          <Text size={13} weight="600">Overall rating</Text>
          <Text size={12} weight="700" color={rating ? colors.green : colors.muted}>{rating ? `${rating} / 10` : 'Choose 1–10'}</Text>
        </View>
        <StarScale label="Overall rating" value={rating} onChange={value => { setRating(value); setError(''); }} />
      </View>
      <View style={s.categories}>
        <Text size={15} weight="700">Optional details</Text>
        <Text size={12} color={colors.muted} style={{ marginTop: 5, lineHeight: 18 }}>These category ratings together influence your overall score by just 10%.</Text>
        {reviewSubcategories.map(category => <View key={category} style={s.categoryRow}>
          <View style={s.labelRow}>
            <Text size={13} weight="600">{categoryLabels[category]}</Text>
            <Text size={11} color={subRatings[category] ? colors.green : colors.muted}>{subRatings[category] ? `${subRatings[category]} / 10` : 'Optional'}</Text>
          </View>
          <StarScale compact allowClear label={categoryLabels[category]} value={subRatings[category] ?? 0} onChange={value => setSubRatings(current => {
            const next = { ...current };
            if (value) next[category] = value;
            else delete next[category];
            return next;
          })} />
        </View>)}
      </View>
      <Text size={13} weight="600" style={{ marginTop: 22 }}>Your note (optional)</Text>
      <Input accessibilityLabel="Your review note (optional)" value={body} onChangeText={setBody} multiline maxLength={500} textAlignVertical="top" placeholder="What did you order? What should someone know before they go?" placeholderTextColor={colors.muted} style={s.input} />
      {error ? <Text size={12} color={colors.danger} style={{ marginTop: 10 }}>{error}</Text> : null}
      <Text size={11} color={colors.muted} style={{ marginTop: 7 }}>{body.length}/500 characters</Text>
      <View style={{ marginTop: 22 }}>
        <Button
          title={success ? (isEditing ? 'Changes saved' : 'Review shared') : saving ? 'Saving…' : isEditing ? 'Save changes' : 'Share review'}
          icon={success ? 'checkmark-circle-outline' : undefined}
          disabled={saving || deleting || (isEditing && (!reviewLoaded || !hasChanges))}
          loading={saving}
          onPress={submit}
        />
      </View>
      {isEditing ? <View style={s.deleteAction}>
        <Button
          title="Delete review"
          variant="destructive"
          size="small"
          icon="trash-outline"
          disabled={!reviewLoaded || !originalReview || saving || deleting}
          onPress={() => { setError(''); setDeleteConfirmationVisible(true); }}
          style={s.deleteButton}
        />
      </View> : null}
    </KeyboardAvoidingView>
    <Modal
      visible={deleteConfirmationVisible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => { if (!deleting) setDeleteConfirmationVisible(false); }}
    >
      <View style={s.modalBackdrop} accessibilityViewIsModal>
        <View style={s.confirmation}>
          <View style={s.confirmationIcon}><Ionicons name="trash-outline" size={22} color={colors.error} /></View>
          <Text size={21} weight="700" style={{ marginTop: 15 }}>Delete review?</Text>
          <Text size={14} color={colors.textSecondary} style={{ marginTop: 8, lineHeight: 21 }}>
            This will remove your review and the place from your List.
          </Text>
          {error ? <Text size={12} color={colors.error} style={{ marginTop: 10 }}>{error}</Text> : null}
          <View style={s.confirmationActions}>
            <Button
              title="Cancel"
              variant="secondary"
              disabled={deleting}
              onPress={() => setDeleteConfirmationVisible(false)}
              style={{ flex: 1 }}
            />
            <Button
              title="Delete review"
              variant="destructive"
              loading={deleting}
              disabled={deleting}
              onPress={deleteReview}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  </Page>;
}

const makeStyles = () => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 22 },
  scaleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, paddingVertical: 8 },
  scaleStar: { width: 42, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  compactScaleStar: { width: 42, height: 42, borderRadius: 11 },
  selected: { backgroundColor: colors.lime, borderColor: colors.star },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  categories: { marginTop: 20, padding: 15, borderRadius: radius.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  categoryRow: { marginTop: 15 },
  input: { minHeight: 175, marginTop: 12, padding: 15, borderRadius: radius.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, fontSize: 15, lineHeight: 23, fontFamily: typefaces.sansRegular, color: colors.ink },
  deleteAction: { marginTop: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  deleteButton: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: colors.scrim },
  confirmation: { width: '100%', maxWidth: 420, padding: 24, backgroundColor: colors.surfaceElevated, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  confirmationIcon: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface },
  confirmationActions: { flexDirection: 'row', gap: 10, marginTop: 24 },
});
