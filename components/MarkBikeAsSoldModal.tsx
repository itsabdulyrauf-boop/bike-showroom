'use client';

import React, { useState, useEffect } from 'react';
import {
  InventoryItem,
  CustomerItem,
  SaleRecord,
  SaleItem,
  PaymentMethod,
  RegistrationStatus,
} from '@/types';
import { formatPKR } from '@/lib/currency';
import { getAllCustomers, saveSaleRecord, saveInventoryItem } from '@/lib/db';
import { performManualCloudSync } from '@/lib/syncEngine';
import {
  Receipt,
  X,
  Bike,
  DollarSign,
  User,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  Shield,
  Layers,
  Search,
  UserPlus,
  CreditCard,
} from 'lucide-react';

interface MarkBikeAsSoldModalProps {
  isOpen: boolean;
  bike: InventoryItem | null;
  onClose: () => void;
  onSoldComplete: (newSale: SaleRecord) => void;
}

function generateInvoiceNumber() {
  return `INV-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
}

function generateSaleId() {
  return `sale_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

export const MarkBikeAsSoldModal: React.FC<MarkBikeAsSoldModalProps> = ({
  isOpen,
  bike,
  onClose,
  onSoldComplete,
}) => {
  if (!isOpen || !bike) return null;

  return (
    <MarkBikeAsSoldForm
      key={bike.id}
      bike={bike}
      onClose={onClose}
      onSoldComplete={onSoldComplete}
    />
  );
};

interface MarkBikeAsSoldFormProps {
  bike: InventoryItem;
  onClose: () => void;
  onSoldComplete: (newSale: SaleRecord) => void;
}

const MarkBikeAsSoldForm: React.FC<MarkBikeAsSoldFormProps> = ({
  bike,
  onClose,
  onSoldComplete,
}) => {
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState<boolean>(true);

  // Pricing & Payment
  const initialPrice = bike.sellingPricePKR > 0 ? bike.sellingPricePKR : 0;
  const [sellingPricePKR, setSellingPricePKR] = useState<number>(initialPrice);
  const [discountPKR, setDiscountPKR] = useState<number>(0);
  const netTotalPKR = Math.max(0, sellingPricePKR - discountPKR);
  const [paidAmountPKR, setPaidAmountPKR] = useState<number>(netTotalPKR);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [accountNumber, setAccountNumber] = useState<string>('');

  // Customer Mode: 'walkin' | 'select' | 'new'
  const [customerMode, setCustomerMode] = useState<'walkin' | 'select' | 'new'>('walkin');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    cnic: '',
    address: '',
  });

  // Registration & Warranty
  const [registrationStatus, setRegistrationStatus] =
    useState<RegistrationStatus>('Showroom Registration');
  const [warrantyMonths, setWarrantyMonths] = useState<number>(12);
  const [letterIssued, setLetterIssued] = useState<'Yes' | 'No'>('No');
  const [issuanceDate, setIssuanceDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [saleNotes, setSaleNotes] = useState<string>('');

  // Status & Submission
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Load existing customers
  useEffect(() => {
    let isMounted = true;
    getAllCustomers()
      .then((data) => {
        if (isMounted) {
          setCustomers(data);
          setLoadingCustomers(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load customers for mark sold:', err);
        if (isMounted) setLoadingCustomers(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handlePriceChange = (val: number) => {
    const p = Math.max(0, isNaN(val) ? 0 : val);
    setSellingPricePKR(p);
    setPaidAmountPKR(Math.max(0, p - discountPKR));
  };

  const handleDiscountChange = (val: number) => {
    const d = Math.max(0, isNaN(val) ? 0 : val);
    setDiscountPKR(d);
    setPaidAmountPKR(Math.max(0, sellingPricePKR - d));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (sellingPricePKR <= 0) {
      setFormError('Please enter a valid selling rate (PKR).');
      return;
    }

    let custName = 'Walk-in Customer';
    let custPhone = '';
    let custCnic = '';
    let custAddress = '';
    let customerId: string | undefined = undefined;

    if (customerMode === 'walkin') {
      custName = newCustomer.name.trim() || 'Walk-in Cash Customer';
      custPhone = newCustomer.phone.trim();
      custCnic = newCustomer.cnic.trim();
      custAddress = newCustomer.address.trim();
    } else if (customerMode === 'select') {
      const match = customers.find((c) => c.id === selectedCustomerId);
      if (!match) {
        setFormError('Please select a customer from the list.');
        return;
      }
      customerId = match.id;
      custName = match.name;
      custPhone = match.phone;
      custCnic = match.cnic;
      custAddress = match.address;
    } else {
      if (!newCustomer.name.trim()) {
        setFormError('Customer full name is required.');
        return;
      }
      custName = newCustomer.name.trim();
      custPhone = newCustomer.phone.trim();
      custCnic = newCustomer.cnic.trim();
      custAddress = newCustomer.address.trim();
    }

    setIsSubmitting(true);

    try {
      const actualPaid = paidAmountPKR >= netTotalPKR ? netTotalPKR : Math.max(0, paidAmountPKR);
      const paymentStatus =
        actualPaid >= netTotalPKR
          ? 'Paid'
          : actualPaid > 0
          ? 'Partial'
          : 'Unpaid';

      const invoiceNumber = generateInvoiceNumber();

      const saleItem: SaleItem = {
        bikeId: bike.id,
        stockId: bike.stockId,
        stockBatchNumber: bike.stockBatchNumber,
        stockName: bike.stockName,
        purchasePricePKR: bike.purchasePricePKR,
        itemType: bike.itemType,
        make: bike.make,
        model: bike.model,
        variant: bike.variant,
        chassisNumber: bike.chassisNumber,
        engineNumber: bike.engineNumber || '',
        color: bike.color,
        year: bike.year,
        pricePKR: sellingPricePKR,
        quantity: 1,
      };

      const newSale: SaleRecord = {
        id: generateSaleId(),
        invoiceNumber,
        customerId,
        customerName: custName,
        customerPhone: custPhone,
        customerCnic: custCnic,
        customerAddress: custAddress,
        items: [saleItem],
        subtotalPKR: sellingPricePKR,
        discountPKR,
        taxPKR: 0,
        totalPKR: netTotalPKR,
        paidAmountPKR: actualPaid,
        balancePKR: Math.max(0, netTotalPKR - actualPaid),
        paymentMethod,
        paymentStatus,
        accountNumber: accountNumber.trim() || undefined,
        warrantyMonths,
        registrationStatus,
        letterIssued,
        issuanceDate: letterIssued === 'Yes' ? issuanceDate : undefined,
        notes: saleNotes.trim() || `Marked as Sold from Inventory on ${new Date().toLocaleDateString('en-PK')}`,
        createdAt: new Date().toISOString(),
        syncStatus: 'pending',
      };

      // 1. Explicitly mark inventory item as Sold and stockCount to 0
      const updatedBike: InventoryItem = {
        ...bike,
        status: 'Sold',
        stockCount: 0,
        sellingPricePKR,
        updatedAt: new Date().toISOString(),
        syncStatus: 'pending',
      };
      await saveInventoryItem(updatedBike);

      // 2. Save the sale record (Invoice) to IndexedDB & Firestore
      await saveSaleRecord(newSale);

      // 3. Trigger cloud sync in background
      performManualCloudSync().catch((err) => {
        console.warn('Background sync after mark sold:', err);
      });

      // 4. Callback to parent to update state & move directly to Invoice section
      onSoldComplete(newSale);
    } catch (err: any) {
      console.error('Error marking bike as sold:', err);
      setFormError(err?.message || 'Failed to complete transaction. Please try again.');
      setIsSubmitting(false);
    }
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.phone.includes(customerSearch) ||
      c.cnic.includes(customerSearch)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 px-6 py-4 border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-900/60 text-emerald-400 border border-emerald-700/60 rounded-xl shadow-inner">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base font-mono">
                Mark as Sold & Move to Invoice
              </h3>
              <p className="text-xs text-emerald-300/80">
                Generates official sales invoice and moves vehicle to the Invoices & Sales section
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto text-xs">
          {formError && (
            <div className="bg-rose-950 text-rose-200 border border-rose-800 p-3 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{formError}</span>
            </div>
          )}

          {/* Vehicle Details Card */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <div className="flex items-center gap-2">
                <Bike className="w-4 h-4 text-indigo-400" />
                <span className="font-bold text-white text-sm">
                  {bike.make} {bike.model} {bike.variant && `(${bike.variant})`}
                </span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">
                {bike.itemType || 'New Bike'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-1">
              <div>
                <span className="text-slate-500 block">Chassis / Frame:</span>
                <span className="font-mono font-bold text-indigo-300">{bike.chassisNumber}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Engine / Motor:</span>
                <span className="font-mono font-bold text-slate-200">
                  {bike.engineNumber && bike.engineNumber !== 'N/A' ? bike.engineNumber : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Color / Year:</span>
                <span className="font-medium text-slate-300">
                  {bike.color || 'Standard'} • {bike.year}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Stock Lot:</span>
                <span className="font-medium text-slate-300 truncate block">
                  {bike.stockName || bike.stockBatchNumber || 'General Stock'}
                </span>
              </div>
            </div>
          </div>

          {/* Pricing & Payment Section */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-slate-300 uppercase text-[11px] flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                Sale Pricing & Payment
              </span>
              <span className="text-[11px] font-mono text-emerald-400 font-bold">
                Net: {formatPKR(netTotalPKR)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Selling Rate (PKR) *</label>
                <input
                  type="number"
                  value={sellingPricePKR || ''}
                  onChange={(e) => handlePriceChange(Number(e.target.value))}
                  placeholder="0"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-emerald-400 font-mono font-bold text-sm focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Discount (PKR)</label>
                <input
                  type="number"
                  value={discountPKR || ''}
                  onChange={(e) => handleDiscountChange(Number(e.target.value))}
                  placeholder="0"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-amber-300 font-mono font-bold text-sm focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Amount Paid / Received (PKR) *</label>
                <input
                  type="number"
                  value={paidAmountPKR || ''}
                  onChange={(e) => setPaidAmountPKR(Number(e.target.value))}
                  placeholder="0"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-blue-400 font-mono font-bold text-sm focus:border-indigo-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-slate-400 mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium"
                >
                  <option value="Cash">Cash (Standard)</option>
                  <option value="Bank Transfer">Bank Transfer / Online</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Pay Order">Pay Order / Demand Draft</option>
                  <option value="Installment">Installment / Lease</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Account No / Reference (Optional)</label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="e.g. ACC-40291 or Bank Ref"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>
            </div>

            {netTotalPKR - paidAmountPKR > 0 && (
              <div className="text-[11px] font-mono text-rose-400 bg-rose-950/40 p-2 rounded-lg border border-rose-900/60 flex items-center justify-between">
                <span>Remaining Due Balance:</span>
                <span className="font-bold">{formatPKR(netTotalPKR - paidAmountPKR)}</span>
              </div>
            )}
          </div>

          {/* Customer Details Section */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-slate-300 uppercase text-[11px] flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-indigo-400" />
                Customer Information
              </span>

              {/* Mode Toggle Buttons */}
              <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[10px]">
                <button
                  type="button"
                  onClick={() => setCustomerMode('walkin')}
                  className={`px-2 py-1 rounded-md transition-all ${
                    customerMode === 'walkin'
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Quick Walk-in
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerMode('select')}
                  className={`px-2 py-1 rounded-md transition-all ${
                    customerMode === 'select'
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Existing ({customers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerMode('new')}
                  className={`px-2 py-1 rounded-md transition-all ${
                    customerMode === 'new'
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  New Profile
                </button>
              </div>
            </div>

            {customerMode === 'walkin' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-slate-400 mb-1">Customer Name (Optional)</label>
                  <input
                    type="text"
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                    placeholder="Walk-in Customer (or enter name)"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Phone Number (Optional)</label>
                  <input
                    type="text"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    placeholder="03XX-XXXXXXX"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>
            )}

            {customerMode === 'select' && (
              <div className="space-y-2 pt-1">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Search existing customer by name, phone or CNIC..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-white"
                  />
                </div>

                <div className="max-h-32 overflow-y-auto divide-y divide-slate-800 border border-slate-800 rounded-xl bg-slate-900">
                  {filteredCustomers.length > 0 ? (
                    filteredCustomers.map((cust) => (
                      <button
                        type="button"
                        key={cust.id}
                        onClick={() => setSelectedCustomerId(cust.id)}
                        className={`w-full text-left p-2.5 flex items-center justify-between text-xs transition-colors cursor-pointer ${
                          selectedCustomerId === cust.id
                            ? 'bg-indigo-600/30 text-white font-bold border-l-4 border-indigo-500'
                            : 'hover:bg-slate-800 text-slate-300'
                        }`}
                      >
                        <div>
                          <span className="block font-medium">{cust.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {cust.phone || 'No Phone'} {cust.cnic ? `• ${cust.cnic}` : ''}
                          </span>
                        </div>
                        {selectedCustomerId === cust.id && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="p-3 text-center text-slate-500 text-xs">
                      No matching customers found.
                    </div>
                  )}
                </div>
              </div>
            )}

            {customerMode === 'new' && (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Customer Full Name *</label>
                    <input
                      type="text"
                      value={newCustomer.name}
                      onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                      placeholder="e.g. Muhammad Usman"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                      required={customerMode === 'new'}
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={newCustomer.phone}
                      onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                      placeholder="0300-1234567"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">CNIC / ID Number</label>
                    <input
                      type="text"
                      value={newCustomer.cnic}
                      onChange={(e) => setNewCustomer({ ...newCustomer, cnic: e.target.value })}
                      placeholder="42101-XXXXXXX-X"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Residential / Business Address</label>
                    <input
                      type="text"
                      value={newCustomer.address}
                      onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                      placeholder="House / Street, City"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Registration & Additional Options */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">Registration Status</label>
              <select
                value={registrationStatus}
                onChange={(e) => setRegistrationStatus(e.target.value as RegistrationStatus)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium"
              >
                <option value="Showroom Registration">Showroom Registration</option>
                <option value="Self-Registration">Self-Registration (Customer)</option>
                <option value="Registered">Registered / Number Issued</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Warranty Period</label>
              <select
                value={warrantyMonths}
                onChange={(e) => setWarrantyMonths(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium font-mono"
              >
                <option value={0}>No Warranty</option>
                <option value={6}>6 Months</option>
                <option value={12}>12 Months (1 Year)</option>
                <option value={24}>24 Months (2 Years)</option>
                <option value={36}>36 Months (3 Years)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Registration Letter Issued</label>
              <select
                value={letterIssued}
                onChange={(e) => setLetterIssued(e.target.value as 'Yes' | 'No')}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium"
              >
                <option value="No">No (Pending Letter)</option>
                <option value="Yes">Yes (Letter Issued)</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white rounded-xl font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-900/30 transition-all cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing Sale...</span>
                </>
              ) : (
                <>
                  <Receipt className="w-4 h-4" />
                  <span>Confirm Sale & Move to Invoice</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
