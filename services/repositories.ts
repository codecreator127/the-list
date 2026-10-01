import type { PersonalListEntry, Place, Review, ReviewSubcategory, User } from '../types/models';

export type CreateReview = { placeId: string; rating: number; subRatings?: Partial<Record<ReviewSubcategory, number>>; text: string };
export type UpdateReview = { rating: number; subRatings?: Partial<Record<ReviewSubcategory, number>>; text: string };
export type UserProfileInput = { userId: string; displayName: string; email: string; avatarUrl?: string | null };
export interface PlaceRepository { listPlaces(): Promise<Place[]>; getPlace(id: string): Promise<Place | null>; savePlace(place: Place): Promise<Place>; }
export interface ReviewRepository { getReviewsForPlace(placeId: string): Promise<Review[]>; getRecentReviews(): Promise<Review[]>; getReviewsByUser(userId: string): Promise<Review[]>; getMyList(userId: string): Promise<PersonalListEntry[]>; rebuildMyListFromReviews(userId: string): Promise<void>; createReview(input: CreateReview): Promise<Review>; updateReview(reviewId: string, input: UpdateReview): Promise<Review>; deleteReview(reviewId: string, userId: string): Promise<void>; }
export interface UserRepository { getUser(userId: string): Promise<User>; ensureUserProfile(profile: UserProfileInput): Promise<void>; }
export type FoodRepository = PlaceRepository & ReviewRepository & UserRepository;
