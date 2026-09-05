import { openDB, IDBPDatabase } from 'idb';
import { doc, setDoc, deleteDoc, getDocs, collection } from 'firebase/firestore';
import { getFirestoreDb, sanitizeForFirestore } from './firebase';
import {
  InventoryItem,
  SaleRecord,
  SaleItem,
  CustomerItem,
  ExpenseRecord,
  ShowroomSettings,
  PendingSyncCounts,
} from '@/types';
import {
  INITIAL_INVENTORY,
  INITIAL_CUSTOMERS,
  INITIAL_EXPENSES,
  INITIAL_SHOWROOM_SETTINGS,
} from './sampleData';

const DB_NAME = 'BikeShowroomPOS_DB';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getLocalDB(): Promise<IDBPDatabase> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB is only available in the browser.'));
  }

  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('inventory')) {
          const invStore = db.createObjectStore('inventory', { keyPath: 'id' });
          invStore.createIndex('by-syncStatus', 'syncStatus');
          invStore.createIndex('by-status', 'status');
        }

        if (!db.objectStoreNames.contains('sales')) {
          const salesStore = db.createObjectStore('sales', { keyPath: 'id' });
          salesStore.createIndex('by-syncStatus', 'syncStatus');
          salesStore.createIndex('by-createdAt', 'createdAt');
        }

        if (!db.objectStoreNames.contains('customers')) {
          const custStore = db.createObjectStore('customers', { keyPath: 'id' });
          custStore.createIndex('by-syncStatus', 'syncStatus');
        }

        if (!db.objectStoreNames.contains('expenses')) {
          const expStore = db.createObjectStore('expenses', { keyPath: 'id' });
          expStore.createIndex('by-syncStatus', 'syncStatus');
          expStore.createIndex('by-date', 'date');
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }
      },
    });
  }

  return dbPromise;
}

/**
 * Synchronizes existing data from Cloud to IndexedDB if available.
 * Uses a safe timeout so offline/unreachable Firestore never blocks initial app startup.
 * Fully reconciles additions, updates, and cloud deletions.
 */
export async function seedInitialDataIfEmpty(): Promise<void> {
  const db = await getLocalDB();
  const firestore = getFirestoreDb();

  // Try pulling and reconciling existing data from Cloud if available
  if (firestore) {
    try {
      console.log('[Cloud Sync] Checking Cloud Firestore for remote updates...');

      const syncWithCloud = async () => {
        try {
          // 1. Inventory Sync & Reconcile
          const invSnap = await getDocs(collection(firestore, 'inventory'));
          const remoteInvIds = new Set<string>();
          for (const docSnap of invSnap.docs) {
            const remoteItem = docSnap.data() as InventoryItem;
            const id = docSnap.id || remoteItem.id;
            remoteInvIds.add(id);
            await db.put('inventory', { ...remoteItem, id, syncStatus: 'synced' });
          }
          const localInv = await db.getAll('inventory');
          for (const loc of localInv) {
            if (!remoteInvIds.has(loc.id) && loc.syncStatus !== 'pending') {
              await db.delete('inventory', loc.id);
            }
          }

          // 2. Customers Sync & Reconcile
          const custSnap = await getDocs(collection(firestore, 'customers'));
          const remoteCustIds = new Set<string>();
          for (const docSnap of custSnap.docs) {
            const remoteCust = docSnap.data() as CustomerItem;
            const id = docSnap.id || remoteCust.id;
            remoteCustIds.add(id);
            await db.put('customers', { ...remoteCust, id, syncStatus: 'synced' });
          }
          const localCust = await db.getAll('customers');
          for (const loc of localCust) {
            if (!remoteCustIds.has(loc.id) && loc.syncStatus !== 'pending') {
              await db.delete('customers', loc.id);
            }
          }

          // 3. Expenses Sync & Reconcile
          const expSnap = await getDocs(collection(firestore, 'expenses'));
          const remoteExpIds = new Set<string>();
          for (const docSnap of expSnap.docs) {
            const remoteExp = docSnap.data() as ExpenseRecord;
            const id = docSnap.id || remoteExp.id;
            remoteExpIds.add(id);
            await db.put('expenses', { ...remoteExp, id, syncStatus: 'synced' });
          }
          const localExp = await db.getAll('expenses');
          for (const loc of localExp) {
            if (!remoteExpIds.has(loc.id) && loc.syncStatus !== 'pending') {
              await db.delete('expenses', loc.id);
            }
          }

          // 4. Sales Sync & Reconcile
          const salesSnap = await getDocs(collection(firestore, 'sales'));
          const remoteSalesIds = new Set<string>();
          for (const docSnap of salesSnap.docs) {
            const remoteSale = docSnap.data() as SaleRecord;
            const id = docSnap.id || remoteSale.id;
            remoteSalesIds.add(id);
            await db.put('sales', { ...remoteSale, id, syncStatus: 'synced' });
          }
          const localSales = await db.getAll('sales');
          for (const loc of localSales) {
            if (!remoteSalesIds.has(loc.id) && loc.syncStatus !== 'pending') {
              await db.delete('sales', loc.id);
            }
          }

          // 5. Settings Sync
          const settingsSnap = await getDocs(collection(firestore, 'settings'));
          if (!settingsSnap.empty) {
            for (const docSnap of settingsSnap.docs) {
              if (docSnap.id === 'showroom_main_settings') {
                await db.put('settings', { ...docSnap.data(), id: 'showroom_main_settings' } as ShowroomSettings);
              }
            }
          }
        } catch (err: any) {
          console.warn('[Cloud Sync] Cloud sync note (operating in offline-first mode):', err?.message || err);
        }
      };

      // Cap initial sync wait to 2.5 seconds to guarantee lightning-fast startup
      await Promise.race([
        syncWithCloud(),
        new Promise<void>((resolve) => setTimeout(resolve, 2500)),
      ]);
    } catch (err) {
      console.warn('[Cloud Sync] Initial cloud fetch skipped:', err);
    }
  }

  // Ensure default showroom settings record exists locally if not found
  const existingSettings = await db.get('settings', 'showroom_main_settings');
  if (!existingSettings) {
    await db.put('settings', INITIAL_SHOWROOM_SETTINGS);
  }
}

// ================= INVENTORY CRUD =================
export async function getAllInventory(): Promise<InventoryItem[]> {
  const db = await getLocalDB();

  // Auto-reconcile: If any item's chassis/engine was already sold in completed sales, ensure status is 'Sold'
  try {
    const allSales: SaleRecord[] = await db.getAll('sales');
    const soldChassisSet = new Set<string>();
    const soldEngineSet = new Set<string>();
    const soldBikeIdSet = new Set<string>();

    allSales.forEach((s: SaleRecord) => {
      (s.items || []).forEach((item: SaleItem) => {
        if (item.bikeId) soldBikeIdSet.add(item.bikeId);
        if (item.chassisNumber && item.chassisNumber.trim() && !item.chassisNumber.startsWith('CUSTOM-')) {
          soldChassisSet.add(item.chassisNumber.trim().toLowerCase());
        }
        if (item.engineNumber && item.engineNumber.trim() && item.engineNumber !== 'N/A') {
          soldEngineSet.add(item.engineNumber.trim().toLowerCase());
        }
      });
    });

    const allInv: InventoryItem[] = await db.getAll('inventory');
    for (const inv of allInv) {
      const isSoldById = soldBikeIdSet.has(inv.id);
      const isSoldByChassis =
        inv.chassisNumber && soldChassisSet.has(inv.chassisNumber.trim().toLowerCase());
      const isSoldByEngine =
        inv.engineNumber && inv.engineNumber !== 'N/A' && soldEngineSet.has(inv.engineNumber.trim().toLowerCase());

      if ((isSoldById || isSoldByChassis || isSoldByEngine) && inv.status === 'Available') {
        inv.status = 'Sold';
        inv.stockCount = 0;
        inv.updatedAt = new Date().toISOString();
        await db.put('inventory', inv);

        const firestore = getFirestoreDb();
        if (firestore) {
          try {
            await setDoc(doc(firestore, 'inventory', inv.id), sanitizeForFirestore(inv), { merge: true });
          } catch (e) {
            console.warn(`Could not sync reconciled sold item ${inv.id} to Firestore:`, e);
          }
        }
      }
    }
  } catch (reconcileErr) {
    console.warn('Error during inventory auto-reconciliation:', reconcileErr);
  }

  return db.getAll('inventory');
}

export async function saveInventoryItem(item: InventoryItem): Promise<void> {
  const db = await getLocalDB();
  const firestore = getFirestoreDb();

  const itemToSave: InventoryItem = { ...item, syncStatus: 'synced' };

  if (firestore) {
    try {
      console.log(`[POS DB] Syncing Inventory item ${item.id} (${item.make} ${item.model}) to Cloud...`);
      await setDoc(doc(firestore, 'inventory', item.id), sanitizeForFirestore(itemToSave), { merge: true });
      console.log(`[POS DB] Inventory item ${item.id} saved to Cloud successfully.`);
    } catch (e) {
      console.warn(`[POS DB] Cloud write warning for inventory ${item.id}:`, e);
      itemToSave.syncStatus = 'pending';
    }
  } else {
    console.log(`[POS DB] Cloud connection offline or unavailable. Marking inventory ${item.id} as pending.`);
    itemToSave.syncStatus = 'pending';
  }

  await db.put('inventory', itemToSave);
}

export async function deleteInventoryItem(id: string): Promise<void> {
  const db = await getLocalDB();
  const firestore = getFirestoreDb();

  console.log(`[POS DB] Deleting Inventory item ${id} locally...`);
  await db.delete('inventory', id);

  if (firestore) {
    try {
      console.log(`[POS DB] Deleting Inventory item ${id} from Cloud...`);
      await deleteDoc(doc(firestore, 'inventory', id));
      console.log(`[POS DB] Inventory item ${id} deleted from Cloud successfully.`);
    } catch (e) {
      console.warn(`[POS DB] Error deleting inventory ${id} from Cloud:`, e);
    }
  }
}

// ================= SALES CRUD =================
export async function getAllSales(): Promise<SaleRecord[]> {
  const db = await getLocalDB();
  const sales = await db.getAll('sales');
  return sales.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function deleteSaleRecord(saleId: string, restoreInventoryStock: boolean = false): Promise<void> {
  const db = await getLocalDB();
  const firestore = getFirestoreDb();

  const sale = await db.get('sales', saleId);

  // If requested, restore the stock of items from this sale
  if (restoreInventoryStock && sale && sale.items) {
    const allInv = await db.getAll('inventory');
    for (const item of sale.items) {
      let matched = allInv.find((i) => i.id === item.bikeId);
      if (!matched && item.chassisNumber && item.chassisNumber.trim() && !item.chassisNumber.startsWith('CUSTOM-')) {
        const cNum = item.chassisNumber.trim().toLowerCase();
        matched = allInv.find((i) => i.chassisNumber && i.chassisNumber.trim().toLowerCase() === cNum);
      }
      if (!matched && item.engineNumber && item.engineNumber.trim() && item.engineNumber !== 'N/A') {
        const eNum = item.engineNumber.trim().toLowerCase();
        matched = allInv.find((i) => i.engineNumber && i.engineNumber.trim().toLowerCase() === eNum);
      }
      if (matched) {
        matched.stockCount = (matched.stockCount || 0) + (item.quantity || 1);
        matched.status = 'Available';
        matched.updatedAt = new Date().toISOString();
        await db.put('inventory', matched);
        if (firestore) {
          try {
            await setDoc(doc(firestore, 'inventory', matched.id), sanitizeForFirestore(matched), { merge: true });
          } catch (e) {
            console.warn(`Could not sync restored inventory ${matched.id}:`, e);
          }
        }
      }
    }
  }

  // Delete from local IndexedDB
  await db.delete('sales', saleId);

  // Delete from Firestore
  if (firestore) {
    try {
      await deleteDoc(doc(firestore, 'sales', saleId));
      console.log(`[POS DB] Sale ${saleId} deleted from Firestore.`);
    } catch (err) {
      console.warn(`[POS DB] Error deleting sale ${saleId} from Firestore:`, err);
    }
  }
}

export async function saveSaleRecord(sale: SaleRecord): Promise<void> {
  const db = await getLocalDB();
  const firestore = getFirestoreDb();

  console.log(`[POS DB] Processing sale record ${sale.id} for PKR ${sale.totalPKR}...`);
  const saleToSave: SaleRecord = { ...sale, syncStatus: 'synced' };

  if (firestore) {
    try {
      console.log(`[POS DB] Syncing sale ${sale.id} to Firestore...`);
      await setDoc(doc(firestore, 'sales', sale.id), sanitizeForFirestore(saleToSave), { merge: true });
      console.log(`[POS DB] Sale ${sale.id} successfully saved to Firestore.`);
    } catch (e) {
      console.warn(`[POS DB] Firestore sale write warning for ${sale.id}:`, e);
      saleToSave.syncStatus = 'pending';
    }
  } else {
    console.log(`[POS DB] Firestore unavailable. Marking sale ${sale.id} as pending.`);
    saleToSave.syncStatus = 'pending';
  }

  // Collect items to sync to Firestore AFTER the IndexedDB transaction finishes
  const bikesToFirestore: InventoryItem[] = [];
  let customerToFirestore: CustomerItem | null = null;

  try {
    const tx = db.transaction(['sales', 'inventory', 'customers'], 'readwrite');
    await tx.objectStore('sales').put(saleToSave);

    // 2. Reduce inventory stock count or update bike status
    const allInvItems = await tx.objectStore('inventory').getAll();

    for (const item of sale.items) {
      let matchedBike: InventoryItem | undefined = undefined;

      if (item.bikeId) {
        matchedBike = allInvItems.find((b) => b.id === item.bikeId);
      }

      if (!matchedBike && item.chassisNumber && item.chassisNumber.trim() && !item.chassisNumber.startsWith('CUSTOM-')) {
        const cNum = item.chassisNumber.trim().toLowerCase();
        matchedBike = allInvItems.find(
          (b) => b.chassisNumber && b.chassisNumber.trim().toLowerCase() === cNum
        );
      }

      if (!matchedBike && item.engineNumber && item.engineNumber.trim() && item.engineNumber !== 'N/A') {
        const eNum = item.engineNumber.trim().toLowerCase();
        matchedBike = allInvItems.find(
          (b) => b.engineNumber && b.engineNumber.trim().toLowerCase() === eNum
        );
      }

      if (matchedBike) {
        matchedBike.stockCount = Math.max(0, (matchedBike.stockCount || 1) - (item.quantity || 1));
        if (matchedBike.stockCount === 0) {
          matchedBike.status = 'Sold';
        }
        matchedBike.updatedAt = new Date().toISOString();
        matchedBike.syncStatus = 'synced';
        await tx.objectStore('inventory').put(matchedBike);
        bikesToFirestore.push(matchedBike);
      }
    }

    // 3. Update or create Customer total purchases
    if (sale.customerName) {
      const allCustomers = await tx.objectStore('customers').getAll();
      const existing = allCustomers.find(
        (c) =>
          (sale.customerId && c.id === sale.customerId) ||
          (sale.customerPhone && c.phone === sale.customerPhone) ||
          c.name.toLowerCase() === sale.customerName.toLowerCase()
      );

      if (existing) {
        existing.totalPurchasesCount += 1;
        existing.totalSpentPKR += sale.totalPKR;
        existing.syncStatus = 'synced';
        await tx.objectStore('customers').put(existing);
        customerToFirestore = existing;
      } else {
        const newCust: CustomerItem = {
          id: sale.customerId || `cust_${Date.now()}`,
          name: sale.customerName,
          phone: sale.customerPhone || '',
          cnic: sale.customerCnic || '',
          address: sale.customerAddress || '',
          totalPurchasesCount: 1,
          totalSpentPKR: sale.totalPKR,
          createdAt: new Date().toISOString(),
          syncStatus: 'synced',
        };
        await tx.objectStore('customers').put(newCust);
        customerToFirestore = newCust;
      }
    }

    await tx.done;
    console.log(`[POS DB] Local IndexedDB transaction for sale ${sale.id} committed successfully.`);
  } catch (idbErr) {
    console.error(`[POS DB] Error during local IndexedDB transaction for sale ${sale.id}:`, idbErr);
    await db.put('sales', saleToSave);
  }

  // 4. Sync inventory updates & customer changes to Firestore outside the IndexedDB transaction
  if (firestore) {
    for (const bike of bikesToFirestore) {
      try {
        console.log(`[POS DB] Syncing stock update for bike ${bike.id} (${bike.make} ${bike.model}) to Firestore...`);
        await setDoc(doc(firestore, 'inventory', bike.id), sanitizeForFirestore(bike), { merge: true });
        console.log(`[POS DB] Bike stock ${bike.id} synced to Firestore.`);
      } catch (e) {
        console.warn(`[POS DB] Firestore stock update warning for bike ${bike.id}:`, e);
        bike.syncStatus = 'pending';
        await db.put('inventory', bike);
      }
    }

    if (customerToFirestore) {
      try {
        console.log(`[POS DB] Syncing customer ${customerToFirestore.id} (${customerToFirestore.name}) to Firestore...`);
        await setDoc(doc(firestore, 'customers', customerToFirestore.id), sanitizeForFirestore(customerToFirestore), { merge: true });
        console.log(`[POS DB] Customer ${customerToFirestore.id} synced to Firestore.`);
      } catch (e) {
        console.warn(`[POS DB] Firestore customer update warning for customer ${customerToFirestore.id}:`, e);
        customerToFirestore.syncStatus = 'pending';
        await db.put('customers', customerToFirestore);
      }
    }
  }
}

// ================= CUSTOMERS CRUD =================
export async function getAllCustomers(): Promise<CustomerItem[]> {
  const db = await getLocalDB();
  return db.getAll('customers');
}

export async function saveCustomer(customer: CustomerItem): Promise<void> {
  const db = await getLocalDB();
  const firestore = getFirestoreDb();

  const custToSave: CustomerItem = { ...customer, syncStatus: 'synced' };

  if (firestore) {
    try {
      console.log(`[POS DB] Syncing Customer ${customer.id} (${customer.name}) to Firestore...`);
      await setDoc(doc(firestore, 'customers', customer.id), sanitizeForFirestore(custToSave), { merge: true });
      console.log(`[POS DB] Customer ${customer.id} saved to Firestore successfully.`);
    } catch (e) {
      console.warn(`[POS DB] Firestore customer save warning for ${customer.id}:`, e);
      custToSave.syncStatus = 'pending';
    }
  } else {
    custToSave.syncStatus = 'pending';
  }

  await db.put('customers', custToSave);
}

export async function deleteCustomer(id: string): Promise<void> {
  const db = await getLocalDB();
  const firestore = getFirestoreDb();

  console.log(`[POS DB] Deleting Customer ${id} locally...`);
  await db.delete('customers', id);

  if (firestore) {
    try {
      console.log(`[POS DB] Deleting Customer ${id} from Firestore...`);
      await deleteDoc(doc(firestore, 'customers', id));
      console.log(`[POS DB] Customer ${id} deleted from Firestore successfully.`);
    } catch (e) {
      console.warn(`[POS DB] Error deleting customer ${id} from Firestore:`, e);
    }
  }
}

// ================= EXPENSES CRUD =================
export async function getAllExpenses(): Promise<ExpenseRecord[]> {
  const db = await getLocalDB();
  const expenses = await db.getAll('expenses');
  return expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function saveExpense(expense: ExpenseRecord): Promise<void> {
  const db = await getLocalDB();
  const firestore = getFirestoreDb();

  const expToSave: ExpenseRecord = { ...expense, syncStatus: 'synced' };

  if (firestore) {
    try {
      console.log(`[POS DB] Syncing Expense ${expense.id} (PKR ${expense.amountPKR}) to Firestore...`);
      await setDoc(doc(firestore, 'expenses', expense.id), sanitizeForFirestore(expToSave), { merge: true });
      console.log(`[POS DB] Expense ${expense.id} saved to Firestore successfully.`);
    } catch (e) {
      console.warn(`[POS DB] Firestore expense save warning for ${expense.id}:`, e);
      expToSave.syncStatus = 'pending';
    }
  } else {
    expToSave.syncStatus = 'pending';
  }

  await db.put('expenses', expToSave);
}

export async function deleteExpense(id: string): Promise<void> {
  const db = await getLocalDB();
  const firestore = getFirestoreDb();

  console.log(`[POS DB] Deleting Expense ${id} locally...`);
  await db.delete('expenses', id);

  if (firestore) {
    try {
      console.log(`[POS DB] Deleting Expense ${id} from Firestore...`);
      await deleteDoc(doc(firestore, 'expenses', id));
      console.log(`[POS DB] Expense ${id} deleted from Firestore successfully.`);
    } catch (e) {
      console.warn(`[POS DB] Error deleting expense ${id} from Firestore:`, e);
    }
  }
}

// ================= SETTINGS =================
export async function getShowroomSettings(): Promise<ShowroomSettings> {
  const db = await getLocalDB();
  const settings = await db.get('settings', 'showroom_main_settings');
  return settings || INITIAL_SHOWROOM_SETTINGS;
}

export async function saveShowroomSettings(settings: ShowroomSettings): Promise<void> {
  const db = await getLocalDB();
  const firestore = getFirestoreDb();

  console.log(`[POS DB] Saving Showroom Settings locally...`);
  await db.put('settings', settings);

  if (firestore) {
    try {
      console.log(`[POS DB] Syncing Showroom Settings to Firestore...`);
      await setDoc(doc(firestore, 'settings', 'showroom_main_settings'), sanitizeForFirestore(settings), { merge: true });
      console.log(`[POS DB] Showroom Settings saved to Firestore successfully.`);
    } catch (e) {
      console.warn(`[POS DB] Error saving settings to Firestore:`, e);
    }
  }
}

// ================= PENDING SYNC COUNTS =================
export async function getPendingSyncCounts(): Promise<PendingSyncCounts> {
  const db = await getLocalDB();

  const invList = await db.getAll('inventory');
  const salesList = await db.getAll('sales');
  const custsList = await db.getAll('customers');
  const expList = await db.getAll('expenses');

  const pendingInv = invList.filter((i) => i.syncStatus === 'pending').length;
  const pendingSales = salesList.filter((s) => s.syncStatus === 'pending').length;
  const pendingCusts = custsList.filter((c) => c.syncStatus === 'pending').length;
  const pendingExp = expList.filter((e) => e.syncStatus === 'pending').length;

  return {
    inventory: pendingInv,
    sales: pendingSales,
    customers: pendingCusts,
    expenses: pendingExp,
    total: pendingInv + pendingSales + pendingCusts + pendingExp,
  };
}

// Reset Local & Firestore Data
export async function clearAllLocalData(): Promise<void> {
  const db = await getLocalDB();
  await db.clear('inventory');
  await db.clear('sales');
  await db.clear('customers');
  await db.clear('expenses');
  await db.clear('settings');
  await db.put('settings', INITIAL_SHOWROOM_SETTINGS);
}

/**
 * Explicit cache-clearing utility that purges all IndexedDB records,
 * local storage sales references, and cached session metadata on logout or manual cache purge.
 */
export async function purgeAllLocalCachedData(): Promise<{ success: boolean; message: string }> {
  try {
    const db = await getLocalDB();
    await db.clear('inventory');
    await db.clear('sales');
    await db.clear('customers');
    await db.clear('expenses');
    await db.clear('settings');
    await db.put('settings', INITIAL_SHOWROOM_SETTINGS);

    if (typeof window !== 'undefined') {
      // Clear any temporary sales, pos, or offline cache in localStorage/sessionStorage
      const keysToClear = [
        'bike_showroom_auth_session',
        'pos_cached_cart',
        'pos_last_invoice',
        'sales_history_cache',
        'inventory_cache',
      ];
      keysToClear.forEach((key) => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });
    }

    console.log('[Cache Purge] Explicitly purged all local IndexedDB and storage cache.');
    return { success: true, message: 'Local cache and IndexedDB records purged successfully.' };
  } catch (err: any) {
    console.error('[Cache Purge Error]:', err);
    return { success: false, message: err?.message || 'Failed to purge local cache.' };
  }
}

/**
 * Completely purges all data from local IndexedDB and Firestore collections for production deployment.
 */
export async function clearCompleteDatabase(wipeFirestore: boolean = true): Promise<{
  success: boolean;
  message: string;
  clearedCounts: { inventory: number; sales: number; customers: number; expenses: number };
}> {
  const db = await getLocalDB();
  const counts = {
    inventory: await db.count('inventory'),
    sales: await db.count('sales'),
    customers: await db.count('customers'),
    expenses: await db.count('expenses'),
  };

  // 1. Clear all IndexedDB stores
  await db.clear('inventory');
  await db.clear('sales');
  await db.clear('customers');
  await db.clear('expenses');
  await db.put('settings', INITIAL_SHOWROOM_SETTINGS);

  // 2. Wipe Firestore documents if enabled
  if (wipeFirestore) {
    const firestore = getFirestoreDb();
    if (firestore) {
      const collections = ['inventory', 'sales', 'customers', 'expenses'];
      for (const colName of collections) {
        try {
          const snap = await getDocs(collection(firestore, colName));
          const deletePromises = snap.docs.map((d) => deleteDoc(doc(firestore, colName, d.id)));
          await Promise.all(deletePromises);
          console.log(`[POS DB] Cleared ${snap.size} documents from Firestore collection: ${colName}`);
        } catch (err) {
          console.warn(`Error wiping Firestore collection ${colName}:`, err);
        }
      }
    }
  }

  return {
    success: true,
    message: 'All test and demo data has been purged from Local DB and Firestore.',
    clearedCounts: counts,
  };
}

