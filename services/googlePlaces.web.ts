import type { PlaceSearchResult, PhotoAttribution } from '../types/models';

const apiKey=process.env.EXPO_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY;
export const hasGooglePlacesConfig=Boolean(apiKey);
type PlacePhoto={getURI(options:{maxWidth:number}):string;authorAttributions?:PhotoAttribution[]};
type GooglePlace={id?:string;displayName?:string;formattedAddress?:string;addressComponents?:any[];location?:{lat():number;lng():number};primaryType?:string;primaryTypeDisplayName?:string;rating?:number;photos?:PlacePhoto[];fetchFields(options:{fields:string[]}):Promise<void>};
type PlacesLibrary={Place:{searchByText(options:any):Promise<{places?:GooglePlace[]}>;searchNearby(options:any):Promise<{places?:GooglePlace[]}>;new(options:{id:string}):GooglePlace}};
declare global { interface Window { google?: { maps?: { importLibrary(name:string):Promise<any> } } } }
let placesLibraryPromise:Promise<PlacesLibrary>|undefined;
async function loadPlacesLibrary():Promise<PlacesLibrary>{
 if(!apiKey)throw new Error('Google Places is not configured.');
 if(typeof window==='undefined')throw new Error('Google Places web search is only available in a browser.');
 if(!placesLibraryPromise)placesLibraryPromise=(async()=>{
  if(!window.google?.maps){await new Promise<void>((resolve,reject)=>{const script=document.createElement('script');script.src=`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;script.async=true;script.onload=()=>resolve();script.onerror=()=>reject(new Error('Google Maps JavaScript API failed to load. Check the API key and enabled APIs.'));document.head.appendChild(script);});}
  return window.google!.maps!.importLibrary('places') as Promise<PlacesLibrary>;
 })().catch(error=>{placesLibraryPromise=undefined;throw error;});
 return placesLibraryPromise;
}
function mapPlace(place:GooglePlace):PlaceSearchResult{
 const components=place.addressComponents??[];
 const area=components.find(component=>component.types?.includes('sublocality_level_1'))?.longText??components.find(component=>component.types?.includes('locality'))?.longText??'';
 const photo=place.photos?.[0];
 const category=place.primaryTypeDisplayName??place.primaryType?.replaceAll('_',' ')??'Food & drink';
 return {googlePlaceId:place.id??'',name:place.displayName??'Unnamed place',address:place.formattedAddress??'',category,cuisine:category,area,latitude:place.location?.lat(),longitude:place.location?.lng(),googleRating:typeof place.rating==='number'?place.rating:undefined,photoUrl:photo?.getURI({maxWidth:1200}),photoAttributions:photo?.authorAttributions,listReviewCount:0};
}
const fields=['id','displayName','formattedAddress','addressComponents','location','primaryType','primaryTypeDisplayName','rating','photos'];
export const googlePlaces={
 async search(query:string,origin:{latitude:number;longitude:number},radiusMeters:number):Promise<PlaceSearchResult[]>{const {Place}=await loadPlacesLibrary();const center={lat:origin.latitude,lng:origin.longitude};const circle={center,radius:radiusMeters};const result=query.trim()?await Place.searchByText({textQuery:query,fields,includedType:'restaurant',maxResultCount:20,language:'en',locationBias:circle}):await Place.searchNearby({fields,locationRestriction:circle,includedPrimaryTypes:['restaurant'],maxResultCount:20,rankPreference:'DISTANCE'});return (result.places??[]).map(mapPlace);},
 async getDetails(placeId:string):Promise<PlaceSearchResult>{const {Place}=await loadPlacesLibrary();const place=new Place({id:placeId});await place.fetchFields({fields});return mapPlace(place);},
};
export async function loadGoogleMapLibrary():Promise<any>{await loadPlacesLibrary();await window.google!.maps!.importLibrary('maps');return window.google!.maps;}
