import { useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Image, Linking, Platform, Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, FilterChip, Page, Rating, SearchBar, SectionTitle, Text } from '../../components/ui';
import { Entrance, PressableScale } from '../../components/motion';
import SearchMap from '../../components/SearchMap';
import { AREA_OPTIONS, CUISINE_OPTIONS, DEFAULT_SEARCH_ORIGIN, DISTANCE_OPTIONS } from '../../data/searchOptions';
import { foodService } from '../../services/foodService';
import { filterAndSortPlaces, type SearchSort } from '../../services/placeSearch';
import { requestSearchLocation } from '../../services/searchLocation';
import type { PlaceSearchResult } from '../../types/models';
import { colors, radius, useTheme } from '../../theme';

const SORT_OPTIONS: { label: string; value: SearchSort }[] = [
  { label: 'Recommended', value: 'recommended' },
  { label: 'Highest rated', value: 'highest-rated' },
  { label: 'Most reviewed', value: 'most-reviewed' },
  { label: 'Newest reviewed', value: 'newest-reviewed' },
];

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <FilterChip label={label} selected={selected} onPress={onPress}/>;
}

function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return <FilterChip label={label} onRemove={onRemove} accessibilityLabel={`Remove ${label} filter`}/>;
}

export default function SearchScreen() {
  useTheme();
  const styles = makeStyles();
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<PlaceSearchResult[]>([]);
  const [cuisine, setCuisine] = useState('All cuisines');
  const [area, setArea] = useState('All areas');
  const [distanceKm, setDistanceKm] = useState<number | undefined>(15);
  const [searchOrigin, setSearchOrigin] = useState(DEFAULT_SEARCH_ORIGIN);
  const [locationStatus, setLocationStatus] = useState<'default' | 'requesting' | 'current' | 'denied' | 'unavailable'>('default');
  const locationRequestInProgress = useRef(false);
  const [sort, setSort] = useState<SearchSort>('recommended');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState('');
  const [error, setError] = useState('');
  const [mapVisible, setMapVisible] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const timer = setTimeout(() => {
      foodService.searchPlaces(query, searchOrigin, (distanceKm ?? 50) * 1000).then(items => {
        if (active) { setPlaces(items); setLoading(false); }
      }).catch(cause => {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'Search failed. Please try again.');
          setPlaces([]);
          setLoading(false);
        }
      });
    }, query.trim() ? 300 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [query, searchOrigin.latitude, searchOrigin.longitude, distanceKm]);

  const results = useMemo(() => filterAndSortPlaces(places, {
    query, cuisine, area, distanceKm, origin: searchOrigin, sort,
  }), [places, query, cuisine, area, distanceKm, searchOrigin, sort]);

  async function requestLocation() {
    if (locationRequestInProgress.current) return;
    locationRequestInProgress.current = true;
    setLocationStatus('requesting');
    const result = await requestSearchLocation();
    if (result.status === 'granted') {
      setSearchOrigin(result.origin);
      setLocationStatus('current');
    } else {
      setLocationStatus(result.status);
    }
    locationRequestInProgress.current = false;
  }

  useEffect(() => { void requestLocation(); }, []);

  function selectDistance(km: number | undefined) {
    setDistanceKm(km);
    if (km !== undefined && locationStatus !== 'current') void requestLocation();
  }

  async function openPlace(result: PlaceSearchResult) {
    setOpeningId(result.googlePlaceId);
    setError('');
    try {
      const place = await foodService.resolveSearchResult(result);
      router.push({ pathname: `/place/${place.id}`, params: { from: 'search' } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load place details.');
    } finally {
      setOpeningId('');
    }
  }

  const activeFilterCount = Number(cuisine !== 'All cuisines') + Number(area !== 'All areas') + Number(distanceKm !== undefined);
  const clearFilters = () => { setCuisine('All cuisines'); setArea('All areas'); setDistanceKm(15); setSort('recommended'); setQuery(''); };

  return <Page>
    <Text size={30} weight="700">Find your next favourite</Text>
    <Text size={14} color={colors.muted} style={{ marginTop: 6, marginBottom: 18 }}>Good places, shared by good people.</Text>
    <SearchBar value={query} onChange={setQuery} placeholder="Search restaurants, dishes, areas"/>

    <View style={styles.toolbar}>
      <Button title={`Filters${activeFilterCount ? ` · ${activeFilterCount}` : ''}`} variant="secondary" size="small" icon={filtersOpen ? 'chevron-up' : 'options-outline'} onPress={() => setFiltersOpen(open => !open)} accessibilityLabel="Toggle filters"/>
      <Button title={mapVisible ? 'Hide map' : 'Show map'} variant="ghost" size="small" icon={mapVisible ? 'list-outline' : 'map-outline'} onPress={() => setMapVisible(value => !value)} accessibilityLabel={mapVisible ? 'Hide map' : 'Show map'}/>
    </View>

    {filtersOpen ? <View style={styles.filterPanel}>
      <FilterRow title="Cuisine">{CUISINE_OPTIONS.map(option => <Choice key={option} label={option} selected={cuisine === option} onPress={() => setCuisine(option)}/>)}</FilterRow>
      <FilterRow title="Area">{AREA_OPTIONS.map(option => <Choice key={option} label={option} selected={area === option} onPress={() => setArea(option)}/>)}</FilterRow>
      <FilterRow title={`Distance from ${searchOrigin.label}`}>
        {DISTANCE_OPTIONS.map(option => <Choice key={option.label} label={option.label} selected={distanceKm === option.km} onPress={() => selectDistance(option.km)}/>)}</FilterRow>
      <FilterRow title="Sort by">{SORT_OPTIONS.map(option => <Choice key={option.value} label={option.label} selected={sort === option.value} onPress={() => setSort(option.value)}/>)}</FilterRow>
      <Text size={11} color={colors.muted} style={{ marginTop: 5, lineHeight: 16 }}>
        {locationStatus === 'requesting' ? 'Getting your location…' : locationStatus === 'current' ? 'Distances use your current location. Places without coordinates are left out.' : locationStatus === 'denied' ? 'Location permission was denied. Distances use Sydney CBD; you can allow location in your browser or device settings.' : locationStatus === 'unavailable' ? 'Could not get your location. Distances use Sydney CBD.' : 'Choosing a distance asks to use your location. If unavailable, distances use Sydney CBD.'}
      </Text>
      {locationStatus === 'denied' || locationStatus === 'unavailable' ? <Button title="Try location again" variant="ghost" size="small" onPress={() => void requestLocation()} style={{ alignSelf: 'flex-start' }}/> : null}
    </View> : null}

    {(query.trim() || activeFilterCount > 0 || sort !== 'recommended') ? <View style={styles.activeFilters}>
      {query.trim() ? <ActiveChip label={`“${query.trim()}”`} onRemove={() => setQuery('')}/> : null}
      {cuisine !== 'All cuisines' ? <ActiveChip label={cuisine} onRemove={() => setCuisine('All cuisines')}/> : null}
      {area !== 'All areas' ? <ActiveChip label={area} onRemove={() => setArea('All areas')}/> : null}
      {distanceKm !== undefined ? <ActiveChip label={`Within ${distanceKm} km · ${searchOrigin.label}`} onRemove={() => setDistanceKm(undefined)}/> : null}
      {sort !== 'recommended' ? <ActiveChip label={SORT_OPTIONS.find(option => option.value === sort)!.label} onRemove={() => setSort('recommended')}/> : null}
      <Button title="Clear all" variant="ghost" size="small" onPress={clearFilters}/>
    </View> : null}

    {mapVisible ? <SearchMap places={results} center={searchOrigin} onSelect={openPlace}/> : null}
    <View style={{ marginTop: 14, marginBottom: 13 }}>
      <SectionTitle title={query.trim() ? 'Search results' : `Restaurants near ${searchOrigin.label}`}/>
      <Text size={12} color={colors.muted} style={{ marginTop: 5 }}>{loading ? 'Searching…' : `${results.length} ${results.length === 1 ? 'place' : 'places'} found`}</Text>
    </View>

    {loading ? <ActivityIndicator color={colors.green} style={{ marginTop: 30 }}/> : error ? <View style={styles.error}>
      <Text size={14} weight="600" color={colors.danger}>Couldn’t search places</Text>
      <Text size={13} color={colors.muted} style={{ marginTop: 6, lineHeight: 19 }}>{error}</Text>
    </View> : results.length ? <View style={{ gap: 12 }}>{results.map((place, index) => <Entrance key={place.googlePlaceId} delay={Math.min(index * 25, 150)}>
      <PressableScale accessibilityRole="button" accessibilityLabel={`Open ${place.name}`} disabled={!!openingId} onPress={() => openPlace(place)} hoverStyle={styles.resultHover} style={styles.result}>
        {place.photoUrl ? <Image source={{ uri: place.photoUrl }} style={styles.photo}/> : <View style={styles.placeholder}><Ionicons name="restaurant-outline" size={27} color={colors.green}/></View>}
        <View style={{ flex: 1 }}>
          <Text size={16} weight="700" numberOfLines={1}>{place.name}</Text>
          {place.listReviewCount > 0 ? <View style={styles.scoreRow}><Rating value={place.listAverageRating ?? 0}/><Text size={11} color={colors.muted}>The List · {place.listReviewCount} {place.listReviewCount === 1 ? 'review' : 'reviews'}</Text></View> : <Text size={11} color={colors.muted} style={{ marginTop: 5 }}>No List reviews yet</Text>}
          {place.googleRating !== undefined ? <View style={styles.scoreRow}><Ionicons name="star" size={12} color={colors.star}/><Text size={11} weight="600">{place.googleRating.toFixed(1)}</Text><Text size={10} color={colors.muted}>Google rating</Text></View> : null}
          <Text size={12} color={colors.muted} numberOfLines={1} style={{ marginTop: 5 }}>{place.cuisine ?? place.category}{place.area ? ` · ${place.area}` : ''}</Text>
          <Text size={11} color={colors.muted} numberOfLines={1} style={{ marginTop: 4 }}>{place.address}</Text>
          {place.photoAttributions?.[0] ? <Pressable onPress={() => place.photoAttributions?.[0].uri && Linking.openURL(place.photoAttributions[0].uri!)}><Text size={9} color={colors.muted} numberOfLines={1} style={{ marginTop: 4 }}>Photo: {place.photoAttributions[0].displayName}</Text></Pressable> : null}
          {openingId === place.googlePlaceId ? <Text size={11} color={colors.green} style={{ marginTop: 4 }}>Loading details…</Text> : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted}/>
      </PressableScale>
    </Entrance>)}</View> : <View style={styles.empty}>
      <Ionicons name="search-outline" size={26} color={colors.green}/>
      <Text size={15} weight="600" style={{ marginTop: 8 }}>No places match these filters</Text>
      <Text size={13} color={colors.muted} style={{ marginTop: 6, textAlign: 'center' }}>Try removing a filter or searching another restaurant, cuisine or area.</Text>
      {(activeFilterCount > 0 || query.trim()) ? <View style={{ marginTop: 12 }}><Button title="Clear search and filters" variant="secondary" size="small" onPress={clearFilters}/></View> : null}
    </View>}
  </Page>;
}

function FilterRow({ title, children }: { title: string; children: React.ReactNode }) {
  const styles = makeStyles();
  const options = <View style={styles.filterChoices}>{children}</View>;
  return <View style={{ marginTop: 12 }}>
    <Text size={12} weight="600" style={{ marginBottom: 7 }}>{title}</Text>
    {Platform.OS === 'web' ? options : <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 7, paddingRight: 12 }}>{children}</ScrollView>}
  </View>;
}

const makeStyles = () => ({
  toolbar: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, marginTop: 9, minHeight: 44 },
  filterPanel: { padding: 13, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md },
  filterChoices: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 7 },
  activeFilters: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, alignItems: 'center' as const, gap: 7, marginTop: 10, marginBottom: 4 },
  result: { flexDirection: 'row' as const, alignItems: 'center' as const, padding: 10, gap: 13, borderRadius: radius.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  resultHover: { borderColor: colors.green },
  photo: { width: 92, height: 92, borderRadius: 12, backgroundColor: colors.soft },
  placeholder: { width: 92, height: 92, borderRadius: 12, backgroundColor: colors.soft, alignItems: 'center' as const, justifyContent: 'center' as const },
  scoreRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5, marginTop: 5 },
  error: { padding: 20, backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line },
  empty: { padding: 24, backgroundColor: colors.white, borderRadius: 16, alignItems: 'center' as const, marginTop: 10 },
});
