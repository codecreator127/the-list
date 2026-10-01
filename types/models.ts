export type User = { id: string; name: string; handle: string; initials: string; color: string; avatarUrl?: string };
export type PhotoAttribution = { displayName: string; uri?: string };
export type Place = { id: string; googlePlaceId?: string; name: string; category: string; cuisine?: string; area: string; address: string; latitude?: number; longitude?: number; googleRating?: number; photoAttributions?: PhotoAttribution[]; image: string; price: string; description: string; averageRating: number; reviewCount: number; latestReviewAt?: Date; createdAt?: Date; updatedAt?: Date };
export type PlaceSearchResult = { googlePlaceId: string; name: string; category: string; cuisine?: string; area: string; address: string; latitude?: number; longitude?: number; googleRating?: number; photoUrl?: string; photoAttributions?: PhotoAttribution[]; mockPlaceId?: string; listAverageRating?: number; listReviewCount: number; latestReviewAt?: Date };
export const reviewSubcategories = ['food', 'service', 'atmosphere', 'value'] as const;
export type ReviewSubcategory = typeof reviewSubcategories[number];
export type Review = { id: string; placeId: string; userId: string; rating: number; subRatings?: Partial<Record<ReviewSubcategory, number>>; text: string; date: string; createdAt?: Date; updatedAt?: Date };
export type PersonalListEntry = { placeId: string; rank: number; rating: number; updatedAt: Date };
