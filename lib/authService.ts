import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getFirestoreDb } from './firebase';
import { getLocalDB, purgeAllLocalCachedData } from './db';
import { AuthCredentials } from '@/types';

export const DEFAULT_AUTH_CREDENTIALS: AuthCredentials = {
  id: 'auth_main_credentials',
  email: 'admin@bikeshowroom.com',
  passwordHashOrPlain: 'admin123',
  updatedAt: new Date().toISOString(),
};

const SESSION_KEY = 'bike_showroom_auth_session';

/**
 * Gets the current auth credentials from Firestore or local IndexedDB,
 * seeding default admin@bikeshowroom.com / admin123 if none exist.
 */
export async function getAuthCredentials(): Promise<AuthCredentials> {
  const firestore = getFirestoreDb();
  const localDb = await getLocalDB();

  // 1. Try local IndexedDB first
  try {
    const localCreds = await localDb.get('settings', 'auth_main_credentials');
    if (localCreds && localCreds.email) {
      return localCreds as AuthCredentials;
    }
  } catch (err) {
    console.warn('Error fetching local auth credentials:', err);
  }

  // 2. Try Firestore with timeout fallback
  if (firestore) {
    try {
      const docRef = doc(firestore, 'settings', 'auth_credentials');
      const fetchPromise = getDoc(docRef);
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000));
      const snap = await Promise.race([fetchPromise, timeoutPromise]);
      if (snap && snap.exists()) {
        const firestoreCreds = snap.data() as AuthCredentials;
        await localDb.put('settings', { ...firestoreCreds, id: 'auth_main_credentials' });
        return firestoreCreds;
      }
    } catch (err) {
      console.warn('[Auth] Remote auth check skipped (operating offline-first):', err);
    }
  }

  // 3. Seed default if not found anywhere
  await saveAuthCredentials(DEFAULT_AUTH_CREDENTIALS);
  return DEFAULT_AUTH_CREDENTIALS;
}

/**
 * Saves updated AuthCredentials to both local IndexedDB and Firebase Firestore.
 */
export async function saveAuthCredentials(creds: AuthCredentials): Promise<void> {
  const localDb = await getLocalDB();
  const credsToSave = {
    ...creds,
    id: 'auth_main_credentials',
    updatedAt: new Date().toISOString(),
  };

  // Save to local IndexedDB
  await localDb.put('settings', credsToSave);

  // Save to Firestore if available
  const firestore = getFirestoreDb();
  if (firestore) {
    try {
      const docRef = doc(firestore, 'settings', 'auth_credentials');
      await setDoc(docRef, credsToSave, { merge: true });
    } catch (err: any) {
      console.warn('[Auth] Cloud credential sync note (offline or uncreated):', err?.message || err);
    }
  }
}

/**
 * Checks if user is currently logged in via session key.
 */
export function getStoredSessionUser(): { email: string; loggedInAt: string } | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Authenticates email and password against stored credentials.
 */
export async function loginUser(
  email: string,
  pass: string,
  rememberMe: boolean = true
): Promise<{ success: boolean; error?: string }> {
  const creds = await getAuthCredentials();

  const inputEmail = email.trim().toLowerCase();
  const storedEmail = creds.email.trim().toLowerCase();

  if (inputEmail === storedEmail && pass === creds.passwordHashOrPlain) {
    const sessionData = {
      email: creds.email,
      loggedInAt: new Date().toISOString(),
    };
    if (typeof window !== 'undefined') {
      if (rememberMe) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
      } else {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
      }
    }
    return { success: true };
  }

  return { success: false, error: 'Invalid email address or password.' };
}

/**
 * Logs out current user session and purges local cache to prevent stale data persistence.
 */
export async function logoutUser(): Promise<void> {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  }
  await purgeAllLocalCachedData();
}

/**
 * Updates the login email and password in Settings.
 */
export async function updateLoginCredentials(
  currentPass: string,
  newEmail: string,
  newPass: string
): Promise<{ success: boolean; error?: string }> {
  const currentCreds = await getAuthCredentials();

  if (currentPass !== currentCreds.passwordHashOrPlain) {
    return { success: false, error: 'Current password is incorrect.' };
  }

  if (!newEmail || !newEmail.includes('@')) {
    return { success: false, error: 'Please enter a valid email address.' };
  }

  if (!newPass || newPass.length < 4) {
    return { success: false, error: 'New password must be at least 4 characters long.' };
  }

  const updatedCreds: AuthCredentials = {
    id: 'auth_main_credentials',
    email: newEmail.trim(),
    passwordHashOrPlain: newPass,
    updatedAt: new Date().toISOString(),
  };

  await saveAuthCredentials(updatedCreds);

  // Update current active session user email
  if (typeof window !== 'undefined') {
    const session = getStoredSessionUser();
    if (session) {
      const updatedSession = { ...session, email: newEmail.trim() };
      localStorage.setItem(SESSION_KEY, JSON.stringify(updatedSession));
    }
  }

  return { success: true };
}
