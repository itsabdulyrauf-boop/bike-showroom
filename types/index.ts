export type SyncStatus = 'synced' | 'pending';

export type BikeStatus = 'Available' | 'Sold' | 'Reserved';

export type InventoryItemType = 'New Bike' | 'Used Bike' | 'Rickshaw Body' | 'Auto Rickshaw' | 'Other';

export interface InventoryItem {
  id: string;
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
  notes?: string;
  createdAt: string;
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
  inventory: InventoryItem[];
  sales: SaleRecord[];
  customers: CustomerItem[];
  expenses: ExpenseRecord[];
  authCredentials?: AuthCredentials;
}

