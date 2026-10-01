import { createUserWithEmailAndPassword, getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, updateProfile, type User } from 'firebase/auth';
import { firebaseApp } from './firebase';

export const firebaseAuth=firebaseApp?getAuth(firebaseApp):undefined;
export type AuthUser=User;
export function watchAuthState(callback:(user:AuthUser|null)=>void){if(!firebaseAuth){callback(null);return()=>{};}return onAuthStateChanged(firebaseAuth,callback);}
export async function signIn(email:string,password:string){if(!firebaseAuth)throw new Error('Firebase Authentication is not configured.');return signInWithEmailAndPassword(firebaseAuth,email.trim(),password);}
export async function signUp(name:string,email:string,password:string){if(!firebaseAuth)throw new Error('Firebase Authentication is not configured.');const credential=await createUserWithEmailAndPassword(firebaseAuth,email.trim(),password);await updateProfile(credential.user,{displayName:name.trim()});return credential;}
export async function signOutUser(){if(firebaseAuth)await signOut(firebaseAuth);}
