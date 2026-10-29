import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  getReactNativePersistence,
  initializeAuth,
  type Auth,
} from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, type Functions } from 'firebase/functions';
import { connectStorageEmulator, getStorage, type FirebaseStorage } from 'firebase/storage';
import { Platform } from 'react-native';

import { EMULATOR_HOST, USE_EMULATORS, firebaseConfig } from '@/config/env';

/**
 * Single place the app initializes Firebase. Screens never import firebase/* directly;
 * they use typed helpers in src/data/ built on these instances.
 */

const isFirstInit = getApps().length === 0;

export const app: FirebaseApp = isFirstInit ? initializeApp(firebaseConfig) : getApp();

function createAuth(): Auth {
  if (!isFirstInit) return getAuth(app);
  // On native, keep the signed-in session across app restarts. The web build uses the
  // browser's default persistence.
  if (Platform.OS === 'web') return getAuth(app);
  return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
}

export const auth: Auth = createAuth();
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);
/** Same region as functions/src/index.ts. */
export const functions: Functions = getFunctions(app, 'us-central1');

if (USE_EMULATORS && isFirstInit) {
  connectAuthEmulator(auth, `http://${EMULATOR_HOST}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, EMULATOR_HOST, 8080);
  connectStorageEmulator(storage, EMULATOR_HOST, 9199);
  connectFunctionsEmulator(functions, EMULATOR_HOST, 5001);
}
