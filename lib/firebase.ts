import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  Firestore,
  doc,
  setDoc,
  getDocFromServer,
} from 'firebase/firestore';
import { getAnalytics, isSupported, Analytics } from 'firebase/analytics';
import firebaseConfigJson from '../firebase-applet-config.json';

// Construct config using JSON config first, falling back to environment variables
export const firebaseConfig = {
  projectId:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    firebaseConfigJson?.projectId ||
    '',
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||
    firebaseConfigJson?.appId ||
    '',
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    firebaseConfigJson?.apiKey ||
    '',
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    firebaseConfigJson?.authDomain ||
    '',
  firestoreDatabaseId:
    process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_DATABASE_ID ||
    (firebaseConfigJson as any)?.databaseId ||
    firebaseConfigJson?.firestoreDatabaseId ||
    '(default)',
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    firebaseConfigJson?.storageBucket ||
    '',
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
    firebaseConfigJson?.messagingSenderId ||
    '',
  measurementId:
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ||
    firebaseConfigJson?.measurementId ||
    '',
};

let firebaseApp: FirebaseApp | null = null;
let db: Firestore | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (typeof window === 'undefined') return null;
  if (!firebaseConfig.projectId) {
    console.warn('Firebase config missing or incomplete.');
    return null;
  }

  try {
    const existingApps = getApps();
    if (!existingApps.length) {
      firebaseApp = initializeApp(firebaseConfig);
    } else {
      const currentApp = getApp();
      if (currentApp.options.projectId !== firebaseConfig.projectId) {
        // App was initialized with a different project ID (e.g., default container env)
        // Force new app initialization with custom name or current config
        firebaseApp = initializeApp(firebaseConfig, `showroom_app_${firebaseConfig.projectId}`);
        db = null; // reset db so it binds to the new app
      } else {
        firebaseApp = currentApp;
      }
    }
    return firebaseApp;
  } catch (err: any) {
    if (err?.code === 'app/duplicate-app') {
      try {
        firebaseApp = getApp(`showroom_app_${firebaseConfig.projectId}`);
        return firebaseApp;
      } catch (e) {
        // ignore
      }
    }
    console.error('Error initializing Firebase App:', err);
    return null;
  }
}

let analytics: Analytics | null = null;

export async function getFirebaseAnalytics(): Promise<Analytics | null> {
  if (typeof window === 'undefined') return null;
  const app = getFirebaseApp();
  if (!app) return null;
  try {
    const supported = await isSupported();
    if (supported && !analytics) {
      analytics = getAnalytics(app);
    }
    return analytics;
  } catch (err) {
    console.warn('Firebase Analytics not supported in this environment:', err);
    return null;
  }
}

export function getFirestoreDb(): Firestore | null {
  if (db) return db;
  const app = getFirebaseApp();
  if (!app) return null;

  try {
    const customDatabaseId = firebaseConfig.firestoreDatabaseId;
    const firestoreSettings = {
      experimentalAutoDetectLongPolling: true,
    };

    if (customDatabaseId && customDatabaseId !== '(default)' && customDatabaseId !== 'default') {
      try {
        db = initializeFirestore(app, firestoreSettings, customDatabaseId);
      } catch {
        db = getFirestore(app, customDatabaseId);
      }
    } else {
      try {
        db = initializeFirestore(app, firestoreSettings);
      } catch {
        db = getFirestore(app);
      }
    }
    return db;
  } catch (err) {
    console.error('Error initializing Firestore:', err);
    return null;
  }
}

// Validate connection to Firestore
export async function testFirestoreConnection(): Promise<boolean> {
  const status = await checkFirestoreHealth();
  return status.connected;
}

export async function checkFirestoreHealth(): Promise<{
  connected: boolean;
  permissionError: boolean;
  message: string;
  actionUrl?: string;
}> {
  const database = getFirestoreDb();
  if (!database) {
    return { connected: false, permissionError: false, message: 'Firestore SDK not initialized.' };
  }
  try {
    const checkPromise = getDocFromServer(doc(database, 'settings', 'connection_test'));
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Connection check timed out')), 4000)
    );
    await Promise.race([checkPromise, timeoutPromise]);
    return { connected: true, permissionError: false, message: 'Connected to Firestore successfully.' };
  } catch (error: any) {
    const msg = error?.message || String(error);
    const code = error?.code || '';

    if (
      code === 'permission-denied' ||
      msg.includes('Cloud Firestore API has not been used') ||
      msg.includes('disabled') ||
      msg.includes('has not been used in project')
    ) {
      return {
        connected: false,
        permissionError: true,
        message: `Cloud Firestore API is not enabled or database has not been created in Firebase project "${firebaseConfig.projectId}". Please open Firebase Console and click "Create Database".`,
        actionUrl: `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore`,
      };
    }
    if (code === 'permission-denied' || msg.includes('permission') || msg.includes('Missing or insufficient permissions')) {
      return {
        connected: false,
        permissionError: true,
        message: 'Firebase Security Rules Permission Denied! In Firebase Console -> Firestore Database -> Rules tab, allow read/write access.',
        actionUrl: `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/rules`,
      };
    }
    if (code === 'unavailable' || msg.includes('the client is offline') || msg.includes('timed out') || msg.includes('Could not reach Cloud Firestore')) {
      return {
        connected: false,
        permissionError: false,
        message: 'Firestore backend is currently unreachable (operating smoothly in local offline mode).',
      };
    }
    if (error?.name === 'AbortError' || msg.includes('aborted') || msg.includes('user aborted')) {
      return { connected: false, permissionError: false, message: 'Request was cancelled.' };
    }
    return { connected: false, permissionError: false, message: msg || 'Firestore connection check failed.' };
  }
}

/**
 * Directly writes a test document to Firestore and reads it back from the server
 * to verify live database connectivity and write access.
 */
export async function verifyLiveFirestoreWrite(): Promise<{
  success: boolean;
  message: string;
  actionUrl?: string;
}> {
  const database = getFirestoreDb();
  if (!database) {
    return { success: false, message: 'Firestore SDK is not initialized.' };
  }
  try {
    const testDocRef = doc(database, 'settings', 'live_connection_verification');
    const testData = {
      verifiedAt: new Date().toISOString(),
      status: 'active',
      appProject: firebaseConfig.projectId,
    };

    const writePromise = (async () => {
      await setDoc(testDocRef, testData, { merge: true });
      const snap = await getDocFromServer(testDocRef);
      return snap.exists();
    })();

    const timeoutPromise = new Promise<boolean>((_, reject) =>
      setTimeout(() => reject(new Error('Write test timed out (server unreachable)')), 5000)
    );

    const exists = await Promise.race([writePromise, timeoutPromise]);
    if (exists) {
      return {
        success: true,
        message: `Verified! Document successfully written and confirmed on Firestore Cloud Server (${firebaseConfig.projectId}) at ${new Date().toLocaleTimeString()}!`,
      };
    } else {
      return {
        success: false,
        message: 'Write request executed locally, but server returned empty document snapshot.',
      };
    }
  } catch (err: any) {
    const msg = err?.message || String(err);
    const code = err?.code || '';

    if (
      code === 'permission-denied' ||
      msg.includes('Cloud Firestore API has not been used') ||
      msg.includes('disabled') ||
      msg.includes('has not been used in project')
    ) {
      return {
        success: false,
        message: `Cloud Firestore API is not enabled or database has not been created yet in Firebase project "${firebaseConfig.projectId}". Please visit the Firebase Console to create the database.`,
        actionUrl: `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore`,
      };
    }

    if (code === 'permission-denied' || msg.includes('permission') || msg.includes('Missing or insufficient permissions')) {
      return {
        success: false,
        message: `Permission Denied: Firebase Security Rules prevented the write. Please publish permissive rules in the Firebase Console.`,
        actionUrl: `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/rules`,
      };
    }

    if (code === 'unavailable' || msg.includes('timed out') || msg.includes('Could not reach Cloud Firestore') || msg.includes('offline')) {
      return {
        success: false,
        message: `Cloud Firestore is currently unreachable (network timeout or offline). Your changes are safely stored in local IndexedDB and will sync once connected.`,
      };
    }

    return {
      success: false,
      message: `Firestore Cloud Test Failed: ${msg}`,
    };
  }
}

/**
 * Recursively cleans an object for Firestore by omitting any keys with `undefined` values.
 * Firestore throws errors if `setDoc` or `addDoc` contains `undefined` values.
 */
export function sanitizeForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as any;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeForFirestore(item)) as any;
  }
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeForFirestore(value);
      }
    }
    return cleaned as T;
  }
  return obj;
}


