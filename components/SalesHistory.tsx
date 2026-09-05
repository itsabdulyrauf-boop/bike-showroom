'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { SaleRecord } from '@/types';
import { formatPKR } from '@/lib/currency';
import { getAllSales, deleteSaleRecord } from '@/lib/db';
import { Pagination } from '@/components/Pagination';
import {
  Receipt,
  Search,
  Printer,
  CheckCircle2,
  Clock,
  DollarSign,
  Bike,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
  TrendingUp,
  X,
  CreditCard,
  AlertCircle,
  Trash2,
  RotateCcw,
} from 'lucide-react';

interface SalesHistoryProps {
  onSelectSale: (sale: SaleRecord) => void;
}

export const SalesHistory: React.FC<SalesHistoryProps> = ({ onSelectSale }) => {
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [selectedMonth, setSelectedMonth] = useState<string>('all'); // 'all' | 'YYYY-MM'

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [saleToDelete, setSaleToDelete] = useState<SaleRecord | null>(null);
  const [restoreStockOnDelete, setRestoreStockOnDelete] = useState<boolean>(true);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const loadSales = useCallback(() => {
    getAllSales()
      .then((data) => {
        setSales(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error loading sales history:', err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  const handleDeleteConfirm = async () => {
    if (!saleToDelete) return;
    setIsDeleting(true);
    try {
      await deleteSaleRecord(saleToDelete.id, restoreStockOnDelete);
      setSaleToDelete(null);
      loadSales();
    } catch (err) {
      console.error('Failed to delete sale:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Compute available unique months from sales data
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    // Always include current month
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    monthsSet.add(currentYearMonth);

    // Also include previous month
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevYearMonth = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
    monthsSet.add(prevYearMonth);

    sales.forEach((s) => {
      try {
        const d = new Date(s.createdAt);
        if (!isNaN(d.getTime())) {
          const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          monthsSet.add(ym);
        }
      } catch {
        // ignore invalid dates
      }
    });

    return Array.from(monthsSet).sort().reverse();
  }, [sales]);

  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const lastMonthKey = useMemo(() => {
    const now = new Date();
    const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  // Format YYYY-MM to readable label e.g., "August 2026"
  const formatMonthLabel = (ym: string) => {
    if (ym === 'all') return 'All Time';
    const [year, month] = ym.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  // Month navigation helpers
  const handlePrevMonth = () => {
    let ym = selectedMonth === 'all' ? currentMonthKey : selectedMonth;
    const [year, month] = ym.split('-').map(Number);
    const prev = new Date(year, month - 2, 1);
    const newYm = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(newYm);
  };

  const handleNextMonth = () => {
    let ym = selectedMonth === 'all' ? currentMonthKey : selectedMonth;
    const [year, month] = ym.split('-').map(Number);
    const next = new Date(year, month, 1);
    const newYm = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(newYm);
  };

  // Filter sales
  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      // Month filter
      if (selectedMonth !== 'all') {
        try {
          const d = new Date(s.createdAt);
          if (!isNaN(d.getTime())) {
            const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (ym !== selectedMonth) return false;
          }
        } catch {
          return false;
        }
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesInvoice = s.invoiceNumber.toLowerCase().includes(q);
        const matchesAccount = Boolean(s.accountNumber && s.accountNumber.toLowerCase().includes(q));
        const matchesCustomer =
          s.customerName.toLowerCase().includes(q) || (s.customerPhone && s.customerPhone.includes(q));
        const matchesItems = s.items.some(
          (i) =>
            i.model.toLowerCase().includes(q) ||
            i.make.toLowerCase().includes(q) ||
            (i.chassisNumber && i.chassisNumber.toLowerCase().includes(q)) ||
            (i.engineNumber && i.engineNumber.toLowerCase().includes(q))
        );
        if (!matchesInvoice && !matchesAccount && !matchesCustomer && !matchesItems) return false;
      }

      // Status filter
      if (statusFilter !== 'All' && s.paymentStatus !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [sales, selectedMonth, searchQuery, statusFilter]);

  // Compute metrics for the currently filtered / selected month
  const monthlyMetrics = useMemo(() => {
    // Sales strictly matching the selected month (regardless of search/status so stats are accurate for the month)
    const monthSales = selectedMonth === 'all'
      ? sales
      : sales.filter((s) => {
          try {
            const d = new Date(s.createdAt);
            const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            return ym === selectedMonth;
          } catch {
            return false;
          }
        });

    const totalRevenuePKR = monthSales.reduce((acc, s) => acc + (Number(s.totalPKR) || 0), 0);
    const totalPaidPKR = monthSales.reduce((acc, s) => {
      if (s.paymentStatus === 'Paid') return acc + (Number(s.totalPKR) || 0);
      const paid = Number(s.paidAmountPKR) || 0;
      return acc + Math.min(Number(s.totalPKR) || 0, Math.max(0, paid));
    }, 0);
    const totalBalancePKR = Math.max(0, totalRevenuePKR - totalPaidPKR);
    const totalBikesCount = monthSales.reduce(
      (acc, s) => acc + s.items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0),
      0
    );
    const paidInvoicesCount = monthSales.filter((s) => s.paymentStatus === 'Paid' || (s.balancePKR || 0) <= 0).length;

    return {
      invoiceCount: monthSales.length,
      totalRevenuePKR,
      totalPaidPKR,
      totalBalancePKR,
      totalBikesCount,
      paidInvoicesCount,
    };
  }, [sales, selectedMonth]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredSales.length / pageSize) || 1;
  const paginatedSales = filteredSales.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-indigo-950 text-indigo-400 rounded-xl border border-indigo-800/60 shadow-inner">
              <Receipt className="w-6 h-6" />
            </span>
            <div>
              <h2 className="text-xl font-bold font-mono tracking-tight text-white">
                Sales & Invoices Ledger
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Monthly sales analysis, customer invoices, and motorcycle sales tracking
              </p>
            </div>
          </div>
        </div>

        {/* Active Month Indicator Badge */}
        <div className="flex items-center gap-2 bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 font-mono text-xs shadow-inner">
          <Calendar className="w-4 h-4 text-indigo-400" />
          <span className="text-slate-400">Viewing:</span>
          <span className="font-bold text-emerald-400 uppercase tracking-wider">
            {formatMonthLabel(selectedMonth)}
          </span>
          {selectedMonth !== 'all' && (
            <button
              onClick={() => setSelectedMonth('all')}
              className="ml-2 text-slate-400 hover:text-white transition-colors"
              title="Clear month filter (view all)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Monthly Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Month Quick Select & Navigation */}
        <div className="flex items-center flex-wrap gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono mr-1">
            <Filter className="w-3.5 h-3.5 text-indigo-400" />
            <span>Month Filter:</span>
          </div>

          {/* Quick Buttons */}
          <button
            onClick={() => setSelectedMonth('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-mono transition-all ${
              selectedMonth === 'all'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700'
            }`}
          >
            All Time
          </button>

          <button
            onClick={() => setSelectedMonth(currentMonthKey)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-mono transition-all ${
              selectedMonth === currentMonthKey
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700'
            }`}
          >
            This Month
          </button>

          <button
            onClick={() => setSelectedMonth(lastMonthKey)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-mono transition-all ${
              selectedMonth === lastMonthKey
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700'
            }`}
          >
            Last Month
          </button>

          {/* Month Selector Dropdown with Next / Prev */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1">
            <button
              onClick={handlePrevMonth}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs font-mono font-medium text-white px-2 py-1 focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900 text-white">
                All Months
              </option>
              {availableMonths.map((ym) => (
                <option key={ym} value={ym} className="bg-slate-900 text-white">
                  {formatMonthLabel(ym)} {ym === currentMonthKey ? '(Current)' : ''}
                </option>
              ))}
            </select>

            <button
              onClick={handleNextMonth}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search & Status Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search invoice, A/C no, customer, bike..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            {['All', 'Paid', 'Partial', 'Unpaid'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  statusFilter === st
                    ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly Sales Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Monthly Revenue */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
              {selectedMonth === 'all' ? 'Total Sales' : 'Monthly Sales'}
            </span>
            <span className="p-2 bg-emerald-950 text-emerald-400 rounded-lg border border-emerald-800/50">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-black font-mono text-emerald-400">
            {formatPKR(monthlyMetrics.totalRevenuePKR)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-mono">
            {monthlyMetrics.invoiceCount} Invoice(s) in {formatMonthLabel(selectedMonth)}
          </p>
        </div>

        {/* Units / Bikes Sold */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
              Bikes Sold
            </span>
            <span className="p-2 bg-indigo-950 text-indigo-400 rounded-lg border border-indigo-800/50">
              <Bike className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-black font-mono text-indigo-300">
            {monthlyMetrics.totalBikesCount} Units
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-mono">
            Motorcycles sold during period
          </p>
        </div>

        {/* Cash Collected / Received */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
              Received (Cash/Bank)
            </span>
            <span className="p-2 bg-blue-950 text-blue-400 rounded-lg border border-blue-800/50">
              <CreditCard className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-black font-mono text-blue-300">
            {formatPKR(monthlyMetrics.totalPaidPKR)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-mono">
            {monthlyMetrics.paidInvoicesCount} Fully Paid Invoices
          </p>
        </div>

        {/* Outstanding / Due Balance */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
              Outstanding Balance
            </span>
            <span className="p-2 bg-rose-950 text-rose-400 rounded-lg border border-rose-800/50">
              <AlertCircle className="w-4 h-4" />
            </span>
          </div>
          <div
            className={`text-xl font-black font-mono ${
              monthlyMetrics.totalBalancePKR > 0 ? 'text-rose-400' : 'text-slate-300'
            }`}
          >
            {formatPKR(monthlyMetrics.totalBalancePKR)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-mono">
            Pending customer receivables
          </p>
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {/* Table Header Bar with Results Count */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">
              Showing <strong className="text-white">{filteredSales.length}</strong> sales invoice(s)
              {selectedMonth !== 'all' && (
                <> for <strong className="text-indigo-400">{formatMonthLabel(selectedMonth)}</strong></>
              )}
            </span>
          </div>
          {filteredSales.length > 0 && (
            <span className="text-xs font-mono text-emerald-400 font-bold">
              Subtotal: {formatPKR(filteredSales.reduce((acc, s) => acc + s.totalPKR, 0))}
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] font-mono border-b border-slate-800">
              <tr>
                <th className="p-4">Invoice # & Date</th>
                <th className="p-4">Account No</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Vehicle / Item Details</th>
                <th className="p-4 text-right">Grand Total (PKR)</th>
                <th className="p-4 text-center">Payment</th>
                <th className="p-4 text-center">Sync</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {paginatedSales.length > 0 ? (
                paginatedSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-800/40 transition-all">
                    <td className="p-4 font-mono font-bold text-white">
                      <div className="flex items-center gap-2">
                        <span>#{sale.invoiceNumber}</span>
                      </div>
                      <span className="block text-[11px] font-normal text-slate-400 mt-0.5">
                        {new Date(sale.createdAt).toLocaleDateString('en-PK', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </td>
                    <td className="p-4">
                      {sale.accountNumber ? (
                        <span className="inline-block font-mono text-xs font-semibold text-indigo-300 bg-indigo-950/70 px-2 py-1 rounded-lg border border-indigo-800/70" title={`Account No: ${sale.accountNumber}`}>
                          {sale.accountNumber}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-600 font-mono italic">—</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className="font-bold text-white block">{sale.customerName}</span>
                      <span className="text-xs font-mono text-slate-400">
                        {sale.customerPhone || 'No Phone'}
                      </span>
                    </td>
                    <td className="p-4">
                      {sale.items.map((item, idx) => (
                        <div key={idx} className="text-xs mb-1.5 last:mb-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-indigo-300">
                              {item.make} {item.model}
                            </span>
                            {item.itemType && (
                              <span
                                className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider ${
                                  item.itemType === 'Used Bike'
                                    ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                    : item.itemType === 'Rickshaw Body'
                                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                                    : item.itemType === 'Auto Rickshaw'
                                    ? 'bg-purple-950 text-purple-300 border border-purple-800'
                                    : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                }`}
                              >
                                {item.itemType}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
                            Frame/Chassis: {item.chassisNumber} {item.engineNumber && item.engineNumber !== 'N/A' ? `| Eng: ${item.engineNumber}` : ''}
                          </span>
                        </div>
                      ))}
                    </td>
                    <td className="p-4 text-right font-mono font-bold text-emerald-400">
                      {formatPKR(sale.totalPKR)}
                      {sale.balancePKR > 0 && (
                        <span className="block text-[10px] text-rose-400 font-normal">
                          Due: {formatPKR(sale.balancePKR)}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          sale.paymentStatus === 'Paid'
                            ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                            : sale.paymentStatus === 'Partial'
                            ? 'bg-amber-950 text-amber-400 border-amber-800'
                            : 'bg-rose-950 text-rose-400 border-rose-800'
                        }`}
                      >
                        {sale.paymentStatus}
                      </span>
                      <span className="block text-[10px] text-slate-500 mt-0.5">
                        {sale.paymentMethod}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      {sale.syncStatus === 'synced' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                          <CheckCircle2 className="w-3 h-3" /> Synced
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800">
                          <Clock className="w-3 h-3" /> Pending
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onSelectSale(sale)}
                          className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow transition-all hover:shadow-indigo-600/25"
                          title="View / Print Tax Invoice"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Print</span>
                        </button>
                        <button
                          onClick={() => setSaleToDelete(sale)}
                          className="p-1.5 bg-slate-800 hover:bg-rose-950/80 hover:text-rose-400 text-slate-400 border border-slate-700 hover:border-rose-800 rounded-lg text-xs transition-all"
                          title="Delete / Cancel Invoice"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-slate-400 text-xs">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Calendar className="w-8 h-8 text-slate-600" />
                      <p className="text-sm font-medium text-slate-300">
                        No sales found for {formatMonthLabel(selectedMonth)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {searchQuery || statusFilter !== 'All'
                          ? 'Try resetting the search query or status filter.'
                          : 'Select a different month or view all sales.'}
                      </p>
                      {selectedMonth !== 'all' && (
                        <button
                          onClick={() => setSelectedMonth('all')}
                          className="mt-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-colors"
                        >
                          View All Sales
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filteredSales.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          pageSizeOptions={[5, 10, 20, 50]}
        />
      </div>

      {/* Delete Confirmation Modal */}
      {saleToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-400 mb-4">
              <div className="p-2.5 bg-rose-950/80 border border-rose-800 rounded-xl">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete Invoice #{saleToDelete.invoiceNumber}</h3>
                <p className="text-xs text-slate-400">This will remove the sale record from Database & Cloud.</p>
              </div>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs space-y-1 mb-4">
              <div className="flex justify-between">
                <span className="text-slate-400">Customer:</span>
                <span className="font-bold text-white">{saleToDelete.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Amount:</span>
                <span className="font-mono font-bold text-emerald-400">{formatPKR(saleToDelete.totalPKR)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Items:</span>
                <span className="text-indigo-300">
                  {saleToDelete.items.map((it) => `${it.make} ${it.model}`).join(', ')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-6 bg-indigo-950/40 border border-indigo-900/50 p-3 rounded-xl">
              <input
                type="checkbox"
                id="restoreStock"
                checked={restoreStockOnDelete}
                onChange={(e) => setRestoreStockOnDelete(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 bg-slate-800 border-slate-700 focus:ring-indigo-500"
              />
              <label htmlFor="restoreStock" className="text-xs text-slate-200 cursor-pointer select-none">
                <span className="font-bold block text-indigo-300">Restore Inventory Stock & Status</span>
                <span className="text-[11px] text-slate-400">Make the vehicle(s) Available in inventory again</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setSaleToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-rose-600/25 flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

