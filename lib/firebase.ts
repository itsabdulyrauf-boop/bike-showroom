import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, doc, setDoc, getDocFromServer } from 'firebase/firestore';
import firebaseConfigJson from '../firebase-applet-config.json';

// Construct config using JSON config first, falling back to environment variables
export const firebaseConfig = {
  projectId:
    firebaseConfigJson?.projectId ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    '',
  appId:
    firebaseConfigJson?.appId ||
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||
    '',
  apiKey:
    firebaseConfigJson?.apiKey ||
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    '',
  authDomain:
    firebaseConfigJson?.authDomain ||
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    '',
  firestoreDatabaseId:
    (firebaseConfigJson as any)?.databaseId ||
    firebaseConfigJson?.firestoreDatabaseId ||
    process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_DATABASE_ID ||
    '',
  storageBucket:
    firebaseConfigJson?.storageBucket ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    '',
  messagingSenderId:
    firebaseConfigJson?.messagingSenderId ||
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
    '',
  measurementId:
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

export function getFirestoreDb(): Firestore | null {
  if (db) return db;
  const app = getFirebaseApp();
  if (!app) return null;

  try {
    const customDatabaseId = firebaseConfig.firestoreDatabaseId;
    if (customDatabaseId && customDatabaseId !== '(default)' && customDatabaseId !== 'default') {
      db = getFirestore(app, customDatabaseId);
    } else {
      db = getFirestore(app);
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

export async function checkFirestoreHealth(): Promise<{ connected: boolean; permissionError: boolean; message: string }> {
  const database = getFirestoreDb();
  if (!database) {
    return { connected: false, permissionError: false, message: 'Firestore SDK not initialized.' };
  }
  try {
    await getDocFromServer(doc(database, 'settings', 'connection_test'));
    return { connected: true, permissionError: false, message: 'Connected to Firestore successfully.' };
  } catch (error: any) {
    const msg = error?.message || String(error);
    if (error?.code === 'permission-denied' || msg.includes('permission') || msg.includes('Missing or insufficient permissions')) {
      return {
        connected: false,
        permissionError: true,
        message: 'Firebase Security Rules Permission Denied! In Firebase Console -> Firestore Database -> Rules tab, allow read/write access.',
      };
    }
    if (msg.includes('the client is offline')) {
      return { connected: false, permissionError: false, message: 'Firestore client is currently offline.' };
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
export async function verifyLiveFirestoreWrite(): Promise<{ success: boolean; message: string }> {
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
    await setDoc(testDocRef, testData, { merge: true });

    // Immediately fetch from server to verify write succeeded on remote database
    const snap = await getDocFromServer(testDocRef);
    if (snap.exists()) {
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
    return {
      success: false,
      message: `Firestore Cloud Test Failed: ${err?.message || String(err)}`,
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


