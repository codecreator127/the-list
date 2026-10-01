import AsyncStorage from '@react-native-async-storage/async-storage';
import { createUserWithEmailAndPassword, getAuth, initializeAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, updateProfile, type Persistence, type User } from 'firebase/auth';
import { firebaseApp } from './firebase';

const getNativePersistence=(require('firebase/auth') as {getReactNativePersistence:(storage:typeof AsyncStorage)=>Persistence}).getReactNativePersistence;
function makeAuth(){if(!firebaseApp)return undefined;try{return initializeAuth(firebaseApp,{persistence:getNativePersistence(AsyncStorage)});}catch{return getAuth(firebaseApp);}}
export const firebaseAuth=makeAuth();
export type AuthUser=User;
export function watchAuthState(callback:(user:AuthUser|null)=>void){if(!firebaseAuth){callback(null);return()=>{};}return onAuthStateChanged(firebaseAuth,callback);}
export async function signIn(email:string,password:string){if(!firebaseAuth)throw new Error('Firebase Authentication is not configured.');return signInWithEmailAndPassword(firebaseAuth,email.trim(),password);}
export async function signUp(name:string,email:string,password:string){if(!firebaseAuth)throw new Error('Firebase Authentication is not configured.');const credential=await createUserWithEmailAndPassword(firebaseAuth,email.trim(),password);await updateProfile(credential.user,{displayName:name.trim()});return credential;}
export async function signOutUser(){if(firebaseAuth)await signOut(firebaseAuth);}
