import { doc, setDoc, getDocs, collection } from 'firebase/firestore';
import { getFirestoreDb, sanitizeForFirestore, checkFirestoreHealth } from './firebase';
import {
  getLocalDB,
  getAllInventory,
  getAllSales,
  getAllCustomers,
  getAllExpenses,
  getShowroomSettings,
} from './db';
import { getAuthCredentials } from './authService';
import { InventoryItem, SaleRecord, CustomerItem, ExpenseRecord, ShowroomSettings } from '@/types';

export interface SyncResult {
  success: boolean;
  syncedCounts: {
    inventory: number;
    sales: number;
    customers: number;
    expenses: number;
    settings: number;
  };
  errors: string[];
  logs: string[];
  timestamp: string;
}

/**
 * Universal Bidirectional Sync:
 * 1. Pushes all local records (inventory, sales, customers, expenses, settings, auth credentials)
 *    to Firebase Firestore so that all local data is fully loaded into the cloud.
 * 2. Pulls all remote documents from Firebase Firestore into local IndexedDB so the client has everything.
 * 3. Never deletes local data during sync — ensures 100% data safety.
 */
export async function syncAllDataWithFirebase(options?: { forceUploadAll?: boolean }): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    syncedCounts: {
      inventory: 0,
      sales: 0,
      customers: 0,
      expenses: 0,
      settings: 0,
    },
    errors: [],
    logs: [],
    timestamp: new Date().toISOString(),
  };

  const addLog = (msg: string) => {
    console.log(`[SyncEngine] ${msg}`);
    result.logs.push(msg);
  };

  const addWarn = (msg: string) => {
    console.warn(`[SyncEngine] ${msg}`);
  };

  if (typeof window !== 'undefined' && !navigator.onLine) {
    result.success = false;
    result.errors.push('Device is offline. Cloud sync will automatically resume when connection is restored.');
    return result;
  }

  const firestore = getFirestoreDb();
  if (!firestore) {
    result.success = false;
    result.errors.push('Cloud Database client could not be initialized.');
    return result;
  }

  // Pre-flight health check with a fast timeout so sync never hangs
  try {
    const health = await checkFirestoreHealth();
    if (!health.connected) {
      result.success = false;
      result.errors.push(health.message);
      addLog(`Sync note: ${health.message}`);
      return result;
    }
  } catch {
    // Continue with graceful attempt
  }

  addLog('Connection verified. Uploading all local data to Firebase and synchronizing remote changes...');
  const localDb = await getLocalDB();

  // 1. INVENTORY SYNC (Local -> Cloud, then Cloud -> Local)
  try {
    const localInventory = await getAllInventory();
    addLog(`Processing ${localInventory.length} local inventory items...`);

    for (const item of localInventory) {
      if (options?.forceUploadAll || item.syncStatus === 'pending' || !item.syncStatus) {
        try {
          const itemToSync = { ...item, syncStatus: 'synced' as const };
          const docRef = doc(firestore, 'inventory', item.id);
          await setDoc(docRef, sanitizeForFirestore(itemToSync), { merge: true });

          item.syncStatus = 'synced';
          await localDb.put('inventory', item);
          result.syncedCounts.inventory++;
          addLog(`Uploaded Inventory: ${item.make} ${item.model} (${item.id})`);
        } catch (err: any) {
          item.syncStatus = 'pending';
          await localDb.put('inventory', item);
          const errStr = err?.message || String(err);
          addWarn(`Inventory upload warning for ${item.id}: ${errStr}`);
          if (!result.errors.includes(errStr)) result.errors.push(`Inventory item ${item.id}: ${errStr}`);
        }
      }
    }

    // Pull remote inventory from Cloud
    try {
      const invSnap = await getDocs(collection(firestore, 'inventory'));
      let pulledCount = 0;
      for (const docSnap of invSnap.docs) {
        const remoteItem = docSnap.data() as InventoryItem;
        const id = docSnap.id || remoteItem.id;
        const localItem = await localDb.get('inventory', id);

        // Save remote item locally if missing or remote is updated
        if (!localItem || (remoteItem.updatedAt && (!localItem.updatedAt || new Date(remoteItem.updatedAt) > new Date(localItem.updatedAt)))) {
          await localDb.put('inventory', { ...remoteItem, id, syncStatus: 'synced' });
          pulledCount++;
        }
      }
      if (pulledCount > 0) {
        addLog(`Downloaded ${pulledCount} inventory items from Firebase.`);
      }
    } catch (e: any) {
      addWarn(`Remote inventory pull warning: ${e?.message}`);
    }
  } catch (err: any) {
    addWarn(`Inventory sync error: ${err?.message}`);
  }

  // 2. SALES SYNC (Local -> Cloud, then Cloud -> Local)
  try {
    const localSales = await getAllSales();
    addLog(`Processing ${localSales.length} local sales records...`);

    for (const sale of localSales) {
      if (options?.forceUploadAll || sale.syncStatus === 'pending' || !sale.syncStatus) {
        try {
          const saleToSync = { ...sale, syncStatus: 'synced' as const };
          const docRef = doc(firestore, 'sales', sale.id);
          await setDoc(docRef, sanitizeForFirestore(saleToSync), { merge: true });

          sale.syncStatus = 'synced';
          await localDb.put('sales', sale);
          result.syncedCounts.sales++;
          addLog(`Uploaded Sale: ${sale.id} (PKR ${sale.totalPKR})`);
        } catch (err: any) {
          sale.syncStatus = 'pending';
          await localDb.put('sales', sale);
          const errStr = err?.message || String(err);
          addWarn(`Sale upload warning for ${sale.id}: ${errStr}`);
          if (!result.errors.includes(errStr)) result.errors.push(`Sale ${sale.id}: ${errStr}`);
        }
      }
    }

    // Pull remote sales from Cloud
    try {
      const salesSnap = await getDocs(collection(firestore, 'sales'));
      let pulledCount = 0;
      for (const docSnap of salesSnap.docs) {
        const remoteSale = docSnap.data() as SaleRecord;
        const id = docSnap.id || remoteSale.id;
        const localSale = await localDb.get('sales', id);

        if (!localSale) {
          await localDb.put('sales', { ...remoteSale, id, syncStatus: 'synced' });
          pulledCount++;
        }
      }
      if (pulledCount > 0) {
        addLog(`Downloaded ${pulledCount} sales records from Firebase.`);
      }
    } catch (e: any) {
      addWarn(`Remote sales pull warning: ${e?.message}`);
    }
  } catch (err: any) {
    addWarn(`Sales sync error: ${err?.message}`);
  }

  // 3. CUSTOMERS SYNC (Local -> Cloud, then Cloud -> Local)
  try {
    const localCustomers = await getAllCustomers();
    addLog(`Processing ${localCustomers.length} local customer records...`);

    for (const cust of localCustomers) {
      if (options?.forceUploadAll || cust.syncStatus === 'pending' || !cust.syncStatus) {
        try {
          const custToSync = { ...cust, syncStatus: 'synced' as const };
          const docRef = doc(firestore, 'customers', cust.id);
          await setDoc(docRef, sanitizeForFirestore(custToSync), { merge: true });

          cust.syncStatus = 'synced';
          await localDb.put('customers', cust);
          result.syncedCounts.customers++;
          addLog(`Uploaded Customer: ${cust.name} (${cust.id})`);
        } catch (err: any) {
          cust.syncStatus = 'pending';
          await localDb.put('customers', cust);
          const errStr = err?.message || String(err);
          addWarn(`Customer upload warning for ${cust.id}: ${errStr}`);
          if (!result.errors.includes(errStr)) result.errors.push(`Customer ${cust.id}: ${errStr}`);
        }
      }
    }

    // Pull remote customers from Cloud
    try {
      const custSnap = await getDocs(collection(firestore, 'customers'));
      let pulledCount = 0;
      for (const docSnap of custSnap.docs) {
        const remoteCust = docSnap.data() as CustomerItem;
        const id = docSnap.id || remoteCust.id;
        const localCust = await localDb.get('customers', id);

        if (!localCust) {
          await localDb.put('customers', { ...remoteCust, id, syncStatus: 'synced' });
          pulledCount++;
        }
      }
      if (pulledCount > 0) {
        addLog(`Downloaded ${pulledCount} customer records from Firebase.`);
      }
    } catch (e: any) {
      addWarn(`Remote customers pull warning: ${e?.message}`);
    }
  } catch (err: any) {
    addWarn(`Customers sync error: ${err?.message}`);
  }

  // 4. EXPENSES SYNC (Local -> Cloud, then Cloud -> Local)
  try {
    const localExpenses = await getAllExpenses();
    addLog(`Processing ${localExpenses.length} local expense records...`);

    for (const exp of localExpenses) {
      if (options?.forceUploadAll || exp.syncStatus === 'pending' || !exp.syncStatus) {
        try {
          const expToSync = { ...exp, syncStatus: 'synced' as const };
          const docRef = doc(firestore, 'expenses', exp.id);
          await setDoc(docRef, sanitizeForFirestore(expToSync), { merge: true });

          exp.syncStatus = 'synced';
          await localDb.put('expenses', exp);
          result.syncedCounts.expenses++;
          addLog(`Uploaded Expense: ${exp.title} (${exp.id})`);
        } catch (err: any) {
          exp.syncStatus = 'pending';
          await localDb.put('expenses', exp);
          const errStr = err?.message || String(err);
          addWarn(`Expense upload warning for ${exp.id}: ${errStr}`);
          if (!result.errors.includes(errStr)) result.errors.push(`Expense ${exp.id}: ${errStr}`);
        }
      }
    }

    // Pull remote expenses from Cloud
    try {
      const expSnap = await getDocs(collection(firestore, 'expenses'));
      let pulledCount = 0;
      for (const docSnap of expSnap.docs) {
        const remoteExp = docSnap.data() as ExpenseRecord;
        const id = docSnap.id || remoteExp.id;
        const localExp = await localDb.get('expenses', id);

        if (!localExp) {
          await localDb.put('expenses', { ...remoteExp, id, syncStatus: 'synced' });
          pulledCount++;
        }
      }
      if (pulledCount > 0) {
        addLog(`Downloaded ${pulledCount} expense records from Firebase.`);
      }
    } catch (e: any) {
      addWarn(`Remote expenses pull warning: ${e?.message}`);
    }
  } catch (err: any) {
    addWarn(`Expenses sync error: ${err?.message}`);
  }

  // 5. SHOWROOM SETTINGS & AUTH CREDENTIALS SYNC
  try {
    const settings = await getShowroomSettings();
    if (settings) {
      try {
        const docRef = doc(firestore, 'settings', 'showroom_main_settings');
        await setDoc(docRef, sanitizeForFirestore(settings), { merge: true });
        result.syncedCounts.settings = 1;
        addLog('Uploaded Showroom Settings to Firebase.');
      } catch (err: any) {
        addWarn(`Settings upload warning: ${err?.message}`);
      }
    }

    // Also ensure credentials are safely synced to settings/auth_credentials
    const creds = await getAuthCredentials();
    if (creds) {
      try {
        const docRef = doc(firestore, 'settings', 'auth_credentials');
        await setDoc(docRef, sanitizeForFirestore(creds), { merge: true });
      } catch {}
    }

    // Pull remote settings
    try {
      const settingsSnap = await getDocs(collection(firestore, 'settings'));
      for (const docSnap of settingsSnap.docs) {
        if (docSnap.id === 'showroom_main_settings') {
          const remoteSettings = docSnap.data() as ShowroomSettings;
          await localDb.put('settings', { ...remoteSettings, id: 'showroom_main_settings' });
        } else if (docSnap.id === 'auth_credentials') {
          await localDb.put('settings', { ...docSnap.data(), id: 'auth_credentials' });
        }
      }
    } catch (e: any) {
      addWarn(`Remote settings pull warning: ${e?.message}`);
    }
  } catch (err: any) {
    addWarn(`Settings sync error: ${err?.message}`);
  }

  result.success = result.errors.length === 0;
  addLog(
    `Sync complete. Result: ${result.success ? 'SUCCESS' : 'WITH WARNINGS'}. Uploaded: Inv=${result.syncedCounts.inventory}, Sales=${result.syncedCounts.sales}, Cust=${result.syncedCounts.customers}, Exp=${result.syncedCounts.expenses}.`
  );

  return result;
}

/**
 * Manual sync function called from the UI (SyncCenter).
 * Forces upload of all local records and downloads all remote records.
 */
export async function performManualCloudSync(): Promise<SyncResult> {
  return syncAllDataWithFirebase({ forceUploadAll: true });
}
