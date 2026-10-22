import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, FilterChip, SearchBar, Text } from './ui';
import { personalListOptions, type ListFilters } from '../features/listFilters';
import type { RankedPlace } from '../features/myList';

export const emptyListFilters = (): ListFilters => ({search:'',cuisines:[],area:'',minimumRating:0});
export function ListFilterControls({items,filters,onChange,placeholder='Search restaurants'}: {
  items: RankedPlace[]; filters: ListFilters; onChange: (filters: ListFilters) => void; placeholder?: string;
}) {
  const [open,setOpen]=useState(false);
  const options=useMemo(()=>personalListOptions(items),[items]);
  const cuisines=filters.cuisines??[];
  const active=cuisines.length+Number(!!filters.area)+Number(filters.minimumRating>0);
  const change=(patch:Partial<ListFilters>)=>onChange({...filters,...patch});
  const sameCuisine=(a:string,b:string)=>a.trim().toLocaleLowerCase('en-AU')===b.trim().toLocaleLowerCase('en-AU');
  const toggle=(value:string)=>change({cuisines:cuisines.some(item=>sameCuisine(item,value))?cuisines.filter(item=>!sameCuisine(item,value)):[...cuisines,value]});
  return <View style={{gap:10,paddingBottom:14}}>
    <SearchBar value={filters.search} onChange={(search:string)=>change({search})} placeholder={placeholder}/>
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
      <Button title={`Filters${active?` · ${active}`:''}`} icon={open?'chevron-up':'options-outline'} variant="secondary" size="small" onPress={()=>setOpen(value=>!value)}/>
      {active || filters.search.trim() ? <Button title="Clear all" variant="ghost" size="small" onPress={()=>onChange(emptyListFilters())}/> : null}
    </View>
    {open ? <View style={{gap:12}}>
      <Text size={12} weight="600">Cuisine · select any</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:7}}>
        <FilterChip label="All cuisines" selected={!cuisines.length} onPress={()=>change({cuisines:[]})}/>
        {options.cuisines.map(value=><FilterChip key={value} label={value} selected={cuisines.some(item=>sameCuisine(item,value))} onPress={()=>toggle(value)}/>)}
      </ScrollView>
      <Text size={12} weight="600">Area</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:7}}>
        <FilterChip label="All areas" selected={!filters.area} onPress={()=>change({area:''})}/>
        {options.areas.map(value=><FilterChip key={value} label={value} selected={filters.area===value} onPress={()=>change({area:filters.area===value?'':value})}/>)}
      </ScrollView>
      <Text size={12} weight="600">Minimum rating</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:7}}>
        {[0,3,3.5,4,4.5].map(value=><FilterChip key={value} label={value?`${value.toFixed(2)}+`:'Any rating'} selected={filters.minimumRating===value} onPress={()=>change({minimumRating:value})}/>)}
      </ScrollView>
    </View> : null}
    {active ? <View style={{flexDirection:'row',flexWrap:'wrap',gap:7}}>
      {cuisines.map(value=><FilterChip key={value} label={value} selected onRemove={()=>toggle(value)}/>)}
      {filters.area?<FilterChip label={filters.area} selected onRemove={()=>change({area:''})}/>:null}
      {filters.minimumRating?<FilterChip label={`${filters.minimumRating.toFixed(2)}+`} selected onRemove={()=>change({minimumRating:0})}/>:null}
    </View> : null}
  </View>;
}
