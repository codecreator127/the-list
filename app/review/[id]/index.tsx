import { useEffect, useMemo, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Animated, KeyboardAvoidingView, Modal, PanResponder, Platform, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BackButton, Button, IconButton, Input, Page, RatingStars, Text } from '../../../components/ui';
import { foodService } from '../../../services/foodService';
import { isFirebaseRepositoryEnabled } from '../../../services/firebase';
import { watchAuthState } from '../../../services/auth';
import { reviewSubcategories, type Place, type Review, type ReviewSubcategory } from '../../../types/models';
import { colors, radius, typefaces, useTheme } from '../../../theme';
import { PressableScale, useReducedMotion } from '../../../components/motion';
import { getListPlacementPreview, reviewRankingCandidate, type RankedPlace } from '../../../features/myList';
import { normalizeRating, ratingFromSliderProgress, RATING_SCALE } from '../../../features/ratings';

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

function RatingSlider({ value, onChange }: { value: number; onChange: (rating: number) => void }) {
  const s = makeStyles();
  const [width, setWidth] = useState(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const progress = value / RATING_SCALE;
  const setFromLocation = (locationX: number) => {
    const trackWidth = width - 32;
    if (trackWidth <= 0) return;
    const fraction = Math.max(0, Math.min(1, (locationX - 16) / trackWidth));
    onChangeRef.current(ratingFromSliderProgress(fraction));
  };
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: event => setFromLocation(event.nativeEvent.locationX),
    onPanResponderMove: event => setFromLocation(event.nativeEvent.locationX),
  }), [width]);

  return <View style={s.sliderWrap}>
    <View
      accessibilityRole="adjustable"
      accessibilityLabel="Overall rating slider"
      accessibilityValue={{ min: 0, max: RATING_SCALE, now: value, text: `${value.toFixed(2)} out of 5.00` }}
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
      style={s.sliderHitArea}
      {...responder.panHandlers}
    >
      <View pointerEvents="none" style={s.sliderTrack}>
        <View style={[s.sliderFill, { width: `${progress * 100}%` }]} />
        <View style={[s.sliderThumb, { left: `${progress * 100}%` }]} />
      </View>
    </View>
    <View style={s.sliderScale}><Text size={10} color={colors.textMuted}>0.00</Text><Text size={10} color={colors.textMuted}>5.00</Text></View>
  </View>;
}

function PlacementRow({ rank, name, rating, highlighted, animateKey }: { rank: number; name: string; rating: number; highlighted?: boolean; animateKey: number }) {
  const s = makeStyles();
  const opacity = useRef(new Animated.Value(1)).current;
  const reducedMotion = useReducedMotion();
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (reducedMotion !== false) {
      opacity.setValue(1);
      return;
    }
    opacity.setValue(0.78);
    const animation = Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: Platform.OS !== 'web' });
    animation.start();
    return () => animation.stop();
  }, [animateKey, opacity, reducedMotion]);
  return <Animated.View style={[s.previewRow, highlighted && s.previewRowHighlighted, { opacity }]}>
    <View style={s.previewRowContent} accessible accessibilityLabel={`${highlighted ? 'Proposed position, ' : ''}rank ${rank}, ${name}, ${rating.toFixed(2)} out of 5.00`}>
      <Text size={12} weight={highlighted ? '700' : '500'} color={highlighted ? colors.accent : colors.textSecondary}>#{rank}</Text>
      <Text size={12} weight={highlighted ? '700' : '500'} color={highlighted ? colors.accent : colors.textSecondary} numberOfLines={1} style={{ flex: 1 }}>{name}</Text>
      <Text size={12} weight={highlighted ? '700' : '500'} color={highlighted ? colors.accent : colors.textSecondary}>— {rating.toFixed(2)}</Text>
    </View>
  </Animated.View>;
}

function ListPlacementPreview({ place, rating, subRatings, originalReview, data, loading, error }: {
  place?: Place;
  rating: number;
  subRatings: Review['subRatings'];
  originalReview?: Review;
  data?: { userId: string; items: RankedPlace[]; reviews: Review[] };
  loading: boolean;
  error: string;
}) {
  const s = makeStyles();
  const proposedReviewId = originalReview?.id ?? `${data?.userId ?? ''}_${place?.id ?? ''}`;
  // A save receives a fresh timestamp. Start after loading the snapshot so an
  // equal-rated existing review does not win merely because loading was slow.
  const previewTime = useMemo(() => new Date(), [data?.reviews]);
  const entries = useMemo(() => (data?.reviews ?? []).map(reviewRankingCandidate), [data?.reviews]);
  const proposed = useMemo(() => place ? reviewRankingCandidate({
    id: proposedReviewId,
    userId: data?.userId ?? '',
    placeId: place.id,
    rating,
    subRatings,
    text: '',
    date: '',
    updatedAt: previewTime,
  }) : undefined, [data?.userId, place, previewTime, proposedReviewId, rating, subRatings]);
  const placement = useMemo(() => data && proposed ? getListPlacementPreview(entries, proposed) : undefined, [data, entries, proposed]);
  const namesByPlace = useMemo(() => new Map((data?.items ?? []).map(item => [item.placeId, item.place.name])), [data?.items]);

  return <View style={s.previewPanel} accessibilityLiveRegion="polite">
    <View style={s.previewHeader}>
      <Text size={13} weight="700">Your List placement</Text>
      {placement ? <Text size={15} weight="700" color={colors.accent}>#{placement.rank} of {placement.total}</Text> : null}
    </View>
    <Text size={10} color={colors.textMuted} style={s.previewCaption}>PREVIEW · Not saved until you {originalReview ? 'save changes' : 'share your review'}</Text>
    {loading ? <Text size={11} color={colors.textMuted} style={s.previewStatus}>Loading your List…</Text>
      : error ? <Text size={11} color={colors.textMuted} style={s.previewStatus}>{error}</Text>
        : placement && proposed ? <View style={s.previewRows}>
          {placement.above ? <PlacementRow rank={placement.rank - 1} name={namesByPlace.get(placement.above.placeId) ?? placement.above.placeId} rating={placement.above.rating} animateKey={placement.rank} />
            : <View style={[s.previewRow, s.previewPlaceholder]}><Text size={11} color={colors.textMuted}>{data?.items.length ? 'Top of your List' : 'Your List is empty'}</Text></View>}
          <PlacementRow rank={placement.rank} name={place?.name ?? 'This restaurant'} rating={rating} highlighted animateKey={placement.rank} />
          {placement.below ? <PlacementRow rank={placement.rank + 1} name={namesByPlace.get(placement.below.placeId) ?? placement.below.placeId} rating={placement.below.rating} animateKey={placement.rank} />
            : <View style={[s.previewRow, s.previewPlaceholder]}><Text size={11} color={colors.textMuted}>{data?.items.length ? 'Last place on your List' : 'No other places yet'}</Text></View>}
        </View> : null}
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
  const [previewData, setPreviewData] = useState<{ userId: string; items: RankedPlace[]; reviews: Review[] }>();
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState('');
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
    setPreviewData(undefined);
    setPreviewLoading(true);
    setPreviewError('');

    async function load() {
      void foodService.getMyListPreviewData().then(data => {
        if (active) setPreviewData(data);
      }).catch(cause => {
        if (active) setPreviewError(cause instanceof Error ? 'List preview is unavailable.' : 'Could not load your List preview.');
      }).finally(() => {
        if (active) setPreviewLoading(false);
      });
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

    if (isFirebaseRepositoryEnabled) {
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
        <View style={s.ratingHeader}>
          <Text size={13} weight="600">Overall rating</Text>
          <View style={s.ratingValueRow}>
            <Text size={27} weight="700" color={colors.accent} style={s.ratingValue}>{rating.toFixed(2)}</Text>
            <Text size={12} weight="600" color={colors.textMuted}>/ 5.00</Text>
          </View>
        </View>
        <View style={s.ratingControls}>
          <RatingSlider value={rating} onChange={value => { setRating(value); setError(''); }} />
          <IconButton icon="remove" label="Decrease rating by 0.01" variant="secondary" size="small" disabled={rating <= 0} onPress={() => setRating(value => normalizeRating(Math.max(0, value - 0.01)))} />
          <IconButton icon="add" label="Increase rating by 0.01" variant="secondary" size="small" disabled={rating >= 5} onPress={() => setRating(value => normalizeRating(Math.min(5, value + 0.01)))} />
        </View>
        <View style={{ marginTop: 8 }}><RatingStars value={rating} size={23} /></View>
      </View>
      <ListPlacementPreview place={place} rating={rating} subRatings={subRatings} originalReview={originalReview} data={previewData} loading={previewLoading} error={previewError} />
      <View style={s.categories}>
        <Text size={15} weight="700">Optional details</Text>
        <Text size={12} color={colors.muted} style={{ marginTop: 5, lineHeight: 18 }}>These category ratings together influence your overall score by just 10%.</Text>
        {reviewSubcategories.map(category => <View key={category} style={s.categoryRow}>
          <View style={s.labelRow}>
            <Text size={13} weight="600">{categoryLabels[category]}</Text>
            <Text size={11} color={subRatings[category] ? colors.green : colors.muted}>{subRatings[category] ? `${subRatings[category]?.toFixed(2)} / 10.00` : 'Optional'}</Text>
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
  ratingHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ratingValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  ratingValue: { fontFamily: typefaces.serif, lineHeight: 34 },
  ratingControls: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  sliderWrap: { flex: 1 },
  sliderHitArea: { height: 48, justifyContent: 'center', paddingHorizontal: 16 },
  sliderTrack: { position: 'relative', height: 7, borderRadius: 4, backgroundColor: colors.border, justifyContent: 'center' },
  sliderFill: { height: 7, borderRadius: 4, backgroundColor: colors.accent },
  sliderThumb: { position: 'absolute', top: -10, width: 27, height: 27, marginLeft: -13.5, borderRadius: 14, backgroundColor: colors.rating, borderWidth: 3, borderColor: colors.surfaceElevated, elevation: 2 },
  sliderScale: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16 },
  previewPanel: { marginTop: 17, minHeight: 153, padding: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  previewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  previewCaption: { marginTop: 3, letterSpacing: 0.4 },
  previewRows: { gap: 3, marginTop: 9 },
  previewRow: { minHeight: 28, justifyContent: 'center', paddingHorizontal: 8, borderLeftWidth: 2, borderLeftColor: 'transparent' },
  previewRowContent: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  previewRowHighlighted: { backgroundColor: colors.surfaceStrong, borderLeftColor: colors.accent },
  previewStatus: { marginTop: 9 },
  previewPlaceholder: { paddingHorizontal: 8 },
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
