'use client';

import React, { useState, useEffect } from 'react';
import {
  SaleRecord,
  SaleItem,
  PaymentMethod,
  PaymentStatus,
  RegistrationStatus,
  InventoryItem,
  StockEntry,
} from '@/types';
import { formatPKR } from '@/lib/currency';
import { saveSaleRecord, saveInventoryItem, getAllInventory, getAllStocks } from '@/lib/db';
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
  Boxes,
  Layers,
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
  const [letterIssued, setLetterIssued] = useState<'Yes' | 'No'>(
    sale.letterIssued === 'Yes' ? 'Yes' : 'No'
  );
  const [issuanceDate, setIssuanceDate] = useState<string>(sale.issuanceDate || '');
  const [letterNumber, setLetterNumber] = useState<string>(sale.letterNumber || '');
  const [notes, setNotes] = useState<string>(sale.notes || '');
  const [syncWithInventory, setSyncWithInventory] = useState<boolean>(true);

  // Showroom Inventory & Stock synchronization state
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
  const [stockList, setStockList] = useState<StockEntry[]>([]);
  const [inventoryStockCounts, setInventoryStockCounts] = useState<Record<string, number>>({});

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([getAllInventory(), getAllStocks()])
      .then(([invs, stks]) => {
        if (!active) return;
        setInventoryList(invs);
        setStockList(stks);

        const initialStockCounts: Record<string, number> = {};
        for (const it of sale.items) {
          const matched = invs.find(
            (b) =>
              (it.bikeId && b.id === it.bikeId) ||
              (it.chassisNumber && b.chassisNumber === it.chassisNumber)
          );
          if (matched) {
            initialStockCounts[matched.id] = matched.stockCount;
          }
        }
        setInventoryStockCounts(initialStockCounts);
      })
      .catch((err) => console.warn('Could not load inventory in EditInvoiceModal:', err));

    return () => {
      active = false;
    };
  }, [sale]);

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
      // Enrich items with stock batch/name if available
      const finalItems: SaleItem[] = items.map((sItem) => {
        const matched = inventoryList.find(
          (b) =>
            (sItem.bikeId && b.id === sItem.bikeId) ||
            (sItem.chassisNumber && b.chassisNumber === sItem.chassisNumber)
        );
        let sName = sItem.stockName || matched?.stockName;
        let sBatch = sItem.stockBatchNumber || matched?.stockBatchNumber;
        let sId = sItem.stockId || matched?.stockId;
        if (!sName && (sId || sBatch)) {
          const matchedStock = stockList.find(
            (stk) => (sId && stk.id === sId) || (sBatch && stk.batchNumber === sBatch)
          );
          if (matchedStock) {
            sName = matchedStock.stockName;
            sBatch = sBatch || matchedStock.batchNumber;
            sId = sId || matchedStock.id;
          }
        }
        return {
          ...sItem,
          stockId: sId,
          stockBatchNumber: sBatch,
          stockName: sName,
        };
      });

      const updatedSale: SaleRecord = {
        ...sale,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerCnic: customerCnic.trim(),
        customerAddress: customerAddress.trim(),
        accountNumber: accountNumber.trim() || undefined,
        items: finalItems,
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
        letterIssued,
        issuanceDate:
          letterIssued === 'Yes'
            ? issuanceDate || new Date().toISOString().split('T')[0]
            : undefined,
        letterNumber:
          letterIssued === 'Yes' && letterNumber.trim()
            ? letterNumber.trim()
            : undefined,
        notes: notes.trim() || undefined,
        syncStatus: 'pending',
      };

      // Synchronize showroom stock quantity and rates
      try {
        const allInv = await getAllInventory();
        for (const sItem of finalItems) {
          const matched = allInv.find(
            (inv) =>
              (sItem.bikeId && inv.id === sItem.bikeId) ||
              (sItem.chassisNumber && inv.chassisNumber === sItem.chassisNumber)
          );

          if (matched) {
            const hasStockEdit = inventoryStockCounts[matched.id] !== undefined;
            const newStockCount = hasStockEdit
              ? inventoryStockCounts[matched.id]
              : matched.stockCount;
            const newSellingPrice =
              syncWithInventory && sItem.pricePKR > 0
                ? sItem.pricePKR
                : matched.sellingPricePKR;

            const shouldUpdate =
              hasStockEdit ||
              newStockCount !== matched.stockCount ||
              newSellingPrice !== matched.sellingPricePKR;

            if (shouldUpdate) {
              await saveInventoryItem({
                ...matched,
                stockCount: newStockCount,
                status: newStockCount > 0 ? 'Available' : 'Sold',
                sellingPricePKR: newSellingPrice,
                updatedAt: new Date().toISOString(),
                syncStatus: 'pending',
              });
            }
          }
        }
      } catch (invErr) {
        console.warn('Could not sync stock or rates with showroom inventory:', invErr);
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
              {items.map((item, idx) => {
                const matchedBike = inventoryList.find(
                  (b) =>
                    (item.bikeId && b.id === item.bikeId) ||
                    (item.chassisNumber && b.chassisNumber === item.chassisNumber)
                );

                let sName = item.stockName || matchedBike?.stockName;
                let sBatch = item.stockBatchNumber || matchedBike?.stockBatchNumber;
                if (!sName && (item.stockId || matchedBike?.stockId)) {
                  const targetId = item.stockId || matchedBike?.stockId;
                  const stk = stockList.find((s) => s.id === targetId);
                  if (stk) {
                    sName = stk.stockName;
                    sBatch = sBatch || stk.batchNumber;
                  }
                }

                return (
                  <div
                    key={idx}
                    className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-sm">
                          {item.make} {item.model}
                        </span>
                        {item.itemType && (
                          <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-slate-800 text-indigo-300 border border-slate-700">
                            {item.itemType}
                          </span>
                        )}
                        {sName || sBatch ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-indigo-300 bg-indigo-950/80 px-2 py-0.5 rounded-md border border-indigo-800/60">
                            <Layers className="w-3 h-3 text-indigo-400" />
                            <span>Stock: <strong className="text-white">{sName || sBatch}</strong>{sBatch && sName ? ` (${sBatch})` : ''}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-slate-500 italic">
                            General Stock
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-mono text-slate-400">
                        Item #{idx + 1}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-slate-400 font-medium mb-1 text-xs">
                          Chassis / Frame #
                        </label>
                        <input
                          type="text"
                          value={item.chassisNumber}
                          onChange={(e) =>
                            handleUpdateItemField(idx, 'chassisNumber', e.target.value)
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-400 font-medium mb-1 text-xs">
                          Engine / Motor # (Optional)
                        </label>
                        <input
                          type="text"
                          value={item.engineNumber || ''}
                          onChange={(e) =>
                            handleUpdateItemField(idx, 'engineNumber', e.target.value)
                          }
                          placeholder="Optional / N/A"
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-400 font-medium mb-1 text-xs">
                          Invoice Qty (Units) *
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="999"
                          required
                          value={item.quantity || 1}
                          onChange={(e) =>
                            handleUpdateItemField(
                              idx,
                              'quantity',
                              Math.max(1, parseInt(e.target.value, 10) || 1)
                            )
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono font-bold text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      {/* SELLING PRICE INPUT */}
                      <div>
                        <label className="block text-emerald-400 font-bold mb-1 text-xs flex items-center gap-1">
                          <Pencil className="w-3 h-3 text-emerald-400" />
                          <span>Unit Rate (PKR) *</span>
                        </label>
                        <div className="relative flex items-center">
                          <span className="absolute left-2 text-slate-500 font-mono text-xs">
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
                            className={`w-full bg-slate-950 border rounded-lg pl-8 pr-2.5 py-1.5 font-mono font-bold text-xs text-emerald-400 focus:outline-none transition-all ${
                              !item.pricePKR || item.pricePKR <= 0
                                ? 'border-amber-500 bg-amber-950/40 text-amber-300 ring-1 ring-amber-500'
                                : 'border-slate-700 focus:border-emerald-500'
                            }`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Showroom Inventory Stock Update Field */}
                    {matchedBike && (
                      <div className="pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2.5 bg-slate-950/50 p-2.5 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-indigo-950/80 text-indigo-400 rounded-md border border-indigo-800/60">
                            <Boxes className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-white block">
                              Showroom Inventory Available Stock
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Current in Showroom:{' '}
                              <strong className="text-emerald-400 font-mono">
                                {matchedBike.stockCount} Units
                              </strong>
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-slate-300 font-medium">Update Showroom Units:</label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              max="9999"
                              value={
                                inventoryStockCounts[matchedBike.id] !== undefined
                                  ? inventoryStockCounts[matchedBike.id]
                                  : matchedBike.stockCount
                              }
                              onChange={(e) => {
                                const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                                setInventoryStockCounts((prev) => ({
                                  ...prev,
                                  [matchedBike.id]: val,
                                }));
                              }}
                              className="w-24 bg-slate-900 border border-indigo-700/70 rounded-lg px-2.5 py-1 text-center font-mono font-bold text-indigo-300 text-xs focus:outline-none focus:border-indigo-500"
                            />
                            <span className="text-xs text-slate-400 font-mono">Units</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
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

            {/* Letter Issued, Issuance Date & Reference Number */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="block text-slate-400 font-medium mb-1">
                  Letter Issued
                </label>
                <select
                  value={letterIssued}
                  onChange={(e) => {
                    const val = e.target.value as 'Yes' | 'No';
                    setLetterIssued(val);
                    if (val === 'Yes' && !issuanceDate) {
                      setIssuanceDate(new Date().toISOString().split('T')[0]);
                    }
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="No">No — Pending</option>
                  <option value="Yes">Yes — Issued</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1 flex items-center justify-between">
                  <span>Issuance Date</span>
                  {letterIssued !== 'Yes' && (
                    <span className="text-[10px] text-slate-500 font-normal italic">
                      When Yes
                    </span>
                  )}
                </label>
                <input
                  type="date"
                  value={letterIssued === 'Yes' ? issuanceDate : ''}
                  onChange={(e) => setIssuanceDate(e.target.value)}
                  disabled={letterIssued !== 'Yes'}
                  className={`w-full bg-slate-900 border rounded-lg px-3 py-2 text-white text-xs focus:outline-none transition-all ${
                    letterIssued === 'Yes'
                      ? 'border-slate-700 focus:border-indigo-500 cursor-pointer'
                      : 'border-slate-800 opacity-40 cursor-not-allowed bg-slate-950/60 text-slate-600'
                  }`}
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">
                  Letter Ref # (Optional)
                </label>
                <input
                  type="text"
                  value={letterNumber}
                  onChange={(e) => setLetterNumber(e.target.value)}
                  disabled={letterIssued !== 'Yes'}
                  placeholder={letterIssued === 'Yes' ? 'e.g. LTR-0042' : 'Disabled'}
                  className={`w-full bg-slate-900 border rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none transition-all ${
                    letterIssued === 'Yes'
                      ? 'border-slate-700 focus:border-indigo-500'
                      : 'border-slate-800 opacity-40 cursor-not-allowed bg-slate-950/60 text-slate-600'
                  }`}
                />
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
