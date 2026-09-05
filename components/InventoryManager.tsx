'use client';

import React, { useState, useEffect } from 'react';
import { InventoryItem, BikeStatus, InventoryItemType } from '@/types';
import { formatPKR } from '@/lib/currency';
import { getAllInventory, saveInventoryItem, deleteInventoryItem } from '@/lib/db';
import { Pagination } from '@/components/Pagination';
import {
  Package,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Bike,
  CheckCircle2,
  AlertCircle,
  X,
  DollarSign,
  TrendingUp,
  RefreshCw,
  Loader2,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';

export const InventoryManager: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [brandFilter, setBrandFilter] = useState<string>('All');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('Available');

  // Delete Confirmation Modal State
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Reset page when filter changes during render
  const [prevFilters, setPrevFilters] = useState({ searchQuery, brandFilter, typeFilter, statusFilter });
  if (
    prevFilters.searchQuery !== searchQuery ||
    prevFilters.brandFilter !== brandFilter ||
    prevFilters.typeFilter !== typeFilter ||
    prevFilters.statusFilter !== statusFilter
  ) {
    setPrevFilters({ searchQuery, brandFilter, typeFilter, statusFilter });
    setCurrentPage(1);
  }

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    itemType: 'New Bike' as InventoryItemType,
    make: 'Honda',
    model: '',
    variant: '',
    year: new Date().getFullYear().toString(),
    chassisNumber: '',
    engineNumber: '',
    color: '',
    purchasePricePKR: 0,
    sellingPricePKR: 0,
    stockCount: 1,
    status: 'Available' as BikeStatus,
    notes: '',
  });

  const [formError, setFormError] = useState<string | null>(null);

  const loadInventory = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const data = await getAllInventory();
      setItems(data);
    } catch (err) {
      console.error('Error loading inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    getAllInventory()
      .then((data) => {
        if (isMounted) {
          setItems(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Error loading inventory:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({
      itemType: 'New Bike',
      make: 'Honda',
      model: '',
      variant: '',
      year: new Date().getFullYear().toString(),
      chassisNumber: '',
      engineNumber: '',
      color: '',
      purchasePricePKR: 0,
      sellingPricePKR: 0,
      stockCount: 1,
      status: 'Available',
      notes: '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      itemType: item.itemType || 'New Bike',
      make: item.make,
      model: item.model,
      variant: item.variant || '',
      year: item.year || new Date().getFullYear().toString(),
      chassisNumber: item.chassisNumber || '',
      engineNumber: item.engineNumber || '',
      color: item.color || '',
      purchasePricePKR: item.purchasePricePKR || 0,
      sellingPricePKR: item.sellingPricePKR || 0,
      stockCount: item.stockCount ?? 1,
      status: item.status || 'Available',
      notes: item.notes || '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deleteInventoryItem(itemToDelete.id);
      setItems((prev) => prev.filter((i) => i.id !== itemToDelete.id));
      setItemToDelete(null);
      await loadInventory();
    } catch (err: any) {
      console.error('Error deleting inventory item:', err);
      setDeleteError(err?.message || 'Failed to delete record. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.make || !formData.model || !formData.chassisNumber) {
      setFormError('Make/Brand, Model Name, and Chassis / Frame Number are required.');
      return;
    }

    if (formData.itemType !== 'Rickshaw Body' && !formData.engineNumber) {
      setFormError('Engine number is required for motorcycle & auto-rickshaw units.');
      return;
    }

    setIsSubmitting(true);

    try {
      const newItem: InventoryItem = {
        id: editingItem ? editingItem.id : `bike_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        itemType: formData.itemType,
        make: formData.make,
        model: formData.model,
        variant: formData.variant,
        year: formData.year,
        chassisNumber: formData.chassisNumber,
        engineNumber: formData.engineNumber || 'N/A',
        color: formData.color,
        purchasePricePKR: Number(formData.purchasePricePKR),
        sellingPricePKR: Number(formData.sellingPricePKR),
        stockCount: Number(formData.stockCount),
        status: formData.status,
        notes: formData.notes,
        updatedAt: new Date().toISOString(),
        syncStatus: 'pending',
      };

      await saveInventoryItem(newItem);
      setIsModalOpen(false);
      await loadInventory();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save inventory item');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper for type color badges
  const renderTypeBadge = (type?: InventoryItemType) => {
    switch (type) {
      case 'Used Bike':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800 tracking-wide">
            Used Bike
          </span>
        );
      case 'Rickshaw Body':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800 tracking-wide">
            Rickshaw Body
          </span>
        );
      case 'Auto Rickshaw':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-800 tracking-wide">
            Auto Rickshaw
          </span>
        );
      case 'New Bike':
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 tracking-wide">
            New Bike
          </span>
        );
    }
  };

  // Filtering
  const filteredItems = items.filter((item) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      item.model.toLowerCase().includes(q) ||
      item.make.toLowerCase().includes(q) ||
      item.chassisNumber.toLowerCase().includes(q) ||
      item.engineNumber.toLowerCase().includes(q) ||
      (item.itemType && item.itemType.toLowerCase().includes(q)) ||
      item.color.toLowerCase().includes(q);

    const matchesBrand = brandFilter === 'All' || item.make.toLowerCase() === brandFilter.toLowerCase();
    const matchesType = typeFilter === 'All' || (item.itemType || 'New Bike') === typeFilter;
    const matchesStatus = statusFilter === 'All' || item.status === statusFilter;

    return matchesSearch && matchesBrand && matchesType && matchesStatus;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1;
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Analytics Summaries
  const availableItems = items.filter((i) => i.status === 'Available');
  const totalStockCount = availableItems.reduce((acc, i) => acc + i.stockCount, 0);
  const totalStockValuationPKR = availableItems.reduce(
    (acc, i) => acc + i.sellingPricePKR * i.stockCount,
    0
  );

  const newBikesCount = availableItems.filter((i) => !i.itemType || i.itemType === 'New Bike').reduce((a, b) => a + b.stockCount, 0);
  const usedBikesCount = availableItems.filter((i) => i.itemType === 'Used Bike').reduce((a, b) => a + b.stockCount, 0);
  const rickshawBodyCount = availableItems.filter((i) => i.itemType === 'Rickshaw Body' || i.itemType === 'Auto Rickshaw').reduce((a, b) => a + b.stockCount, 0);

  return (
    <div className="space-y-6">
      {/* Top Banner & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-slate-400 uppercase">Available In Stock</span>
            <span className="p-2 bg-blue-950 text-blue-400 rounded-lg border border-blue-800/50">
              <Package className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-white">{totalStockCount} Units</div>
          <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-2 font-mono">
            <span className="text-emerald-400">{newBikesCount} New</span>
            <span>•</span>
            <span className="text-amber-400">{usedBikesCount} Used</span>
            <span>•</span>
            <span className="text-cyan-400">{rickshawBodyCount} Rickshaw/Body</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-slate-400 uppercase">Stock Valuation (PKR)</span>
            <span className="p-2 bg-emerald-950 text-emerald-400 rounded-lg border border-emerald-800/50">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-emerald-400">
            {formatPKR(totalStockValuationPKR)}
          </div>
          <p className="text-xs text-slate-400 mt-1">Total showroom inventory selling rate</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg text-white flex flex-col justify-between">
          <div>
            <span className="text-xs font-mono text-slate-400 uppercase block mb-1">
              Inventory Controls
            </span>
            <p className="text-xs text-slate-300">Add New / Used Bikes or Rickshaw Bodies</p>
          </div>
          <button
            onClick={openAddModal}
            className="mt-3 w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" /> Add New Stock Record
          </button>
        </div>
      </div>

      {/* Filter & Search Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg text-slate-100 flex flex-col space-y-3">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative w-full lg:w-96">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search model, chassis #, engine #, type..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Type Filter Buttons */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl p-1 overflow-x-auto w-full lg:w-auto text-xs">
            <span className="text-slate-400 px-2 font-mono text-[11px]">Type:</span>
            {['All', 'New Bike', 'Used Bike', 'Rickshaw Body', 'Auto Rickshaw'].map((type) => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-all ${
                  typeFilter === type
                    ? 'bg-indigo-600 text-white font-semibold shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Brand & Status Dropdowns */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80 text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <span className="text-slate-400 font-mono text-[11px]">Brand:</span>
            {['All', 'Honda', 'Yamaha', 'Suzuki', 'United', 'Road Prince', 'Sazgar', 'Super Power'].map((brand) => (
              <button
                key={brand}
                onClick={() => setBrandFilter(brand)}
                className={`px-2 py-1 rounded-lg text-xs transition-all ${
                  brandFilter === brand
                    ? 'bg-slate-800 text-indigo-300 font-bold border border-indigo-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {brand}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
            >
              <option value="All">All Statuses</option>
              <option value="Available">Available</option>
              <option value="Sold">Sold</option>
              <option value="Reserved">Reserved</option>
            </select>

            <button
              onClick={() => loadInventory(true)}
              disabled={loading}
              title="Refresh & Pull live data from Cloud"
              className="p-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300 hover:text-white transition-all flex items-center gap-1.5 px-3"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
              <span className="font-mono text-xs">Sync</span>
            </button>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] font-mono border-b border-slate-800">
              <tr>
                <th className="p-4">Item & Model</th>
                <th className="p-4">Type</th>
                <th className="p-4">Chassis / Frame #</th>
                <th className="p-4">Engine Number</th>
                <th className="p-4">Color / Year</th>
                <th className="p-4 text-right">Selling Rate (PKR)</th>
                <th className="p-4 text-center">Stock</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {paginatedItems.length > 0 ? (
                paginatedItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition-all">
                    <td className="p-4 font-bold text-white">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-slate-800 rounded-xl text-indigo-400 border border-slate-700/60">
                          <Bike className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-white text-sm">
                            {item.make} {item.model}
                          </span>
                          {item.variant && (
                            <span className="block text-xs font-normal text-slate-400">
                              {item.variant}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      {renderTypeBadge(item.itemType)}
                    </td>
                    <td className="p-4 font-mono font-bold text-indigo-300 bg-indigo-950/20">
                      {item.chassisNumber}
                    </td>
                    <td className="p-4 font-mono font-bold text-slate-200">
                      {item.engineNumber || 'N/A'}
                    </td>
                    <td className="p-4 text-slate-300">
                      <span className="font-semibold block">{item.color || 'Standard'}</span>
                      <span className="text-xs text-slate-500 font-mono">Model {item.year}</span>
                    </td>
                    <td className="p-4 text-right font-mono font-bold text-emerald-400 text-sm">
                      {formatPKR(item.sellingPricePKR)}
                    </td>
                    <td className="p-4 text-center font-mono font-bold">
                      <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-slate-200">
                        {item.stockCount}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          item.status === 'Available'
                            ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                            : item.status === 'Sold'
                            ? 'bg-slate-800 text-slate-400 border-slate-700'
                            : 'bg-amber-950 text-amber-400 border-amber-800'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(item)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-lg transition-all"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setItemToDelete(item)}
                          className="p-1.5 bg-slate-800 hover:bg-rose-950 text-rose-400 rounded-lg transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500 text-xs">
                    No items matching your search or filters. Click &quot;+ Add New Stock Record&quot; above to create one.
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
          totalItems={filteredItems.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          pageSizeOptions={[5, 10, 20, 50]}
        />
      </div>

      {/* Custom In-App Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="bg-rose-950/80 px-6 py-4 border-b border-rose-900/50 flex items-center gap-3">
              <div className="p-2 bg-rose-900/60 text-rose-300 rounded-xl">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Delete Inventory Record?</h3>
                <p className="text-xs text-rose-200">This action will remove the record from Cloud & Local DB.</p>
              </div>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {deleteError && (
                <div className="bg-rose-950 text-rose-200 border border-rose-800 p-3 rounded-xl">
                  {deleteError}
                </div>
              )}

              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Item:</span>
                  <span className="font-bold text-white text-sm">{itemToDelete.make} {itemToDelete.model}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Type:</span>
                  <span>{renderTypeBadge(itemToDelete.itemType)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Chassis / Frame:</span>
                  <span className="font-mono font-bold text-indigo-300">{itemToDelete.chassisNumber}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Engine #:</span>
                  <span className="font-mono text-slate-200">{itemToDelete.engineNumber || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                  <span className="text-slate-400">Selling Rate:</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">{formatPKR(itemToDelete.sellingPricePKR)}</span>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setItemToDelete(null)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={confirmDelete}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-rose-600/30 transition-all"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Deleting Record...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Yes, Delete Record</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Inventory Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl">
            <div className="bg-slate-800 px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="font-bold text-white text-base font-mono">
                {editingItem ? 'Edit Stock Record' : 'Add New Showroom Stock'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="bg-rose-950 text-rose-200 border border-rose-800 p-3 rounded-xl text-xs">
                  {formError}
                </div>
              )}

              {/* Item Type Selector */}
              <div>
                <label className="block text-slate-400 mb-1.5 font-bold uppercase tracking-wider text-[11px]">
                  Select Item Category / Type *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'New Bike', label: 'New Bike', sub: 'Brand New', icon: '🏍️' },
                    { id: 'Used Bike', label: 'Used Bike', sub: '2nd Hand', icon: '🛵' },
                    { id: 'Rickshaw Body', label: 'Rickshaw Body', sub: 'Body / Loader Frame', icon: '🛺' },
                    { id: 'Auto Rickshaw', label: 'Auto Rickshaw', sub: 'Complete 3-Wheeler', icon: '🛺' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, itemType: t.id as InventoryItemType })}
                      className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                        formData.itemType === t.id
                          ? 'bg-indigo-950/80 border-indigo-500 text-white shadow-lg ring-1 ring-indigo-500'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <div className="text-base mb-1">{t.icon}</div>
                      <span className="font-bold text-white text-xs block">{t.label}</span>
                      <span className="text-[10px] text-slate-400">{t.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Brand / Manufacturer *</label>
                  <select
                    value={formData.make}
                    onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="Honda">Honda</option>
                    <option value="Yamaha">Yamaha</option>
                    <option value="Suzuki">Suzuki</option>
                    <option value="United">United</option>
                    <option value="Road Prince">Road Prince</option>
                    <option value="Super Power">Super Power</option>
                    <option value="Sazgar">Sazgar</option>
                    <option value="New Asia">New Asia</option>
                    <option value="Siwa">Siwa</option>
                    <option value="Qingqi">Qingqi</option>
                    <option value="Crown">Crown</option>
                    <option value="Kawasaki">Kawasaki</option>
                    <option value="Other">Other / Custom Builder</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">
                    {formData.itemType === 'Rickshaw Body' ? 'Body Model / Size *' : 'Model Name *'}
                  </label>
                  <input
                    type="text"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    placeholder={
                      formData.itemType === 'Rickshaw Body'
                        ? '6 Seater, 9 Seater, Loader Body 5ft...'
                        : 'CG 125, CD 70, YBR 125G, GS 150...'
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Variant / Spec / Description</label>
                  <input
                    type="text"
                    value={formData.variant}
                    onChange={(e) => setFormData({ ...formData, variant: e.target.value })}
                    placeholder={
                      formData.itemType === 'Rickshaw Body'
                        ? 'Heavy Duty Hood / Alloy Frame / Passenger...'
                        : 'Self Start / Alloy Rims / Special Edition...'
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Model Year</label>
                  <input
                    type="text"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    placeholder="2026"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">
                    {formData.itemType === 'Rickshaw Body' ? 'Chassis / Frame / Serial # *' : 'Chassis Number *'}
                  </label>
                  <input
                    type="text"
                    value={formData.chassisNumber}
                    onChange={(e) => setFormData({ ...formData, chassisNumber: e.target.value })}
                    placeholder="PAK-HND-..."
                    className="w-full bg-slate-950 border border-indigo-700/50 rounded-xl px-3 py-2 text-indigo-300 font-mono font-bold focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">
                    Engine Number {formData.itemType === 'Rickshaw Body' ? '(Optional for Body)' : '*'}
                  </label>
                  <input
                    type="text"
                    value={formData.engineNumber}
                    onChange={(e) => setFormData({ ...formData, engineNumber: e.target.value })}
                    placeholder={formData.itemType === 'Rickshaw Body' ? 'N/A or Optional' : 'CG125E-...'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono font-bold focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Color</label>
                  <input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    placeholder="Vibrant Red, Gloss Black, Blue, Yellow..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Stock Quantity</label>
                  <input
                    type="number"
                    value={formData.stockCount}
                    onChange={(e) => setFormData({ ...formData, stockCount: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Purchase / Cost Price (PKR)</label>
                  <input
                    type="number"
                    value={formData.purchasePricePKR}
                    onChange={(e) => setFormData({ ...formData, purchasePricePKR: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Selling Rate (PKR) *</label>
                  <input
                    type="number"
                    value={formData.sellingPricePKR}
                    onChange={(e) => setFormData({ ...formData, sellingPricePKR: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-emerald-400 font-mono font-bold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as BikeStatus })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                >
                  <option value="Available">Available for Sale</option>
                  <option value="Sold">Sold</option>
                  <option value="Reserved">Reserved</option>
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-5 py-2 rounded-xl font-bold flex items-center gap-2 transition-all ${
                    isSubmitting
                      ? 'bg-indigo-700/80 text-white cursor-wait opacity-90'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving Record...</span>
                    </>
                  ) : (
                    <span>Save Stock Record</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
