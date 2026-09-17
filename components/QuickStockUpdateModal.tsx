'use client';

import React, { useState } from 'react';
import { InventoryItem, BikeStatus } from '@/types';
import { saveInventoryItem } from '@/lib/db';
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
  Layers,
} from 'lucide-react';

interface QuickStockUpdateModalProps {
  isOpen: boolean;
  item: InventoryItem | null;
  onClose: () => void;
  onStockUpdated: (updatedItem: InventoryItem) => void;
}

export const QuickStockUpdateModal: React.FC<QuickStockUpdateModalProps> = ({
  isOpen,
  item,
  onClose,
  onStockUpdated,
}) => {
  if (!isOpen || !item) return null;

  return (
    <QuickStockUpdateForm
      key={item.id}
      item={item}
      onClose={onClose}
      onStockUpdated={onStockUpdated}
    />
  );
};

interface QuickStockUpdateFormProps {
  item: InventoryItem;
  onClose: () => void;
  onStockUpdated: (updatedItem: InventoryItem) => void;
}

const QuickStockUpdateForm: React.FC<QuickStockUpdateFormProps> = ({
  item,
  onClose,
  onStockUpdated,
}) => {
  const initialStock = item.stockCount ?? 1;
  const [stockCount, setStockCount] = useState<number>(initialStock);
  const [status, setStatus] = useState<BikeStatus>(
    item.status || (initialStock > 0 ? 'Available' : 'Sold')
  );
  const [notes, setNotes] = useState<string>(item.notes || '');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleAdjust = (delta: number) => {
    setStockCount((prev) => {
      const next = Math.max(0, prev + delta);
      if (next === 0) {
        setStatus('Sold');
      } else if (status === 'Sold' && next > 0) {
        setStatus('Available');
      }
      return next;
    });
  };

  const handleStockCountChange = (val: number) => {
    const next = Math.max(0, isNaN(val) ? 0 : val);
    setStockCount(next);
    if (next === 0) {
      setStatus('Sold');
    } else if (status === 'Sold' && next > 0) {
      setStatus('Available');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const updatedItem: InventoryItem = {
        ...item,
        stockCount,
        status,
        notes: notes.trim() || undefined,
        updatedAt: new Date().toISOString(),
        syncStatus: 'pending',
      };

      await saveInventoryItem(updatedItem);

      // Perform background sync to Firestore
      try {
        await performManualCloudSync();
      } catch (syncErr) {
        console.warn('Sync after stock update warning:', syncErr);
      }

      setSuccessMessage(`Stock updated successfully to ${stockCount} unit(s).`);
      onStockUpdated(updatedItem);

      setTimeout(() => {
        onClose();
      }, 800);
    } catch (err: any) {
      console.error('Failed to update inventory stock:', err);
      setErrorMessage(
        err?.message || 'Failed to update stock quantity. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentAvailable = item.stockCount ?? 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-5 overflow-y-auto no-print">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="bg-slate-800/95 px-5 py-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-950 text-indigo-400 border border-indigo-700/60 rounded-xl">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">
                Update Stock Quantity
              </h3>
              <p className="text-xs text-slate-400">
                {item.make} {item.model} • {item.color}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Item details card */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs text-slate-300">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Vehicle / Model:</span>
              <span className="font-bold text-white flex items-center gap-1.5">
                <Bike className="w-3.5 h-3.5 text-indigo-400" />
                {item.make} {item.model} ({item.year})
              </span>
            </div>
            <div className="flex justify-between items-center font-mono">
              <span className="text-slate-400">Chassis #:</span>
              <span className="text-slate-200">{item.chassisNumber}</span>
            </div>
            {item.engineNumber && item.engineNumber !== 'N/A' && (
              <div className="flex justify-between items-center font-mono">
                <span className="text-slate-400">Engine #:</span>
                <span className="text-slate-200">{item.engineNumber}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Current Stock:</span>
              <span className="font-mono font-bold text-indigo-300">
                {currentAvailable} unit(s) ({item.status})
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Selling Price:</span>
              <span className="font-mono font-bold text-emerald-400">
                {formatPKR(item.sellingPricePKR)}
              </span>
            </div>
          </div>

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

          {/* Stock Quantity Counter Input */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5 text-xs flex items-center justify-between">
              <span>New Available Stock Quantity *</span>
              <span className="text-slate-500 font-normal">
                Units physically in showroom
              </span>
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleAdjust(-1)}
                disabled={stockCount <= 0}
                className="w-11 h-11 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-white rounded-xl flex items-center justify-center font-bold text-base transition-colors border border-slate-700 cursor-pointer"
              >
                <Minus className="w-4 h-4" />
              </button>

              <div className="flex-1 relative">
                <input
                  type="number"
                  min="0"
                  max="999"
                  required
                  value={stockCount}
                  onChange={(e) =>
                    handleStockCountChange(parseInt(e.target.value, 10))
                  }
                  className="w-full text-center bg-slate-950 border border-indigo-500/50 rounded-xl py-2.5 text-white font-mono font-black text-xl focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 shadow-inner"
                />
                <span className="absolute right-3 top-3 text-[10px] uppercase font-mono font-bold text-slate-500">
                  Qty
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleAdjust(1)}
                className="w-11 h-11 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl flex items-center justify-center font-bold text-base transition-colors shadow-md shadow-indigo-600/30 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Status Selection */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5 text-xs">
              Inventory Status *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['Available', 'Reserved', 'Sold'] as BikeStatus[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatus(st)}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    status === st
                      ? st === 'Available'
                        ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-950/40'
                        : st === 'Reserved'
                        ? 'bg-amber-950/80 border-amber-500 text-amber-300 shadow-md shadow-amber-950/40'
                        : 'bg-rose-950/80 border-rose-500 text-rose-300 shadow-md shadow-rose-950/40'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Optional Stock Adjustment Notes */}
          <div>
            <label className="block text-slate-400 text-xs font-medium mb-1 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>Stock Update Notes (Optional)</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Received new shipment, physical count verified, or damaged unit written off."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Update Stock</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
