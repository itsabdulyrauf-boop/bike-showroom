import { InventoryItem, CustomerItem, ExpenseRecord, ShowroomSettings } from '@/types';

export const INITIAL_SHOWROOM_SETTINGS: ShowroomSettings = {
  id: 'showroom_main_settings',
  showroomName: 'Motorcycle Showroom',
  tagline: 'Authorized Motorcycle Showroom & Dealership POS',
  address: 'Main Commercial Market',
  city: 'Karachi, Pakistan',
  phonePrimary: '',
  phoneSecondary: '',
  ntnNumber: '',
  strnNumber: '',
  invoiceTerms: '1. All vehicle purchases are governed by showroom terms.\n2. Warranty covers engine and gearbox as per manufacturer warranty.\n3. Original registration documents are provided upon full clearance.',
  autoSyncOnline: true,
  updatedAt: new Date().toISOString(),
};

export const INITIAL_INVENTORY: InventoryItem[] = [];

export const INITIAL_CUSTOMERS: CustomerItem[] = [];

export const INITIAL_EXPENSES: ExpenseRecord[] = [];

