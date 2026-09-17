'use client';

import React, { useState } from 'react';
import { SaleRecord } from '@/types';
import { saveSaleRecord } from '@/lib/db';
import { performManualCloudSync } from '@/lib/syncEngine';
import {
  FileText,
  FileCheck,
  X,
  Calendar,
  Hash,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
} from 'lucide-react';

interface UpdateLetterModalProps {
  isOpen: boolean;
  sale: SaleRecord | null;
  onClose: () => void;
  onLetterUpdated: (updatedSale: SaleRecord) => void;
}

export const UpdateLetterModal: React.FC<UpdateLetterModalProps> = ({
  isOpen,
  sale,
  onClose,
  onLetterUpdated,
}) => {
  if (!isOpen || !sale) return null;

  return (
    <UpdateLetterForm
      key={sale.id}
      sale={sale}
      onClose={onClose}
      onLetterUpdated={onLetterUpdated}
    />
  );
};

interface UpdateLetterFormProps {
  sale: SaleRecord;
  onClose: () => void;
  onLetterUpdated: (updatedSale: SaleRecord) => void;
}

const UpdateLetterForm: React.FC<UpdateLetterFormProps> = ({
  sale,
  onClose,
  onLetterUpdated,
}) => {
  const [letterIssued, setLetterIssued] = useState<'Yes' | 'No'>(
    sale.letterIssued === 'Yes' ? 'Yes' : 'No'
  );
  const [issuanceDate, setIssuanceDate] = useState<string>(
    sale.issuanceDate || new Date().toISOString().split('T')[0]
  );
  const [letterNumber, setLetterNumber] = useState<string>(
    sale.letterNumber || ''
  );
  const [letterNotes, setLetterNotes] = useState<string>(sale.notes || '');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const updatedSale: SaleRecord = {
        ...sale,
        letterIssued,
        issuanceDate:
          letterIssued === 'Yes'
            ? issuanceDate || new Date().toISOString().split('T')[0]
            : undefined,
        letterNumber:
          letterIssued === 'Yes' && letterNumber.trim()
            ? letterNumber.trim()
            : undefined,
        notes: letterNotes.trim() || undefined,
        syncStatus: 'pending',
      };

      await saveSaleRecord(updatedSale);

      // Perform background sync to Firestore
      try {
        await performManualCloudSync();
      } catch (syncErr) {
        console.warn('Sync after letter update warning:', syncErr);
      }

      setSuccessMessage(
        letterIssued === 'Yes'
          ? `Letter status successfully updated to "Issued" on ${issuanceDate}.`
          : 'Invoice updated: Letter marked as "Not Issued".'
      );

      onLetterUpdated(updatedSale);

      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error('Failed to update letter for invoice:', err);
      setErrorMessage(
        err?.message || 'Failed to update letter. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const primaryItem = sale.items && sale.items[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-5 overflow-y-auto no-print">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="bg-slate-800/95 px-5 py-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-950 text-emerald-400 border border-emerald-700/60 rounded-xl">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">
                Add / Update Letter
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

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Invoice Summary Box */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-1.5 text-xs text-slate-300">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Customer:</span>
              <span className="font-bold text-white">{sale.customerName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Vehicle / Item:</span>
              <span className="font-mono text-indigo-300">
                {primaryItem ? `${primaryItem.make} ${primaryItem.model}` : 'Vehicle'}
                {primaryItem?.chassisNumber ? ` (Chassis: ${primaryItem.chassisNumber})` : ''}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Current Letter Status:</span>
              {sale.letterIssued === 'Yes' ? (
                <span className="font-semibold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Issued on {sale.issuanceDate || 'N/A'}
                  {sale.letterNumber ? ` (Ref: ${sale.letterNumber})` : ''}
                </span>
              ) : (
                <span className="font-semibold text-amber-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> No Letter Attached (Pending)
                </span>
              )}
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

          {/* Letter Issued Option */}
          <div>
            <label className="block text-slate-300 font-semibold mb-2 text-xs">
              Has the customer provided / received the letter? *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setLetterIssued('Yes');
                  if (!issuanceDate) {
                    setIssuanceDate(new Date().toISOString().split('T')[0]);
                  }
                }}
                className={`py-3 px-4 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  letterIssued === 'Yes'
                    ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-950/40'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <FileCheck className="w-4 h-4 text-emerald-400" />
                <span>Yes — Letter Attached</span>
              </button>

              <button
                type="button"
                onClick={() => setLetterIssued('No')}
                className={`py-3 px-4 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  letterIssued === 'No'
                    ? 'bg-amber-950/80 border-amber-500 text-amber-300 shadow-md shadow-amber-950/40'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <X className="w-4 h-4 text-amber-400" />
                <span>No — Pending Letter</span>
              </button>
            </div>
          </div>

          {/* Details if Letter is Issued */}
          {letterIssued === 'Yes' && (
            <div className="space-y-3 p-3.5 bg-slate-950/50 border border-slate-800/80 rounded-xl">
              <div>
                <label className="block text-slate-400 text-xs font-medium mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Letter Issuance / Receipt Date *</span>
                </label>
                <input
                  type="date"
                  required
                  value={issuanceDate}
                  onChange={(e) => setIssuanceDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-indigo-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-xs font-medium mb-1 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Letter / Registration Reference # (Optional)</span>
                </label>
                <input
                  type="text"
                  value={letterNumber}
                  onChange={(e) => setLetterNumber(e.target.value)}
                  placeholder="e.g. LTR-2026-0042, Book #, or Excise File #"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Notes / Reference */}
          <div>
            <label className="block text-slate-400 text-xs font-medium mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              <span>Notes / Letter Remarks (Optional)</span>
            </label>
            <textarea
              rows={2}
              value={letterNotes}
              onChange={(e) => setLetterNotes(e.target.value)}
              placeholder="e.g. Customer provided letter one week after purchase. Verified by showroom management."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Actions */}
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
              className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Letter Details</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
