import type { PersonalListEntry, Place, Review, ReviewSubcategory, User } from '../types/models';

export type CreateReview = { placeId: string; rating: number; subRatings?: Partial<Record<ReviewSubcategory, number>>; text: string; photo?: Review['photo'] };
export type UpdateReview = { rating: number; subRatings?: Partial<Record<ReviewSubcategory, number>>; text: string; photo?: Review['photo'] | null };
export type UserProfileInput = { userId: string; username?: string; displayName: string; avatarUrl?: string | null };
export type Friendship = { id: string; userIds: [string, string]; requesterId: string; recipientId: string; status: 'pending' | 'accepted' | 'declined' | 'cancelled'; createdAt?: Date; updatedAt?: Date };
export interface PlaceRepository { listPlaces(): Promise<Place[]>; getPlacesByIds(ids: string[]): Promise<Place[]>; getPlace(id: string): Promise<Place | null>; savePlace(place: Place): Promise<Place>; }
export interface ReviewRepository { getReviewsForPlace(placeId: string): Promise<Review[]>; getRecentReviews(): Promise<Review[]>; getReviewsByUser(userId: string): Promise<Review[]>; getMyList(userId: string): Promise<PersonalListEntry[]>; rebuildMyListFromReviews(userId: string): Promise<void>; createReview(input: CreateReview): Promise<Review>; updateReview(reviewId: string, input: UpdateReview): Promise<Review>; deleteReview(reviewId: string, userId: string): Promise<void>; }
export interface UserRepository {
 getReviewsByUsers(userIds: string[]): Promise<Review[]>;
 watchFriendships?(userId: string, onChange: (rows: Friendship[]) => void, onError: (error: Error) => void): () => void;
 getUsers(userIds: string[]): Promise<User[]>;
 getRecentReviewsByUsers(userIds: string[]): Promise<Review[]>;
 getUser(userId: string): Promise<User>;
 ensureUserProfile(profile: UserProfileInput): Promise<void>;
 saveUserProfile(userId: string, username: string, displayName: string, avatarUrl?: string | null): Promise<void>;
 searchUsers(usernamePrefix: string): Promise<User[]>;
 getFriendship(userId: string, otherUserId: string): Promise<Friendship | null>;
 listFriendships(userId: string, requireServer?: boolean): Promise<Friendship[]>;
 sendFriendRequest(userId: string, recipientId: string): Promise<void>;
 respondToFriendRequest(userId: string, friendshipId: string, response: 'accepted' | 'declined' | 'cancelled'): Promise<void>;
 removeFriend(userId: string, friendshipId: string): Promise<void>;
}
export type FoodRepository = PlaceRepository & ReviewRepository & UserRepository;
