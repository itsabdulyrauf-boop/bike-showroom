import { doc, setDoc, deleteDoc, getDocs, collection } from 'firebase/firestore';
import { getFirestoreDb, sanitizeForFirestore } from './firebase';
import {
  getLocalDB,
  getAllInventory,
  getAllSales,
  getAllCustomers,
  getAllExpenses,
  getShowroomSettings,
  saveShowroomSettings,
} from './db';
import { getAuthCredentials, saveAuthCredentials } from './authService';
import { DatabaseBackup, InventoryItem, SaleRecord, CustomerItem, ExpenseRecord } from '@/types';

/**
 * Creates a complete JSON backup object of all database collections.
 */
export async function createFullDatabaseBackup(): Promise<DatabaseBackup> {
  const [settings, inventory, sales, customers, expenses, authCreds] = await Promise.all([
    getShowroomSettings(),
    getAllInventory(),
    getAllSales(),
    getAllCustomers(),
    getAllExpenses(),
    getAuthCredentials(),
  ]);

  return {
    version: '1.0',
    backupDate: new Date().toISOString(),
    showroomSettings: settings,
    inventory,
    sales,
    customers,
    expenses,
    authCredentials: authCreds,
  };
}

/**
 * Triggers a browser download of the full JSON backup.
 */
export async function exportDatabaseBackupJSON(): Promise<void> {
  const backupData = await createFullDatabaseBackup();
  const jsonString = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const dateStr = new Date().toISOString().split('T')[0];
  const a = document.createElement('a');
  a.href = url;
  a.download = `BikeShowroom_Backup_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Imports a JSON backup file, writing all items into Firestore and local DB.
 */
export async function restoreDatabaseBackupJSON(
  backupJSON: any,
  overwriteMode: 'merge' | 'overwrite' = 'merge'
): Promise<{
  success: boolean;
  message: string;
  importedCounts: { inventory: number; sales: number; customers: number; expenses: number };
}> {
  const firestore = getFirestoreDb();
  const localDb = await getLocalDB();

  const counts = { inventory: 0, sales: 0, customers: 0, expenses: 0 };

  if (!backupJSON || typeof backupJSON !== 'object') {
    return {
      success: false,
      message: 'Invalid backup format: file does not contain a valid JSON object.',
      importedCounts: counts,
    };
  }

  try {
    // If overwrite mode is selected, purge existing local stores first
    if (overwriteMode === 'overwrite') {
      await localDb.clear('inventory');
      await localDb.clear('sales');
      await localDb.clear('customers');
      await localDb.clear('expenses');

      if (firestore) {
        const collectionsToClear = ['inventory', 'sales', 'customers', 'expenses'];
        for (const col of collectionsToClear) {
          try {
            const snap = await getDocs(collection(firestore, col));
            await Promise.all(snap.docs.map((d) => deleteDoc(doc(firestore, col, d.id))));
          } catch (err) {
            console.warn(`Could not clear remote collection ${col}:`, err);
          }
        }
      }
    }

    // 1. Showroom Settings
    const settingsData = backupJSON.showroomSettings || backupJSON.settings;
    if (settingsData && typeof settingsData === 'object') {
      await saveShowroomSettings({
        ...settingsData,
        id: settingsData.id || 'showroom_primary_config',
        updatedAt: new Date().toISOString(),
      });
    }

    // 2. Auth Credentials
    const authData = backupJSON.authCredentials || backupJSON.auth;
    if (authData && typeof authData === 'object' && authData.email && authData.passwordHashOrPlain) {
      await saveAuthCredentials({
        id: authData.id || 'primary_admin_auth',
        email: String(authData.email),
        passwordHashOrPlain: String(authData.passwordHashOrPlain),
        updatedAt: new Date().toISOString(),
      });
    }

    // 3. Inventory
    const invList = Array.isArray(backupJSON.inventory)
      ? backupJSON.inventory
      : Array.isArray(backupJSON.bikes)
      ? backupJSON.bikes
      : [];

    for (const rawItem of invList) {
      if (rawItem && typeof rawItem === 'object') {
        const id = rawItem.id || `inv_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const cleanItem: InventoryItem = {
          id: String(id),
          make: rawItem.make || 'Honda',
          model: rawItem.model || 'CD 70',
          variant: rawItem.variant || 'Standard',
          year: String(rawItem.year || new Date().getFullYear()),
          chassisNumber: String(rawItem.chassisNumber || ''),
          engineNumber: String(rawItem.engineNumber || ''),
          color: rawItem.color || 'Red',
          purchasePricePKR: Number(rawItem.purchasePricePKR) || 0,
          sellingPricePKR: Number(rawItem.sellingPricePKR) || 0,
          stockCount: Number(rawItem.stockCount) || 1,
          status: (rawItem.status as any) || 'Available',
          notes: rawItem.notes ? String(rawItem.notes) : '',
          updatedAt: rawItem.updatedAt || new Date().toISOString(),
          syncStatus: 'synced',
        };

        await localDb.put('inventory', cleanItem);
        if (firestore) {
          try {
            await setDoc(doc(firestore, 'inventory', cleanItem.id), sanitizeForFirestore(cleanItem), { merge: true });
          } catch (e) {
            console.warn('Firestore setDoc inventory error:', e);
          }
        }
        counts.inventory++;
      }
    }

    // 4. Sales
    const salesList = Array.isArray(backupJSON.sales) ? backupJSON.sales : [];
    for (const rawSale of salesList) {
      if (rawSale && typeof rawSale === 'object') {
        const id = rawSale.id || `sale_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        
        // Handle items array compatibility
        const itemsList = Array.isArray(rawSale.items) && rawSale.items.length > 0
          ? rawSale.items.map((it: any) => ({
              bikeId: it.bikeId ? String(it.bikeId) : undefined,
              make: String(it.make || 'Honda'),
              model: String(it.model || 'CD 70'),
              variant: String(it.variant || 'Standard'),
              chassisNumber: String(it.chassisNumber || ''),
              engineNumber: String(it.engineNumber || ''),
              color: String(it.color || 'Red'),
              year: String(it.year || new Date().getFullYear()),
              pricePKR: Number(it.pricePKR) || 0,
              quantity: Number(it.quantity) || 1,
            }))
          : [
              {
                bikeId: rawSale.inventoryItemId ? String(rawSale.inventoryItemId) : undefined,
                make: String(rawSale.bikeSummary?.make || 'Honda'),
                model: String(rawSale.bikeSummary?.model || 'CD 70'),
                variant: String(rawSale.bikeSummary?.variant || 'Standard'),
                chassisNumber: String(rawSale.bikeSummary?.chassisNumber || ''),
                engineNumber: String(rawSale.bikeSummary?.engineNumber || ''),
                color: String(rawSale.bikeSummary?.color || 'Red'),
                year: String(rawSale.bikeSummary?.year || new Date().getFullYear()),
                pricePKR: Number(rawSale.totalPKR) || 0,
                quantity: 1,
              },
            ];

        const totalPKR = Number(rawSale.totalPKR) || 0;
        const paidAmountPKR = Number(rawSale.paidAmountPKR) || totalPKR;
        const subtotalPKR = Number(rawSale.subtotalPKR) || totalPKR;
        const discountPKR = Number(rawSale.discountPKR) || 0;
        const taxPKR = Number(rawSale.taxPKR) || 0;
        const balancePKR = Number(rawSale.balancePKR) || Math.max(0, totalPKR - paidAmountPKR);

        const cleanSale: SaleRecord = {
          id: String(id),
          invoiceNumber: rawSale.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`,
          customerId: rawSale.customerId ? String(rawSale.customerId) : undefined,
          customerName: String(rawSale.customerName || 'Walk-in Customer'),
          customerPhone: String(rawSale.customerPhone || ''),
          customerCnic: String(rawSale.customerCnic || rawSale.customerCNIC || ''),
          customerAddress: String(rawSale.customerAddress || ''),
          items: itemsList,
          subtotalPKR,
          discountPKR,
          taxPKR,
          totalPKR,
          paidAmountPKR,
          balancePKR,
          paymentMethod: (rawSale.paymentMethod as any) || 'Cash',
          paymentStatus: (rawSale.paymentStatus as any) || (balancePKR <= 0 ? 'Paid' : 'Partial'),
          warrantyMonths: Number(rawSale.warrantyMonths) || 12,
          registrationStatus: (rawSale.registrationStatus as any) || 'Self-Registration',
          notes: rawSale.notes ? String(rawSale.notes) : '',
          createdAt: rawSale.createdAt || new Date().toISOString(),
          syncStatus: 'synced',
        };

        await localDb.put('sales', cleanSale);
        if (firestore) {
          try {
            await setDoc(doc(firestore, 'sales', cleanSale.id), sanitizeForFirestore(cleanSale), { merge: true });
          } catch (e) {
            console.warn('Firestore setDoc sales error:', e);
          }
        }
        counts.sales++;
      }
    }

    // 5. Customers
    const customersList = Array.isArray(backupJSON.customers) ? backupJSON.customers : [];
    for (const rawCust of customersList) {
      if (rawCust && typeof rawCust === 'object') {
        const id = rawCust.id || `cust_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const cleanCust: CustomerItem = {
          id: String(id),
          name: String(rawCust.name || 'Customer'),
          phone: String(rawCust.phone || ''),
          cnic: rawCust.cnic ? String(rawCust.cnic) : '',
          address: rawCust.address ? String(rawCust.address) : '',
          totalPurchasesCount: Number(rawCust.totalPurchasesCount) || 0,
          totalSpentPKR: Number(rawCust.totalSpentPKR) || 0,
          createdAt: rawCust.createdAt || new Date().toISOString(),
          syncStatus: 'synced',
        };

        await localDb.put('customers', cleanCust);
        if (firestore) {
          try {
            await setDoc(doc(firestore, 'customers', cleanCust.id), sanitizeForFirestore(cleanCust), { merge: true });
          } catch (e) {
            console.warn('Firestore setDoc customer error:', e);
          }
        }
        counts.customers++;
      }
    }

    // 6. Expenses
    const expensesList = Array.isArray(backupJSON.expenses) ? backupJSON.expenses : [];
    for (const rawExp of expensesList) {
      if (rawExp && typeof rawExp === 'object') {
        const id = rawExp.id || `exp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const cleanExp: ExpenseRecord = {
          id: String(id),
          title: String(rawExp.title || 'Expense'),
          category: rawExp.category || 'Custom Expense',
          amountPKR: Number(rawExp.amountPKR) || 0,
          date: rawExp.date || new Date().toISOString().split('T')[0],
          paymentMethod: String(rawExp.paymentMethod || 'Cash'),
          notes: rawExp.notes ? String(rawExp.notes) : '',
          createdAt: rawExp.createdAt || new Date().toISOString(),
          syncStatus: 'synced',
        };

        await localDb.put('expenses', cleanExp);
        if (firestore) {
          try {
            await setDoc(doc(firestore, 'expenses', cleanExp.id), sanitizeForFirestore(cleanExp), { merge: true });
          } catch (e) {
            console.warn('Firestore setDoc expenses error:', e);
          }
        }
        counts.expenses++;
      }
    }

    return {
      success: true,
      message: `Database successfully restored! Imported ${counts.inventory} bikes, ${counts.sales} sales, ${counts.customers} customers, and ${counts.expenses} expenses.`,
      importedCounts: counts,
    };
  } catch (err: any) {
    console.error('Failed to import database backup:', err);
    return {
      success: false,
      message: `Failed to restore database: ${err.message || 'Unknown error'}`,
      importedCounts: counts,
    };
  }
}

/**
 * CSV Export Helpers for individual collections.
 */
export function downloadCSV(content: string, fileName: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportInventoryCSV(): Promise<void> {
  const items = await getAllInventory();
  let csv = 'ID,Make,Model,Variant,Year,ChassisNumber,EngineNumber,Color,PurchasePricePKR,SellingPricePKR,StockCount,Status,Notes\n';
  for (const item of items) {
    csv += `"${item.id}","${item.make}","${item.model}","${item.variant}","${item.year}","${item.chassisNumber}","${item.engineNumber}","${item.color}",${item.purchasePricePKR},${item.sellingPricePKR},${item.stockCount},"${item.status}","${(item.notes || '').replace(/"/g, '""')}"\n`;
  }
  downloadCSV(csv, `Inventory_${new Date().toISOString().split('T')[0]}.csv`);
}

export async function exportCustomersCSV(): Promise<void> {
  const customers = await getAllCustomers();
  let csv = 'ID,Name,Phone,CNIC,Address,TotalPurchases,TotalSpentPKR,CreatedAt\n';
  for (const c of customers) {
    csv += `"${c.id}","${c.name}","${c.phone}","${c.cnic}","${(c.address || '').replace(/"/g, '""')}",${c.totalPurchasesCount},${c.totalSpentPKR},"${c.createdAt}"\n`;
  }
  downloadCSV(csv, `Customers_${new Date().toISOString().split('T')[0]}.csv`);
}

export async function exportSalesCSV(): Promise<void> {
  const sales = await getAllSales();
  let csv = 'InvoiceNumber,CustomerName,CustomerPhone,TotalPKR,PaidAmountPKR,PaymentMethod,PaymentStatus,CreatedAt\n';
  for (const s of sales) {
    csv += `"${s.invoiceNumber}","${s.customerName}","${s.customerPhone}",${s.totalPKR},${s.paidAmountPKR},"${s.paymentMethod}","${s.paymentStatus}","${s.createdAt}"\n`;
  }
  downloadCSV(csv, `SalesHistory_${new Date().toISOString().split('T')[0]}.csv`);
}

export async function exportExpensesCSV(): Promise<void> {
  const expenses = await getAllExpenses();
  let csv = 'ID,Title,Category,AmountPKR,Date,PaymentMethod\n';
  for (const e of expenses) {
    csv += `"${e.id}","${e.title}","${e.category}",${e.amountPKR},"${e.date}","${e.paymentMethod}"\n`;
  }
  downloadCSV(csv, `Expenses_${new Date().toISOString().split('T')[0]}.csv`);
}
