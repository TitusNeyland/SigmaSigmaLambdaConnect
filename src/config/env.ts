import type { FirebaseOptions } from 'firebase/app';

/**
 * Which Firebase project the app talks to.
 *
 * Set EXPO_PUBLIC_APP_ENV=production for prod builds (see the start:prod script and EAS
 * profiles in #6). Anything else, including unset, uses the dev project.
 *
 * These configs are not secrets. They only identify the Firebase project; Firestore and
 * Storage security rules decide who can read or write data. Real secrets (service account
 * keys, API tokens for other services) never go in this repo.
 */
export type AppEnv = 'development' | 'production';

const FIREBASE_CONFIGS: Record<AppEnv, FirebaseOptions> = {
  development: {
    apiKey: 'AIzaSyDiKwNqnXuv2Doy51w7hOOdRPi3j4KQSxc',
    authDomain: 'sigmasigmalambdadev.firebaseapp.com',
    projectId: 'sigmasigmalambdadev',
    storageBucket: 'sigmasigmalambdadev.firebasestorage.app',
    messagingSenderId: '234243817629',
    appId: '1:234243817629:web:b99133f3408519b4fcd474',
  },
  production: {
    apiKey: 'AIzaSyBS7mrIDNQj1gGuinw3E8ySafPcuojste4',
    authDomain: 'sigmasigmalambdaproduction.firebaseapp.com',
    projectId: 'sigmasigmalambdaproduction',
    storageBucket: 'sigmasigmalambdaproduction.firebasestorage.app',
    messagingSenderId: '814898154025',
    appId: '1:814898154025:web:af6a65d18b9f4b40ce2a38',
  },
};

export function parseAppEnv(value: string | undefined): AppEnv {
  return value === 'production' ? 'production' : 'development';
}

export function getFirebaseConfig(env: AppEnv): FirebaseOptions {
  return FIREBASE_CONFIGS[env];
}

/**
 * Point the app at the local Firebase emulators instead of the dev project.
 * Never allowed in production, whatever the flag says.
 */
export function shouldUseEmulators(env: AppEnv, flag: string | undefined): boolean {
  return env === 'development' && flag === 'true';
}

export const APP_ENV: AppEnv = parseAppEnv(process.env.EXPO_PUBLIC_APP_ENV);

export const firebaseConfig: FirebaseOptions = getFirebaseConfig(APP_ENV);

export const USE_EMULATORS: boolean = shouldUseEmulators(
  APP_ENV,
  process.env.EXPO_PUBLIC_USE_EMULATORS,
);

/** Host for the emulators. Android emulators reach the host machine at 10.0.2.2. */
export const EMULATOR_HOST: string = process.env.EXPO_PUBLIC_EMULATOR_HOST ?? '127.0.0.1';
