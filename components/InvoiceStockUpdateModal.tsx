'use client';

import React, { useState, useEffect } from 'react';
import { SaleRecord, SaleItem, InventoryItem } from '@/types';
import { getAllInventory, saveInventoryItem, saveSaleRecord } from '@/lib/db';
import { performManualCloudSync } from '@/lib/syncEngine';
import { formatPKR } from '@/lib/currency';
import {
  Boxes,
  X,
  Plus,
  Minus,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Bike,
  RefreshCw,
  Layers,
  ArrowRightLeft,
} from 'lucide-react';

interface InvoiceStockUpdateModalProps {
  isOpen: boolean;
  sale: SaleRecord | null;
  onClose: () => void;
  onInvoiceUpdated: (updatedSale: SaleRecord) => void;
  onInventoryUpdated?: () => void;
}

interface ItemStockState {
  itemIndex: number;
  item: SaleItem;
  soldQuantity: number;
  ratePKR: number;
  matchedInventoryItem: InventoryItem | null;
  newShowroomStockCount: number;
}

export const InvoiceStockUpdateModal: React.FC<InvoiceStockUpdateModalProps> = ({
  isOpen,
  sale,
  onClose,
  onInvoiceUpdated,
  onInventoryUpdated,
}) => {
  if (!isOpen || !sale) return null;

  return (
    <InvoiceStockUpdateForm
      key={sale.id}
      sale={sale}
      onClose={onClose}
      onInvoiceUpdated={onInvoiceUpdated}
      onInventoryUpdated={onInventoryUpdated}
    />
  );
};

interface InvoiceStockUpdateFormProps {
  sale: SaleRecord;
  onClose: () => void;
  onInvoiceUpdated: (updatedSale: SaleRecord) => void;
  onInventoryUpdated?: () => void;
}

const InvoiceStockUpdateForm: React.FC<InvoiceStockUpdateFormProps> = ({
  sale,
  onClose,
  onInvoiceUpdated,
  onInventoryUpdated,
}) => {
  const [itemsStockState, setItemsStockState] = useState<ItemStockState[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    getAllInventory()
      .then((allInventory) => {
        if (!isMounted) return;

        const states: ItemStockState[] = (sale.items || []).map((saleItem, idx) => {
          let matched: InventoryItem | null = null;
          if (saleItem.bikeId) {
            matched = allInventory.find((b) => b.id === saleItem.bikeId) || null;
          }
          if (!matched && saleItem.chassisNumber && saleItem.chassisNumber.trim() && !saleItem.chassisNumber.startsWith('CUSTOM-')) {
            const cNum = saleItem.chassisNumber.trim().toLowerCase();
            matched = allInventory.find((b) => b.chassisNumber && b.chassisNumber.trim().toLowerCase() === cNum) || null;
          }
          if (!matched && saleItem.engineNumber && saleItem.engineNumber.trim() && saleItem.engineNumber !== 'N/A') {
            const eNum = saleItem.engineNumber.trim().toLowerCase();
            matched = allInventory.find((b) => b.engineNumber && b.engineNumber.trim().toLowerCase() === eNum) || null;
          }

          return {
            itemIndex: idx,
            item: saleItem,
            soldQuantity: saleItem.quantity || 1,
            ratePKR: saleItem.pricePKR || 0,
            matchedInventoryItem: matched,
            newShowroomStockCount: matched ? (matched.stockCount ?? 0) : 0,
          };
        });

        setItemsStockState(states);
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Failed to load inventory for invoice stock modal:', err);
        setErrorMessage('Failed to load inventory records.');
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [sale.id, sale.items]);

  const handleSoldQuantityChange = (idx: number, newQty: number) => {
    const qty = Math.max(1, isNaN(newQty) ? 1 : newQty);
    setItemsStockState((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, soldQuantity: qty } : s))
    );
  };

  const handleShowroomStockChange = (idx: number, newStock: number) => {
    const stock = Math.max(0, isNaN(newStock) ? 0 : newStock);
    setItemsStockState((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, newShowroomStockCount: stock } : s))
    );
  };

  const handleRateChange = (idx: number, newRate: number) => {
    const rate = Math.max(0, isNaN(newRate) ? 0 : newRate);
    setItemsStockState((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, ratePKR: rate } : s))
    );
  };

  // Recalculate totals
  const recalculatedSubtotal = itemsStockState.reduce(
    (sum, it) => sum + it.ratePKR * it.soldQuantity,
    0
  );
  const discount = sale.discountPKR || 0;
  const tax = sale.taxPKR || 0;
  const recalculatedTotal = Math.max(0, recalculatedSubtotal - discount + tax);
  const recalculatedBalance = Math.max(0, recalculatedTotal - (sale.paidAmountPKR || 0));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);

    try {
      // 1. Update Inventory Records if matched
      for (const st of itemsStockState) {
        if (st.matchedInventoryItem) {
          const invItem = st.matchedInventoryItem;
          const updatedStock = st.newShowroomStockCount;
          const updatedStatus = updatedStock > 0 ? 'Available' : 'Sold';

          await saveInventoryItem({
            ...invItem,
            stockCount: updatedStock,
            status: updatedStatus,
            updatedAt: new Date().toISOString(),
            syncStatus: 'pending',
          });
        }
      }

      // 2. Update the Sale Record items with updated quantities and rates
      const updatedItems: SaleItem[] = sale.items.map((it, idx) => {
        const state = itemsStockState.find((s) => s.itemIndex === idx);
        if (state) {
          return {
            ...it,
            quantity: state.soldQuantity,
            pricePKR: state.ratePKR,
          };
        }
        return it;
      });

      const updatedSale: SaleRecord = {
        ...sale,
        items: updatedItems,
        subtotalPKR: recalculatedSubtotal,
        totalPKR: recalculatedTotal,
        balancePKR: recalculatedBalance,
        paymentStatus:
          sale.paidAmountPKR >= recalculatedTotal
            ? 'Paid'
            : sale.paidAmountPKR > 0
            ? 'Partial'
            : 'Unpaid',
        updatedAt: new Date().toISOString(),
        syncStatus: 'pending',
      };

      await saveSaleRecord(updatedSale);

      // Perform background sync to Firestore
      try {
        await performManualCloudSync();
      } catch (syncErr) {
        console.warn('Sync warning after invoice stock update:', syncErr);
      }

      setSuccessMessage('Stock and invoice quantities successfully synchronized!');
      onInvoiceUpdated(updatedSale);
      if (onInventoryUpdated) {
        onInventoryUpdated();
      }

      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error('Failed to update invoice stock:', err);
      setErrorMessage(
        err?.message || 'Failed to synchronize stock. Please try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-5 overflow-y-auto no-print">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-800/95 px-5 py-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-950 text-indigo-400 border border-indigo-700/60 rounded-xl">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">
                Stock & Quantity Synchronization
              </h3>
              <p className="text-xs text-slate-400">
                Invoice #{sale.invoiceNumber} • {sale.customerName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-xs">Loading matching showroom inventory...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
            {/* Feedback alerts */}
            {errorMessage && (
              <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Explanation card */}
            <div className="bg-indigo-950/30 border border-indigo-800/40 rounded-xl p-3 text-xs text-indigo-200 flex items-start gap-2.5">
              <RefreshCw className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Adjust the invoice item quantity below or update the current stock units available in the showroom inventory for each item. Both records will remain strictly synchronized.
              </p>
            </div>

            {/* Items List */}
            <div className="space-y-3">
              {itemsStockState.map((state, idx) => {
                const item = state.item;
                const matched = state.matchedInventoryItem;

                return (
                  <div
                    key={idx}
                    className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
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
                      <span className="text-xs font-mono text-slate-400">
                        Item #{idx + 1}
                      </span>
                    </div>

                    <div className="text-xs font-mono text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
                      <span>Chassis: {item.chassisNumber}</span>
                      {item.engineNumber && item.engineNumber !== 'N/A' && (
                        <span>Engine: {item.engineNumber}</span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-850">
                      {/* Left: Invoice Quantity */}
                      <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl space-y-2">
                        <label className="block text-xs font-semibold text-slate-300">
                          Invoice Quantity (Sold Units) *
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              handleSoldQuantityChange(idx, state.soldQuantity - 1)
                            }
                            disabled={state.soldQuantity <= 1}
                            className="w-8 h-8 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white rounded-lg flex items-center justify-center font-bold text-xs border border-slate-700 cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="number"
                            min="1"
                            max="999"
                            required
                            value={state.soldQuantity}
                            onChange={(e) =>
                              handleSoldQuantityChange(
                                idx,
                                parseInt(e.target.value, 10)
                              )
                            }
                            className="w-20 text-center bg-slate-950 border border-slate-700 rounded-lg py-1.5 text-white font-mono font-bold text-sm focus:outline-none focus:border-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              handleSoldQuantityChange(idx, state.soldQuantity + 1)
                            }
                            className="w-8 h-8 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center justify-center font-bold text-xs cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs text-slate-400 font-mono">
                            Units
                          </span>
                        </div>

                        {/* Rate / Price */}
                        <div className="pt-1">
                          <label className="block text-[11px] text-slate-400 mb-1">
                            Unit Selling Rate (PKR)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={state.ratePKR}
                            onChange={(e) =>
                              handleRateChange(idx, Number(e.target.value) || 0)
                            }
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-emerald-400 font-mono text-xs font-bold focus:outline-none focus:border-emerald-500"
                          />
                          <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                            Line Total: {formatPKR(state.ratePKR * state.soldQuantity)}
                          </span>
                        </div>
                      </div>

                      {/* Right: Showroom Stock Count for this item */}
                      <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-semibold text-slate-300">
                            Showroom Inventory Stock
                          </label>
                          {matched ? (
                            <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                              Linked to Showroom
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-amber-950 text-amber-300 border border-amber-800">
                              Custom Entry
                            </span>
                          )}
                        </div>

                        {matched ? (
                          <>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  handleShowroomStockChange(
                                    idx,
                                    state.newShowroomStockCount - 1
                                  )
                                }
                                disabled={state.newShowroomStockCount <= 0}
                                className="w-8 h-8 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white rounded-lg flex items-center justify-center font-bold text-xs border border-slate-700 cursor-pointer"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <input
                                type="number"
                                min="0"
                                max="999"
                                required
                                value={state.newShowroomStockCount}
                                onChange={(e) =>
                                  handleShowroomStockChange(
                                    idx,
                                    parseInt(e.target.value, 10)
                                  )
                                }
                                className="w-20 text-center bg-slate-950 border border-slate-700 rounded-lg py-1.5 text-white font-mono font-bold text-sm focus:outline-none focus:border-indigo-500"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  handleShowroomStockChange(
                                    idx,
                                    state.newShowroomStockCount + 1
                                  )
                                }
                                className="w-8 h-8 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center justify-center font-bold text-xs cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleShowroomStockChange(idx, 0)}
                                  className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                                  title="Mark as 0 units (Sold)"
                                >
                                  0
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleShowroomStockChange(idx, 1)}
                                  className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                                  title="Set to 1 unit"
                                >
                                  1
                                </button>
                              </div>
                            </div>
                            <p className="text-[10px] text-slate-500">
                              Directly synchronizes showroom inventory table
                            </p>
                          </>
                        ) : (
                          <p className="text-xs text-slate-500 italic py-1">
                            This vehicle was recorded as a custom invoice entry and has no linked inventory ID.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <div className="text-xs text-slate-400 flex items-center gap-1.5">
                <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-400" />
                <span>Changes will synchronize both Invoice & Inventory DataTable</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSaving}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Syncing...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Save & Synchronize Stock</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
