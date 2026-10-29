'use client';

import React, { useState, useMemo } from 'react';
import { DateFilterPeriod, getDateRangeBounds, filterItemsByDate } from '@/lib/reports/dateFilter';
import {
  FileText,
  FileSpreadsheet,
  Calendar,
  Filter,
  CheckCircle2,
  X,
  Loader2,
  Download,
  AlertCircle,
  Clock,
  Layers,
} from 'lucide-react';

export type ExportFormat = 'pdf' | 'excel';

export interface ExportModalProps<T> {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  allItems: T[];
  filteredItems: T[];
  dateGetter: (item: T) => string | undefined | null;
  allowExcel?: boolean; // defaults to true, false for Analytics
  onExport: (config: {
    format: ExportFormat;
    scope: 'all' | 'filtered';
    period: DateFilterPeriod;
    periodLabel: string;
    itemsToExport: T[];
    customStart?: string;
    customEnd?: string;
  }) => Promise<void> | void;
}

export function ExportModal<T>({
  isOpen,
  onClose,
  title,
  subtitle,
  allItems,
  filteredItems,
  dateGetter,
  allowExcel = true,
  onExport,
}: ExportModalProps<T>) {
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [scope, setScope] = useState<'all' | 'filtered'>(
    filteredItems.length !== allItems.length ? 'filtered' : 'all'
  );
  const [period, setPeriod] = useState<DateFilterPeriod>('all');

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const thirtyDaysAgoStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  }, []);

  const [customStart, setCustomStart] = useState<string>(thirtyDaysAgoStr);
  const [customEnd, setCustomEnd] = useState<string>(todayStr);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Compute items that match scope and date range
  const matchedItems = useMemo(() => {
    const baseList = scope === 'filtered' ? filteredItems : allItems;
    return filterItemsByDate(baseList, dateGetter, period, customStart, customEnd);
  }, [allItems, filteredItems, scope, period, customStart, customEnd, dateGetter]);

  const periodBounds = useMemo(() => {
    return getDateRangeBounds(period, customStart, customEnd);
  }, [period, customStart, customEnd]);

  if (!isOpen) return null;

  const handleExecuteExport = async () => {
    setErrorMessage(null);

    if (period === 'custom') {
      if (!customStart || !customEnd) {
        setErrorMessage('Please select both a start date and an end date.');
        return;
      }
      if (new Date(customStart) > new Date(customEnd)) {
        setErrorMessage('Start date cannot be after end date.');
        return;
      }
    }

    if (matchedItems.length === 0) {
      setErrorMessage('No records available for export with the selected criteria.');
      return;
    }

    setIsExporting(true);
    try {
      await onExport({
        format,
        scope,
        period,
        periodLabel: periodBounds.label,
        itemsToExport: matchedItems,
        customStart,
        customEnd,
      });
      onClose();
    } catch (err: any) {
      console.error('Export failed:', err);
      setErrorMessage(err?.message || 'Failed to generate export file. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col text-slate-100">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-indigo-950 text-indigo-400 rounded-xl border border-indigo-800/50">
              <Download className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-base font-mono text-white">{title}</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {subtitle || 'Select format, dataset scope, and reporting period'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* 1. Format Selection */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-slate-300 font-semibold mb-2">
              1. Export Format
            </label>
            <div className={`grid ${allowExcel ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
              <button
                type="button"
                onClick={() => setFormat('pdf')}
                className={`p-3 rounded-xl border flex items-center gap-3 transition-all text-left ${
                  format === 'pdf'
                    ? 'bg-rose-950/40 border-rose-500 text-white shadow-lg shadow-rose-950/20'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <div
                  className={`p-2 rounded-lg ${
                    format === 'pdf' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm">PDF Document</div>
                  <div className="text-[11px] text-slate-400">Printable & ready for audit</div>
                </div>
              </button>

              {allowExcel && (
                <button
                  type="button"
                  onClick={() => setFormat('excel')}
                  className={`p-3 rounded-xl border flex items-center gap-3 transition-all text-left ${
                    format === 'excel'
                      ? 'bg-emerald-950/40 border-emerald-500 text-white shadow-lg shadow-emerald-950/20'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg ${
                      format === 'excel' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-sm">Excel Spreadsheet</div>
                    <div className="text-[11px] text-slate-400">Microsoft Excel (.xlsx)</div>
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* 2. Dataset Scope */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-slate-300 font-semibold mb-2">
              2. Data Scope
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setScope('all')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  scope === 'all'
                    ? 'bg-indigo-950/40 border-indigo-500 text-white shadow-lg'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <div className="font-bold text-sm">All Records</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Complete dataset ({allItems.length} total)
                </div>
              </button>

              <button
                type="button"
                onClick={() => setScope('filtered')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  scope === 'filtered'
                    ? 'bg-indigo-950/40 border-indigo-500 text-white shadow-lg'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <div className="font-bold text-sm">Filtered View</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Applied search & filters ({filteredItems.length})
                </div>
              </button>
            </div>
          </div>

          {/* 3. Reporting Period / Date Range */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-slate-300 font-semibold mb-2">
              3. Reporting Period
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {[
                { id: 'all', label: 'All Time' },
                { id: 'weekly', label: 'Weekly' },
                { id: 'monthly', label: 'Monthly' },
                { id: 'yearly', label: 'Yearly' },
                { id: 'custom', label: 'Custom' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPeriod(p.id as DateFilterPeriod)}
                  className={`py-2 px-2.5 rounded-xl text-xs font-mono font-medium transition-all text-center border ${
                    period === p.id
                      ? 'bg-purple-600 border-purple-500 text-white shadow-md shadow-purple-600/30'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom Date Pickers */}
            {period === 'custom' && (
              <div className="grid grid-cols-2 gap-3 mt-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">End Date</label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Record Count Preview Card */}
          <div className="p-3.5 bg-slate-950/80 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-emerald-950 text-emerald-400 rounded-lg border border-emerald-800/40">
                <CheckCircle2 className="w-4 h-4" />
              </span>
              <div>
                <span className="text-slate-400 block text-[11px]">Records ready for export:</span>
                <span className="text-white font-mono font-bold text-sm">
                  {matchedItems.length} record(s)
                </span>
              </div>
            </div>
            <div className="text-right text-[11px] text-slate-400 font-mono max-w-[180px] truncate">
              {periodBounds.label}
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-rose-950/50 border border-rose-800/60 rounded-xl flex items-center gap-2 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExecuteExport}
            disabled={isExporting || matchedItems.length === 0}
            className="py-2.5 px-5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating {format.toUpperCase()}...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Export {format.toUpperCase()} ({matchedItems.length})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
