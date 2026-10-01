// TypeScript resolution fallback; Expo chooses the web or native auth implementation per platform.
export { firebaseAuth, watchAuthState, signIn, signUp, signOutUser } from './auth.native';
export type { AuthUser } from './auth.native';
