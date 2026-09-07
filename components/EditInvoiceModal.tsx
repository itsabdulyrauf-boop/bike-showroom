'use client';

import React, { useState, useEffect } from 'react';
import {
  SaleRecord,
  SaleItem,
  PaymentMethod,
  PaymentStatus,
  RegistrationStatus,
} from '@/types';
import { formatPKR } from '@/lib/currency';
import { saveSaleRecord, saveInventoryItem, getAllInventory } from '@/lib/db';
import {
  X,
  Pencil,
  CheckCircle2,
  DollarSign,
  User,
  Bike,
  CreditCard,
  FileText,
  AlertCircle,
  Save,
  Loader2,
} from 'lucide-react';

interface EditInvoiceModalProps {
  sale: SaleRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: (updatedSale: SaleRecord) => void;
}

export const EditInvoiceModal: React.FC<EditInvoiceModalProps> = ({
  sale,
  isOpen,
  onClose,
  onSaveSuccess,
}) => {
  if (!isOpen || !sale) return null;

  return (
    <EditInvoiceForm
      key={sale.id}
      sale={sale}
      onClose={onClose}
      onSaveSuccess={onSaveSuccess}
    />
  );
};

interface EditInvoiceFormProps {
  sale: SaleRecord;
  onClose: () => void;
  onSaveSuccess: (updatedSale: SaleRecord) => void;
}

const EditInvoiceForm: React.FC<EditInvoiceFormProps> = ({
  sale,
  onClose,
  onSaveSuccess,
}) => {
  const [customerName, setCustomerName] = useState<string>(sale.customerName || '');
  const [customerPhone, setCustomerPhone] = useState<string>(sale.customerPhone || '');
  const [customerCnic, setCustomerCnic] = useState<string>(sale.customerCnic || '');
  const [customerAddress, setCustomerAddress] = useState<string>(sale.customerAddress || '');
  const [accountNumber, setAccountNumber] = useState<string>(sale.accountNumber || '');

  const [items, setItems] = useState<SaleItem[]>(() =>
    sale.items ? JSON.parse(JSON.stringify(sale.items)) : []
  );
  const [discountPKR, setDiscountPKR] = useState<number>(sale.discountPKR || 0);
  const [taxPKR, setTaxPKR] = useState<number>(sale.taxPKR || 0);
  const [paidAmountPKR, setPaidAmountPKR] = useState<number>(sale.paidAmountPKR || 0);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(sale.paymentMethod || 'Cash');
  const [registrationStatus, setRegistrationStatus] = useState<RegistrationStatus>(
    sale.registrationStatus || 'Showroom Registration'
  );
  const [warrantyMonths, setWarrantyMonths] = useState<number>(sale.warrantyMonths ?? 12);
  const [notes, setNotes] = useState<string>(sale.notes || '');
  const [syncWithInventory, setSyncWithInventory] = useState<boolean>(true);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleUpdateItemField = (
    index: number,
    field: keyof SaleItem,
    value: any
  ) => {
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };
    setItems(updated);
    setErrorMessage(null);
  };

  // Recalculations
  const subtotalPKR = items.reduce(
    (acc, it) => acc + (Number(it.pricePKR) || 0) * (it.quantity || 1),
    0
  );
  const grandTotalPKR = Math.max(0, subtotalPKR - discountPKR + taxPKR);
  const remainingBalancePKR = Math.max(0, grandTotalPKR - paidAmountPKR);

  const calculatedPaymentStatus: PaymentStatus =
    paidAmountPKR >= grandTotalPKR
      ? 'Paid'
      : paidAmountPKR > 0
      ? 'Partial'
      : 'Unpaid';

  const handleSetFullyPaid = () => {
    setPaidAmountPKR(grandTotalPKR);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setErrorMessage('Customer Name cannot be empty.');
      return;
    }

    if (items.length === 0) {
      setErrorMessage('The invoice must contain at least one item.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const updatedSale: SaleRecord = {
        ...sale,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerCnic: customerCnic.trim(),
        customerAddress: customerAddress.trim(),
        accountNumber: accountNumber.trim() || undefined,
        items,
        subtotalPKR,
        discountPKR,
        taxPKR,
        totalPKR: grandTotalPKR,
        paidAmountPKR,
        balancePKR: remainingBalancePKR,
        paymentMethod,
        paymentStatus: calculatedPaymentStatus,
        registrationStatus,
        warrantyMonths,
        notes: notes.trim() || undefined,
        syncStatus: 'pending',
      };

      // If user opted to update selling price into Showroom stock
      if (syncWithInventory) {
        try {
          const allInv = await getAllInventory();
          for (const sItem of items) {
            if (sItem.bikeId && sItem.pricePKR > 0) {
              const matched = allInv.find((inv) => inv.id === sItem.bikeId);
              if (matched && matched.sellingPricePKR !== sItem.pricePKR) {
                await saveInventoryItem({
                  ...matched,
                  sellingPricePKR: sItem.pricePKR,
                  updatedAt: new Date().toISOString(),
                  syncStatus: 'pending',
                });
              }
            }
          }
        } catch (invErr) {
          console.warn('Could not sync updated price with inventory:', invErr);
        }
      }

      await saveSaleRecord(updatedSale);
      onSaveSuccess(updatedSale);
      onClose();
    } catch (err: any) {
      console.error('Error updating sale invoice:', err);
      setErrorMessage(err?.message || 'Failed to update invoice.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-5 overflow-y-auto no-print">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-800/95 px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-950 text-indigo-400 border border-indigo-700/60 rounded-xl">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">
                Edit Sales Invoice #{sale.invoiceNumber}
              </h3>
              <p className="text-xs text-slate-400">
                Update selling rate, customer details & payment status in PKR
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSave} className="overflow-y-auto p-6 space-y-6 flex-1 text-xs">
          {errorMessage && (
            <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-xl text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Section 1: Customer & Account Information */}
          <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-white border-b border-slate-800/80 pb-2">
              <User className="w-4 h-4 text-indigo-400" />
              <span>Customer & Account Details</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-400 font-medium mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="0300-1234567"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">
                  CNIC Number
                </label>
                <input
                  type="text"
                  value={customerCnic}
                  onChange={(e) => setCustomerCnic(e.target.value)}
                  placeholder="35202-1234567-1"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-400 font-medium mb-1">
                  Residential / Business Address
                </label>
                <input
                  type="text"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="Street / Area, City"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">
                  Showroom Account / File No
                </label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="e.g. 0123-45678"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-indigo-300 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Items & Selling Price */}
          <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Bike className="w-4 h-4 text-emerald-400" />
                <span>Vehicle / Item Rates & Serial Numbers</span>
              </div>
              <span className="text-[11px] text-amber-400 font-mono">
                You can edit the Selling Price (PKR) here directly
              </span>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-3"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">
                        {item.make} {item.model}
                      </span>
                      {item.itemType && (
                        <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-slate-800 text-indigo-300 border border-slate-700">
                          {item.itemType}
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-mono text-slate-400">
                      Item #{idx + 1}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-400 font-medium mb-1">
                        Chassis / Frame #
                      </label>
                      <input
                        type="text"
                        value={item.chassisNumber}
                        onChange={(e) =>
                          handleUpdateItemField(idx, 'chassisNumber', e.target.value)
                        }
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-medium mb-1">
                        Engine #
                      </label>
                      <input
                        type="text"
                        value={item.engineNumber || ''}
                        onChange={(e) =>
                          handleUpdateItemField(idx, 'engineNumber', e.target.value)
                        }
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    {/* SELLING PRICE INPUT */}
                    <div>
                      <label className="block text-emerald-400 font-bold mb-1 flex items-center gap-1">
                        <Pencil className="w-3 h-3 text-emerald-400" />
                        <span>Selling Price / Rate (PKR) *</span>
                      </label>
                      <div className="relative flex items-center">
                        <span className="absolute left-2.5 text-slate-500 font-mono text-xs">
                          Rs.
                        </span>
                        <input
                          type="number"
                          min="0"
                          required
                          value={item.pricePKR === 0 ? '' : item.pricePKR}
                          onChange={(e) =>
                            handleUpdateItemField(
                              idx,
                              'pricePKR',
                              Number(e.target.value)
                            )
                          }
                          placeholder="0"
                          className={`w-full bg-slate-950 border rounded-lg pl-9 pr-3 py-1.5 font-mono font-bold text-sm text-emerald-400 focus:outline-none transition-all ${
                            !item.pricePKR || item.pricePKR <= 0
                              ? 'border-amber-500 bg-amber-950/40 text-amber-300 ring-1 ring-amber-500'
                              : 'border-slate-700 focus:border-emerald-500'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {items.some((ci) => ci.bikeId) && (
              <label className="flex items-center gap-2 text-[11px] text-slate-300 bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl cursor-pointer hover:bg-slate-850 select-none">
                <input
                  type="checkbox"
                  checked={syncWithInventory}
                  onChange={(e) => setSyncWithInventory(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                />
                <span>Also update entered selling rates into Showroom Inventory stock</span>
              </label>
            )}
          </div>

          {/* Section 3: Financials & Totals */}
          <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-white border-b border-slate-800/80 pb-2">
              <CreditCard className="w-4 h-4 text-blue-400" />
              <span>Financial Adjustments & Payment Breakdown</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-400 font-medium mb-1">
                  Discount (PKR)
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-2.5 text-slate-500 font-mono text-xs">
                    Rs.
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={discountPKR === 0 ? '' : discountPKR}
                    onChange={(e) => setDiscountPKR(Number(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">
                  Tax / Reg Fee (PKR)
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-2.5 text-slate-500 font-mono text-xs">
                    Rs.
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={taxPKR === 0 ? '' : taxPKR}
                    onChange={(e) => setTaxPKR(Number(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-400 font-medium">
                    Paid Amount (PKR)
                  </label>
                  <button
                    type="button"
                    onClick={handleSetFullyPaid}
                    className="text-[10px] text-emerald-400 hover:underline font-semibold"
                  >
                    Mark Fully Paid
                  </button>
                </div>
                <div className="relative flex items-center">
                  <span className="absolute left-2.5 text-slate-500 font-mono text-xs">
                    Rs.
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={paidAmountPKR === 0 ? '' : paidAmountPKR}
                    onChange={(e) =>
                      setPaidAmountPKR(Number(e.target.value) || 0)
                    }
                    placeholder="0"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-emerald-400 font-mono font-bold focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Calculations Summary Row */}
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-mono block">
                  Items Subtotal
                </span>
                <span className="font-mono font-bold text-white text-xs">
                  {formatPKR(subtotalPKR)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-mono block">
                  Grand Total
                </span>
                <span className="font-mono font-black text-indigo-300 text-sm">
                  {formatPKR(grandTotalPKR)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-mono block">
                  Paid Received
                </span>
                <span className="font-mono font-bold text-emerald-400 text-xs">
                  {formatPKR(paidAmountPKR)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-mono block">
                  Remaining Due
                </span>
                <span
                  className={`font-mono font-bold text-xs ${
                    remainingBalancePKR > 0 ? 'text-rose-400' : 'text-slate-400'
                  }`}
                >
                  {formatPKR(remainingBalancePKR)}
                </span>
              </div>
            </div>

            {/* Payment Method & Additional Settings */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div>
                <label className="block text-slate-400 font-medium mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="Cash">Cash Payment</option>
                  <option value="Bank Transfer">Bank Transfer / Online</option>
                  <option value="Cheque">Bank Cheque</option>
                  <option value="Pay Order">Pay Order / Demand Draft</option>
                  <option value="Installment">Showroom Installments</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">
                  Registration Status
                </label>
                <select
                  value={registrationStatus}
                  onChange={(e) =>
                    setRegistrationStatus(e.target.value as RegistrationStatus)
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="Showroom Registration">
                    Showroom Registration
                  </option>
                  <option value="Self-Registration">
                    Self-Registration by Customer
                  </option>
                  <option value="Registered">Already Registered / Number Plate</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">
                  Warranty Period
                </label>
                <select
                  value={warrantyMonths}
                  onChange={(e) => setWarrantyMonths(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value={0}>No Warranty</option>
                  <option value={6}>6 Months Warranty</option>
                  <option value={12}>12 Months Warranty (Standard)</option>
                  <option value={24}>24 Months Extended Warranty</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">
                Sale Reference / Notes
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes or payment remarks..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Invoice...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Invoice Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
