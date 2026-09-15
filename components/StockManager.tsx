'use client';

import React, { useState, useEffect } from 'react';
import { StockEntry, StockStatus, InventoryItem, SaleRecord } from '@/types';
import { formatPKR } from '@/lib/currency';
import {
  getAllStocks,
  saveStockEntry,
  archiveStockEntry,
  getAllInventory,
  getAllSales,
} from '@/lib/db';
import { Pagination } from '@/components/Pagination';
import {
  Layers,
  Plus,
  Search,
  Filter,
  Edit,
  Archive,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  X,
  Boxes,
  TrendingUp,
  Package,
  Bike,
  Calendar,
  Truck,
  FileText,
  Loader2,
  Hash,
  Eye,
  Info,
} from 'lucide-react';

export const StockManager: React.FC = () => {
  const [stocks, setStocks] = useState<StockEntry[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingStock, setEditingStock] = useState<StockEntry | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Archive Confirmation Modal State
  const [stockToArchive, setStockToArchive] = useState<StockEntry | null>(null);
  const [isArchiving, setIsArchiving] = useState<boolean>(false);

  // View Associated Bikes Modal State
  const [viewingStock, setViewingStock] = useState<StockEntry | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Form Fields
  const [formData, setFormData] = useState({
    batchNumber: '',
    stockName: '',
    stockDate: new Date().toISOString().split('T')[0],
    status: 'Active' as StockStatus,
    totalQuantity: 1,
    purchaseCostPKR: 0,
    supplier: '',
    notes: '',
  });

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [stocksData, invData, salesData] = await Promise.all([
        getAllStocks(),
        getAllInventory(),
        getAllSales(),
      ]);
      setStocks(stocksData);
      setInventory(invData);
      setSales(salesData);
    } catch (err) {
      console.error('Error loading stock management data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    Promise.all([getAllStocks(), getAllInventory(), getAllSales()])
      .then(([stocksData, invData, salesData]) => {
        if (isMounted) {
          setStocks(stocksData);
          setInventory(invData);
          setSales(salesData);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Error loading stock management data:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Filtered Stocks
  const filteredStocks = stocks.filter((stock) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      stock.batchNumber.toLowerCase().includes(q) ||
      stock.stockName.toLowerCase().includes(q) ||
      (stock.supplier && stock.supplier.toLowerCase().includes(q)) ||
      (stock.notes && stock.notes.toLowerCase().includes(q));

    const matchesStatus =
      statusFilter === 'All' || stock.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Pagination Slice
  const totalPages = Math.ceil(filteredStocks.length / pageSize) || 1;
  const paginatedStocks = filteredStocks.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Auto-generate next suggested batch number
  const generateNextBatchNumber = (currentList: StockEntry[]) => {
    const year = new Date().getFullYear();
    const nextNum = currentList.length + 1;
    return `STK-${year}-${String(nextNum).padStart(3, '0')}`;
  };

  const handleOpenAddModal = () => {
    setEditingStock(null);
    setFormError(null);
    setFormData({
      batchNumber: generateNextBatchNumber(stocks),
      stockName: '',
      stockDate: new Date().toISOString().split('T')[0],
      status: 'Active',
      totalQuantity: 10,
      purchaseCostPKR: 0,
      supplier: '',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (stock: StockEntry) => {
    setEditingStock(stock);
    setFormError(null);
    setFormData({
      batchNumber: stock.batchNumber,
      stockName: stock.stockName,
      stockDate: stock.stockDate || new Date().toISOString().split('T')[0],
      status: stock.status,
      totalQuantity: stock.totalQuantity || 1,
      purchaseCostPKR: stock.purchaseCostPKR || 0,
      supplier: stock.supplier || '',
      notes: stock.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.batchNumber.trim()) {
      setFormError('Batch number is required.');
      return;
    }
    if (!formData.stockName.trim()) {
      setFormError('Stock name or reference is required.');
      return;
    }
    if (formData.totalQuantity <= 0) {
      setFormError('Unit/Quantity must be greater than zero.');
      return;
    }
    if (formData.purchaseCostPKR < 0) {
      setFormError('Purchase/Investment cost cannot be negative.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const stockEntry: StockEntry = {
        id: editingStock ? editingStock.id : `stock_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        batchNumber: formData.batchNumber.trim().toUpperCase(),
        stockName: formData.stockName.trim(),
        stockDate: formData.stockDate,
        status: formData.status,
        totalQuantity: Number(formData.totalQuantity),
        purchaseCostPKR: Number(formData.purchaseCostPKR),
        supplier: formData.supplier.trim() || undefined,
        notes: formData.notes.trim() || undefined,
        createdAt: editingStock ? editingStock.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        syncStatus: 'pending',
      };

      await saveStockEntry(stockEntry);
      setIsModalOpen(false);
      await loadAllData();
    } catch (err: any) {
      console.error('Error saving stock entry:', err);
      setFormError(err.message || 'Failed to save stock entry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmArchive = async () => {
    if (!stockToArchive) return;
    setIsArchiving(true);
    try {
      await archiveStockEntry(stockToArchive.id, 'Archived via Stock Manager');
      setStockToArchive(null);
      await loadAllData();
    } catch (err) {
      console.error('Failed to archive stock:', err);
    } finally {
      setIsArchiving(false);
    }
  };

  const handleRestoreStock = async (stock: StockEntry) => {
    try {
      await saveStockEntry({
        ...stock,
        status: 'Active',
        updatedAt: new Date().toISOString(),
        syncStatus: 'pending',
      });
      await loadAllData();
    } catch (err) {
      console.error('Failed to restore stock:', err);
    }
  };

  // Aggregated Summary Statistics
  const totalStockInvestmentPKR = stocks.reduce(
    (sum, s) => sum + (Number(s.purchaseCostPKR) || 0),
    0
  );
  const totalDeclaredUnits = stocks.reduce(
    (sum, s) => sum + (Number(s.totalQuantity) || 0),
    0
  );
  const activeStockBatches = stocks.filter((s) => s.status === 'Active').length;
  const completedStockBatches = stocks.filter((s) => s.status === 'Completed').length;
  const archivedStockBatches = stocks.filter((s) => s.status === 'Archived').length;

  // Helper to count inventory items linked to a stock
  const getStockInventoryStats = (stockId: string) => {
    const assignedBikes = inventory.filter((b) => b.stockId === stockId);
    const inStock = assignedBikes.filter((b) => b.status === 'Available').length;
    const sold = assignedBikes.filter((b) => b.status === 'Sold').length;
    return {
      totalAssigned: assignedBikes.length,
      inStock,
      sold,
      bikes: assignedBikes,
    };
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 border border-indigo-900/40 shadow-xl text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-500/20 text-indigo-300 rounded-lg border border-indigo-500/30">
              <Boxes className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold font-mono tracking-tight">Stock & Batch Procurement</h2>
          </div>
          <p className="text-xs text-indigo-200/80 mt-1 max-w-xl">
            Record incoming motorcycle lots, assign stock batches to inventory items, and preserve permanent historical audit trails.
          </p>
        </div>
        <button
          id="btn-add-stock-entry"
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-medium text-sm transition-all shadow-lg shadow-indigo-600/30 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>New Stock Entry</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 backdrop-blur-md p-4 rounded-xl border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Total Stock Batches</p>
            <p className="text-2xl font-bold font-mono text-white mt-1">{stocks.length}</p>
            <p className="text-[11px] text-slate-500 mt-1">
              <span className="text-emerald-400 font-medium">{activeStockBatches} Active</span> •{' '}
              <span className="text-blue-400">{completedStockBatches} Completed</span> •{' '}
              <span className="text-slate-400">{archivedStockBatches} Archived</span>
            </p>
          </div>
          <div className="p-3 bg-indigo-950/60 border border-indigo-800/40 rounded-xl text-indigo-400">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-md p-4 rounded-xl border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Total Batch Investment</p>
            <p className="text-2xl font-bold font-mono text-emerald-400 mt-1">
              {formatPKR(totalStockInvestmentPKR)}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">Across all recorded stock batches</p>
          </div>
          <div className="p-3 bg-emerald-950/60 border border-emerald-800/40 rounded-xl text-emerald-400">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-md p-4 rounded-xl border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Declared Batch Units</p>
            <p className="text-2xl font-bold font-mono text-blue-400 mt-1">{totalDeclaredUnits}</p>
            <p className="text-[11px] text-slate-500 mt-1">Total units received in shipments</p>
          </div>
          <div className="p-3 bg-blue-950/60 border border-blue-800/40 rounded-xl text-blue-400">
            <Package className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-md p-4 rounded-xl border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Inventory Linkage</p>
            <p className="text-2xl font-bold font-mono text-amber-400 mt-1">
              {inventory.filter((b) => b.stockId).length} / {inventory.length}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">Vehicles linked to stock batches</p>
          </div>
          <div className="p-3 bg-amber-950/60 border border-amber-800/40 rounded-xl text-amber-400">
            <Bike className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/80 backdrop-blur-md p-4 rounded-xl border border-slate-800 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="input-search-stocks"
            type="text"
            placeholder="Search by batch #, name, supplier..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          <span className="text-xs text-slate-400 flex items-center gap-1 shrink-0">
            <Filter className="w-3.5 h-3.5" /> Status:
          </span>
          {(['All', 'Active', 'Completed', 'Archived'] as const).map((st) => (
            <button
              key={st}
              id={`filter-stock-${st.toLowerCase()}`}
              onClick={() => {
                setStatusFilter(st);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Stock Batches Table */}
      <div className="bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-sm">Loading stock batches...</p>
          </div>
        ) : filteredStocks.length === 0 ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <Boxes className="w-12 h-12 text-slate-600" />
            <p className="text-base font-medium text-slate-300">No stock entries found</p>
            <p className="text-xs text-slate-500 max-w-sm">
              {searchQuery || statusFilter !== 'All'
                ? 'Try adjusting your search terms or filter.'
                : 'Click "New Stock Entry" to record your first incoming batch of motorcycles or vehicle parts.'}
            </p>
            {stocks.length === 0 && (
              <button
                onClick={handleOpenAddModal}
                className="mt-2 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add First Stock Batch</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Batch # & Name</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Supplier / Source</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-center">Units</th>
                  <th className="py-3.5 px-4 text-right">Batch Cost (PKR)</th>
                  <th className="py-3.5 px-4 text-right">Avg Cost / Unit</th>
                  <th className="py-3.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {paginatedStocks.map((stock) => {
                  const stats = getStockInventoryStats(stock.id);
                  const avgUnitCost =
                    stock.totalQuantity > 0
                      ? Math.round(stock.purchaseCostPKR / stock.totalQuantity)
                      : 0;

                  return (
                    <tr
                      key={stock.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        stock.status === 'Archived' ? 'opacity-70 bg-slate-950/30' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/50">
                            {stock.batchNumber}
                          </span>
                          <span className="font-medium text-slate-100">{stock.stockName}</span>
                        </div>
                        {stock.notes && (
                          <p className="text-[11px] text-slate-400 mt-1 line-clamp-1 italic">
                            {stock.notes}
                          </p>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-300 font-mono">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          <span>{stock.stockDate || stock.createdAt.split('T')[0]}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-300 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 text-slate-500" />
                          <span>{stock.supplier || 'Standard Procurement'}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                            stock.status === 'Active'
                              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/50'
                              : stock.status === 'Completed'
                              ? 'bg-blue-950/80 text-blue-300 border-blue-800/50'
                              : 'bg-slate-800/80 text-slate-400 border-slate-700/50'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              stock.status === 'Active'
                                ? 'bg-emerald-400'
                                : stock.status === 'Completed'
                                ? 'bg-blue-400'
                                : 'bg-slate-400'
                            }`}
                          />
                          {stock.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center whitespace-nowrap font-mono text-xs">
                        <div className="flex flex-col items-center">
                          <span className="font-bold text-slate-200">
                            {stock.totalQuantity} units
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {stats.totalAssigned} assigned ({stats.inStock} in stock, {stats.sold} sold)
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                        {formatPKR(stock.purchaseCostPKR)}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono text-xs text-indigo-300 whitespace-nowrap">
                        {formatPKR(avgUnitCost)}
                      </td>

                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            id={`btn-view-stock-${stock.id}`}
                            onClick={() => setViewingStock(stock)}
                            title="View Associated Inventory Items"
                            className="p-1.5 hover:bg-slate-800 text-indigo-400 hover:text-indigo-300 rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            id={`btn-edit-stock-${stock.id}`}
                            onClick={() => handleOpenEditModal(stock)}
                            title="Edit Stock Entry"
                            className="p-1.5 hover:bg-slate-800 text-blue-400 hover:text-blue-300 rounded-lg transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {stock.status === 'Archived' ? (
                            <button
                              id={`btn-restore-stock-${stock.id}`}
                              onClick={() => handleRestoreStock(stock)}
                              title="Restore to Active Status"
                              className="p-1.5 hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 rounded-lg transition-colors"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              id={`btn-archive-stock-${stock.id}`}
                              onClick={() => setStockToArchive(stock)}
                              title="Archive Stock Entry"
                              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-rose-400 rounded-lg transition-colors"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {filteredStocks.length > pageSize && (
          <div className="p-4 border-t border-slate-800">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              pageSize={pageSize}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setCurrentPage(1);
              }}
              totalItems={filteredStocks.length}
            />
          </div>
        )}
      </div>

      {/* Add / Edit Stock Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-indigo-500/20 text-indigo-300 rounded-lg border border-indigo-500/30">
                  <Boxes className="w-5 h-5" />
                </span>
                <h3 className="text-lg font-bold text-white">
                  {editingStock ? 'Edit Stock Entry' : 'Create New Stock Entry'}
                </h3>
              </div>
              <button
                id="btn-close-stock-modal"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-200 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitForm} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Stock Serial / Batch # <span className="text-rose-400">*</span>
                  </label>
                  <input
                    id="input-stock-batch-number"
                    type="text"
                    required
                    value={formData.batchNumber}
                    onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                    placeholder="e.g. STK-2026-001"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Unique batch or shipment identifier</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Stock Arrival Date <span className="text-rose-400">*</span>
                  </label>
                  <input
                    id="input-stock-date"
                    type="date"
                    required
                    value={formData.stockDate}
                    onChange={(e) => setFormData({ ...formData, stockDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Stock Name or Reference <span className="text-rose-400">*</span>
                </label>
                <input
                  id="input-stock-name"
                  type="text"
                  required
                  value={formData.stockName}
                  onChange={(e) => setFormData({ ...formData, stockName: e.target.value })}
                  placeholder="e.g. Atlas Honda 70cc & 125cc First Lot 2026"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Total Unit / Quantity <span className="text-rose-400">*</span>
                  </label>
                  <input
                    id="input-stock-quantity"
                    type="number"
                    min="1"
                    required
                    value={formData.totalQuantity || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, totalQuantity: Number(e.target.value) || 0 })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Total Purchase Cost (PKR) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    id="input-stock-cost"
                    type="number"
                    min="0"
                    required
                    value={formData.purchaseCostPKR || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, purchaseCostPKR: Number(e.target.value) || 0 })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-emerald-400 font-mono font-bold focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Batch Status
                  </label>
                  <select
                    id="select-stock-status"
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value as StockStatus })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Completed">Completed</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>
              </div>

              {/* Unit Cost Preview */}
              {formData.totalQuantity > 0 && formData.purchaseCostPKR > 0 && (
                <div className="p-3 bg-indigo-950/40 border border-indigo-800/40 rounded-xl flex items-center justify-between text-xs">
                  <span className="text-slate-300">Average Unit Procurement Cost:</span>
                  <span className="font-mono font-bold text-indigo-300 text-sm">
                    {formatPKR(Math.round(formData.purchaseCostPKR / formData.totalQuantity))} / unit
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Supplier / Vendor / Wholesaler
                </label>
                <input
                  id="input-stock-supplier"
                  type="text"
                  value={formData.supplier}
                  onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                  placeholder="e.g. Atlas Honda Ltd. Karachi Plant / Crown Auto"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Notes & References (Optional)
                </label>
                <textarea
                  id="input-stock-notes"
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="e.g. Invoice #98231, container delivery, factory discount applied"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  id="btn-cancel-stock"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-save-stock"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-indigo-600/30 active:scale-95"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>{editingStock ? 'Update Stock Entry' : 'Save Stock Entry'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Archive Confirmation Modal */}
      {stockToArchive && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <span className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                <Archive className="w-6 h-6" />
              </span>
              <div>
                <h3 className="text-base font-bold text-white">Archive Stock Batch?</h3>
                <p className="text-xs text-slate-400 font-mono">
                  {stockToArchive.batchNumber} - {stockToArchive.stockName}
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-xs text-slate-300 space-y-2">
              <div className="flex items-center gap-2 text-indigo-300 font-semibold">
                <Info className="w-4 h-4" />
                <span>Permanent Historical Preservation</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                Stock records are <strong>never permanently deleted</strong> from the database. Archiving keeps all procurement data, vehicle links, and stock-wise profit analytics 100% intact while moving this entry to the Archived list.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                id="btn-cancel-archive"
                onClick={() => setStockToArchive(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-archive"
                disabled={isArchiving}
                onClick={handleConfirmArchive}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-medium transition-all shadow-lg shadow-amber-600/30"
              >
                {isArchiving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Archive className="w-4 h-4" />
                )}
                <span>Archive Stock Entry</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Associated Inventory Items Modal */}
      {viewingStock && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                    {viewingStock.batchNumber}
                  </span>
                  <h3 className="text-lg font-bold text-white">{viewingStock.stockName}</h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Received on {viewingStock.stockDate} • Declared Batch Units: {viewingStock.totalQuantity} • Total Batch Cost: {formatPKR(viewingStock.purchaseCostPKR)}
                </p>
              </div>
              <button
                id="btn-close-viewing-stock"
                onClick={() => setViewingStock(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List of bikes assigned to this stock */}
            {(() => {
              const assigned = inventory.filter((b) => b.stockId === viewingStock.id);
              if (assigned.length === 0) {
                return (
                  <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                    <Bike className="w-8 h-8 text-slate-600" />
                    <p className="text-sm font-medium text-slate-300">No inventory items assigned yet</p>
                    <p className="text-xs text-slate-500 max-w-md">
                      When adding or editing vehicles in the Inventory tab, select this stock batch ({viewingStock.batchNumber}) to assign bikes to this lot.
                    </p>
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Assigned Vehicles: <strong className="text-white">{assigned.length}</strong></span>
                    <span>
                      Available: <strong className="text-emerald-400">{assigned.filter((b) => b.status === 'Available').length}</strong> | Sold: <strong className="text-blue-400">{assigned.filter((b) => b.status === 'Sold').length}</strong>
                    </span>
                  </div>

                  <div className="overflow-x-auto max-h-80 border border-slate-800 rounded-xl">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-950 text-slate-400 font-mono sticky top-0">
                        <tr className="border-b border-slate-800">
                          <th className="py-2.5 px-3">Make & Model</th>
                          <th className="py-2.5 px-3">Chassis #</th>
                          <th className="py-2.5 px-3">Engine #</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                          <th className="py-2.5 px-3 text-right">Purchase (PKR)</th>
                          <th className="py-2.5 px-3 text-right">Selling (PKR)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {assigned.map((b) => (
                          <tr key={b.id} className="hover:bg-slate-800/40">
                            <td className="py-2.5 px-3 font-medium text-slate-200">
                              {b.make} {b.model} {b.variant}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-300">{b.chassisNumber}</td>
                            <td className="py-2.5 px-3 font-mono text-slate-400">{b.engineNumber}</td>
                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${
                                  b.status === 'Available'
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                    : 'bg-blue-950 text-blue-300 border border-blue-800'
                                }`}
                              >
                                {b.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                              {formatPKR(b.purchasePricePKR)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                              {formatPKR(b.sellingPricePKR)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setViewingStock(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
