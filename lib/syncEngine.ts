import { doc, setDoc, getDocs, collection } from 'firebase/firestore';
import { getFirestoreDb, sanitizeForFirestore, checkFirestoreHealth } from './firebase';
import {
  getLocalDB,
  getAllInventory,
  getAllSales,
  getAllCustomers,
  getAllExpenses,
  getShowroomSettings,
  saveInventoryItem,
  saveSaleRecord,
  saveCustomer,
  saveExpense,
  saveShowroomSettings,
} from './db';
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
 * Pushes all pending local records to Firebase Firestore
 * and fetches any remote records that don't exist locally.
 */
export async function performManualCloudSync(): Promise<SyncResult> {
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
    result.errors.push('Device is offline. Please connect to the internet to sync with Cloud Database.');
    return result;
  }

  const firestore = getFirestoreDb();
  if (!firestore) {
    result.success = false;
    result.errors.push('Cloud Database client could not be initialized.');
    return result;
  }

  addLog('Verifying Cloud Database connectivity...');
  const health = await checkFirestoreHealth();
  if (!health.connected) {
    result.success = false;
    result.errors.push(health.message);
    addLog(`Sync note: ${health.message}`);
    return result;
  }

  addLog('Connection verified. Starting cloud sync operation with Cloud Database...');
  const localDb = await getLocalDB();

  // 1. SYNC INVENTORY
  try {
    const inventory = await getAllInventory();
    addLog(`Checking ${inventory.length} local inventory items for cloud sync...`);
    for (const item of inventory) {
      try {
        const itemToSync = { ...item, syncStatus: 'synced' as const };
        const docRef = doc(firestore, 'inventory', item.id);
        await setDoc(docRef, sanitizeForFirestore(itemToSync), { merge: true });

        item.syncStatus = 'synced';
        await localDb.put('inventory', item);
        result.syncedCounts.inventory++;
        addLog(`Successfully synced Inventory item ${item.id} (${item.make} ${item.model}) to Cloud Database.`);
      } catch (err: any) {
        item.syncStatus = 'pending';
        await localDb.put('inventory', item);
        const errStr = err?.message || String(err);
        addWarn(`Failed to sync Inventory item ${item.id}: ${errStr}`);
        if (!result.errors.includes(errStr)) {
          if (err?.code === 'permission-denied' || errStr.includes('permission')) {
            const permMsg = 'Cloud Permission Denied! Please check security rules on your Cloud Server.';
            if (!result.errors.includes(permMsg)) result.errors.push(permMsg);
          } else {
            result.errors.push(`Inventory item ${item.id} sync error: ${errStr}`);
          }
        }
      }
    }

    // Pull and reconcile Remote Inventory
    try {
      const invSnap = await getDocs(collection(firestore, 'inventory'));
      let pulledCount = 0;
      const remoteIds = new Set<string>();
      for (const docSnap of invSnap.docs) {
        const remoteItem = docSnap.data() as InventoryItem;
        const id = docSnap.id || remoteItem.id;
        remoteIds.add(id);
        const localItem = await localDb.get('inventory', id);
        if (!localItem) {
          await localDb.put('inventory', { ...remoteItem, id, syncStatus: 'synced' });
          pulledCount++;
        }
      }
      // Purge local records that were deleted on cloud
      const allLocalInv = await localDb.getAll('inventory');
      for (const loc of allLocalInv) {
        if (!remoteIds.has(loc.id) && loc.syncStatus !== 'pending') {
          await localDb.delete('inventory', loc.id);
        }
      }
      if (pulledCount > 0) {
        addLog(`Pulled ${pulledCount} new inventory records from Cloud Database into local database.`);
      }
    } catch (e: any) {
      addWarn(`Could not pull remote inventory from Cloud Database: ${e?.message}`);
    }
  } catch (err: any) {
    addWarn(`Error accessing local inventory store: ${err?.message}`);
  }

  // 2. SYNC SALES
  try {
    const sales = await getAllSales();
    addLog(`Checking ${sales.length} local sales records for cloud sync...`);
    for (const sale of sales) {
      try {
        const saleToSync = { ...sale, syncStatus: 'synced' as const };
        const docRef = doc(firestore, 'sales', sale.id);
        await setDoc(docRef, sanitizeForFirestore(saleToSync), { merge: true });

        sale.syncStatus = 'synced';
        await localDb.put('sales', sale);
        result.syncedCounts.sales++;
        addLog(`Successfully synced Sale record ${sale.id} (PKR ${sale.totalPKR}) to Cloud Database.`);
      } catch (err: any) {
        sale.syncStatus = 'pending';
        await localDb.put('sales', sale);
        const errStr = err?.message || String(err);
        addWarn(`Failed to sync Sale record ${sale.id}: ${errStr}`);
        if (!result.errors.includes(errStr)) {
          if (err?.code === 'permission-denied' || errStr.includes('permission')) {
            const permMsg = 'Cloud Permission Denied! Please check security rules on your Cloud Server.';
            if (!result.errors.includes(permMsg)) result.errors.push(permMsg);
          } else {
            result.errors.push(`Sale ${sale.id} sync error: ${errStr}`);
          }
        }
      }
    }

    // Pull and reconcile Remote Sales
    try {
      const salesSnap = await getDocs(collection(firestore, 'sales'));
      let pulledCount = 0;
      const remoteIds = new Set<string>();
      for (const docSnap of salesSnap.docs) {
        const remoteSale = docSnap.data() as SaleRecord;
        const id = docSnap.id || remoteSale.id;
        remoteIds.add(id);
        const localSale = await localDb.get('sales', id);
        if (!localSale) {
          await localDb.put('sales', { ...remoteSale, id, syncStatus: 'synced' });
          pulledCount++;
        }
      }
      // Purge local sales that were deleted on cloud
      const allLocalSales = await localDb.getAll('sales');
      for (const loc of allLocalSales) {
        if (!remoteIds.has(loc.id) && loc.syncStatus !== 'pending') {
          await localDb.delete('sales', loc.id);
        }
      }
      if (pulledCount > 0) {
        addLog(`Pulled ${pulledCount} new sales records from Cloud Database into local database.`);
      }
    } catch (e: any) {
      addWarn(`Could not pull remote sales from Cloud Database: ${e?.message}`);
    }
  } catch (err: any) {
    addWarn(`Error accessing local sales store: ${err?.message}`);
  }

  // 3. SYNC CUSTOMERS
  try {
    const customers = await getAllCustomers();
    addLog(`Checking ${customers.length} local customer records for cloud sync...`);
    for (const cust of customers) {
      try {
        const custToSync = { ...cust, syncStatus: 'synced' as const };
        const docRef = doc(firestore, 'customers', cust.id);
        await setDoc(docRef, sanitizeForFirestore(custToSync), { merge: true });

        cust.syncStatus = 'synced';
        await localDb.put('customers', cust);
        result.syncedCounts.customers++;
        addLog(`Successfully synced Customer ${cust.id} (${cust.name}) to Cloud Database.`);
      } catch (err: any) {
        cust.syncStatus = 'pending';
        await localDb.put('customers', cust);
        const errStr = err?.message || String(err);
        addWarn(`Failed to sync Customer ${cust.id}: ${errStr}`);
        if (!result.errors.includes(errStr)) {
          if (err?.code === 'permission-denied' || errStr.includes('permission')) {
            const permMsg = 'Cloud Permission Denied! Please check security rules on your Cloud Server.';
            if (!result.errors.includes(permMsg)) result.errors.push(permMsg);
          } else {
            result.errors.push(`Customer ${cust.id} sync error: ${errStr}`);
          }
        }
      }
    }

    // Pull and reconcile Remote Customers
    try {
      const custSnap = await getDocs(collection(firestore, 'customers'));
      let pulledCount = 0;
      const remoteIds = new Set<string>();
      for (const docSnap of custSnap.docs) {
        const remoteCust = docSnap.data() as CustomerItem;
        const id = docSnap.id || remoteCust.id;
        remoteIds.add(id);
        const localCust = await localDb.get('customers', id);
        if (!localCust) {
          await localDb.put('customers', { ...remoteCust, id, syncStatus: 'synced' });
          pulledCount++;
        }
      }
      // Purge local customers deleted on cloud
      const allLocalCusts = await localDb.getAll('customers');
      for (const loc of allLocalCusts) {
        if (!remoteIds.has(loc.id) && loc.syncStatus !== 'pending') {
          await localDb.delete('customers', loc.id);
        }
      }
      if (pulledCount > 0) {
        addLog(`Pulled ${pulledCount} new customer records from Cloud Database into local database.`);
      }
    } catch (e: any) {
      addWarn(`Could not pull remote customers: ${e?.message}`);
    }
  } catch (err: any) {
    addWarn(`Error accessing local customers store: ${err?.message}`);
  }

  // 4. SYNC EXPENSES
  try {
    const expenses = await getAllExpenses();
    addLog(`Checking ${expenses.length} local expense records for cloud sync...`);
    for (const exp of expenses) {
      try {
        const expToSync = { ...exp, syncStatus: 'synced' as const };
        const docRef = doc(firestore, 'expenses', exp.id);
        await setDoc(docRef, sanitizeForFirestore(expToSync), { merge: true });

        exp.syncStatus = 'synced';
        await localDb.put('expenses', exp);
        result.syncedCounts.expenses++;
        addLog(`Successfully synced Expense ${exp.id} (PKR ${exp.amountPKR}) to Cloud Database.`);
      } catch (err: any) {
        exp.syncStatus = 'pending';
        await localDb.put('expenses', exp);
        const errStr = err?.message || String(err);
        addWarn(`Failed to sync Expense ${exp.id}: ${errStr}`);
        if (!result.errors.includes(errStr)) {
          if (err?.code === 'permission-denied' || errStr.includes('permission')) {
            const permMsg = 'Cloud Permission Denied! Please check security rules on your Cloud Server.';
            if (!result.errors.includes(permMsg)) result.errors.push(permMsg);
          } else {
            result.errors.push(`Expense ${exp.id} sync error: ${errStr}`);
          }
        }
      }
    }

    // Pull and reconcile Remote Expenses
    try {
      const expSnap = await getDocs(collection(firestore, 'expenses'));
      let pulledCount = 0;
      const remoteIds = new Set<string>();
      for (const docSnap of expSnap.docs) {
        const remoteExp = docSnap.data() as ExpenseRecord;
        const id = docSnap.id || remoteExp.id;
        remoteIds.add(id);
        const localExp = await localDb.get('expenses', id);
        if (!localExp) {
          await localDb.put('expenses', { ...remoteExp, id, syncStatus: 'synced' });
          pulledCount++;
        }
      }
      // Purge local expenses deleted on cloud
      const allLocalExp = await localDb.getAll('expenses');
      for (const loc of allLocalExp) {
        if (!remoteIds.has(loc.id) && loc.syncStatus !== 'pending') {
          await localDb.delete('expenses', loc.id);
        }
      }
      if (pulledCount > 0) {
        addLog(`Pulled ${pulledCount} new expense records from Cloud Database into local database.`);
      }
    } catch (e: any) {
      addWarn(`Could not pull remote expenses: ${e?.message}`);
    }
  } catch (err: any) {
    addWarn(`Error accessing local expenses store: ${err?.message}`);
  }

  // 5. SYNC SHOWROOM SETTINGS
  try {
    const settings = await getShowroomSettings();
    if (settings) {
      try {
        const docRef = doc(firestore, 'settings', settings.id || 'showroom_main_settings');
        await setDoc(docRef, sanitizeForFirestore(settings), { merge: true });
        result.syncedCounts.settings = 1;
        addLog('Successfully synced Showroom Settings to Cloud Database.');
      } catch (err: any) {
        const errStr = err?.message || String(err);
        addWarn(`Failed to sync Showroom Settings: ${errStr}`);
        if (!result.errors.includes(errStr)) {
          if (err?.code === 'permission-denied' || errStr.includes('permission')) {
            const permMsg = 'Cloud Permission Denied! Please check security rules on your Cloud Server.';
            if (!result.errors.includes(permMsg)) result.errors.push(permMsg);
          } else {
            result.errors.push(`Showroom Settings sync error: ${errStr}`);
          }
        }
      }
    }
  } catch (err: any) {
    addWarn(`Error reading showroom settings: ${err?.message}`);
  }

  result.success = result.errors.length === 0;
  addLog(`Sync operation finished. Result: ${result.success ? 'SUCCESS' : 'COMPLETED WITH WARNINGS/ERRORS'}. Total synced: Inventory=${result.syncedCounts.inventory}, Sales=${result.syncedCounts.sales}, Customers=${result.syncedCounts.customers}, Expenses=${result.syncedCounts.expenses}.`);

  return result;
}
