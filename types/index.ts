export type SyncStatus = 'synced' | 'pending';

export type BikeStatus = 'Available' | 'Sold' | 'Reserved';

export type StockStatus = 'Active' | 'Completed' | 'Archived';

export interface BrandItem {
  id: string;
  name: string; // e.g., "Honda", "Yamaha", "Crown"
  country?: string; // Origin / Country / Region (e.g. "Japan", "Pakistan", "China")
  description?: string; // Notes / Brand info
  status: 'Active' | 'Inactive';
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
}

export interface StockEntry {
  id: string;
  batchNumber: string; // Stock Serial / Batch Number (e.g., STK-2026-001)
  stockName: string; // Stock Name or Reference
  stockDate: string; // YYYY-MM-DD
  status: StockStatus;
  totalQuantity: number; // Unit / Quantity received
  purchaseCostPKR: number; // Total purchase/investment cost
  supplier?: string; // Supplier / Vendor / Factory
  notes?: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
}

export type InventoryItemType = 'New Bike' | 'Used Bike' | 'Rickshaw Body' | 'Auto Rickshaw' | 'Other';

export interface InventoryItem {
  id: string;
  stockId?: string; // Reference to StockEntry
  stockBatchNumber?: string; // Serial/batch number for display
  itemType?: InventoryItemType;
  make: string;
  model: string;
  variant: string;
  year: string;
  chassisNumber: string;
  engineNumber: string;
  color: string;
  purchasePricePKR: number;
  sellingPricePKR: number;
  stockCount: number;
  status: BikeStatus;
  notes?: string;
  updatedAt: string;
  syncStatus: SyncStatus;
}

export interface CustomerItem {
  id: string;
  name: string;
  phone: string;
  cnic: string;
  address: string;
  totalPurchasesCount: number;
  totalSpentPKR: number;
  createdAt: string;
  syncStatus: SyncStatus;
}

export interface SaleItem {
  bikeId?: string;
  stockId?: string;
  purchasePricePKR?: number;
  itemType?: InventoryItemType;
  make: string;
  model: string;
  variant: string;
  chassisNumber: string;
  engineNumber: string;
  color: string;
  year: string;
  pricePKR: number;
  quantity: number;
}

export type PaymentMethod = 'Cash' | 'Bank Transfer' | 'Cheque' | 'Pay Order' | 'Installment';
export type PaymentStatus = 'Paid' | 'Partial' | 'Unpaid';
export type RegistrationStatus = 'Self-Registration' | 'Showroom Registration' | 'Registered';

export interface SaleRecord {
  id: string;
  invoiceNumber: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  customerCnic: string;
  customerAddress: string;
  items: SaleItem[];
  subtotalPKR: number;
  discountPKR: number;
  taxPKR: number;
  totalPKR: number;
  paidAmountPKR: number;
  balancePKR: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  accountNumber?: string;
  warrantyMonths: number;
  registrationStatus: RegistrationStatus;
  letterIssued?: 'Yes' | 'No';
  issuanceDate?: string;
  letterNumber?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  syncStatus: SyncStatus;
}

export type ExpenseCategory =
  | 'Rent'
  | 'Utilities & Electricity'
  | 'Staff Salary'
  | 'Showroom Maintenance'
  | 'Hospitality & Tea'
  | 'Transport & Freight'
  | 'Marketing'
  | 'Custom Expense';

export interface ExpenseRecord {
  id: string;
  title: string;
  category: ExpenseCategory;
  amountPKR: number;
  date: string;
  paymentMethod: string;
  notes?: string;
  createdAt: string;
  syncStatus: SyncStatus;
}

export interface ShowroomSettings {
  id: string;
  showroomName: string;
  tagline: string;
  address: string;
  city: string;
  phonePrimary: string;
  phoneSecondary: string;
  ntnNumber: string;
  strnNumber: string;
  invoiceTerms: string;
  autoSyncOnline: boolean;
  updatedAt: string;
}

export interface PendingSyncCounts {
  inventory: number;
  sales: number;
  customers: number;
  expenses: number;
  stocks: number;
  brands: number;
  total: number;
}

export interface AuthCredentials {
  id: string;
  email: string;
  passwordHashOrPlain: string;
  updatedAt: string;
}

export interface DatabaseBackup {
  version: string;
  backupDate: string;
  showroomSettings: ShowroomSettings;
  brands?: BrandItem[];
  stocks?: StockEntry[];
  inventory: InventoryItem[];
  sales: SaleRecord[];
  customers: CustomerItem[];
  expenses: ExpenseRecord[];
  authCredentials?: AuthCredentials;
}

