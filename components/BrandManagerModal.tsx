'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { BrandItem, InventoryItem } from '@/types';
import { getAllBrands, saveBrand, deleteBrand, getAllInventory } from '@/lib/db';
import {
  Tag,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Check,
  AlertCircle,
  AlertTriangle,
  Globe,
  Bike,
  ShieldCheck,
  Sparkles,
  Info,
  Loader2,
} from 'lucide-react';

interface BrandManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBrandSelected?: (brandName: string) => void;
  initialBrandName?: string;
  onBrandsUpdated?: () => void;
}

export const BrandManagerModal: React.FC<BrandManagerModalProps> = ({
  isOpen,
  onClose,
  onBrandSelected,
  initialBrandName = '',
  onBrandsUpdated,
}) => {
  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBrandId, setEditingBrandId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Deletion Confirmation State
  const [brandToDelete, setBrandToDelete] = useState<BrandItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Success Notification
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const resetForm = () => {
    setEditingBrandId(null);
    setName('');
    setCountry('');
    setDescription('');
    setStatus('Active');
    setFormError(null);
    setIsFormOpen(false);
  };

  const fetchBrandData = async () => {
    try {
      setLoading(true);
      const [brandList, invList] = await Promise.all([getAllBrands(), getAllInventory()]);
      setBrands(brandList);
      setInventory(invList);
    } catch (err) {
      console.error('Failed to load brands:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseModal = () => {
    resetForm();
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    Promise.all([getAllBrands(), getAllInventory()])
      .then(([brandList, invList]) => {
        if (isMounted) {
          setBrands(brandList);
          setInventory(invList);
          setLoading(false);
          if (initialBrandName && initialBrandName.trim()) {
            setName(initialBrandName.trim());
            setIsFormOpen(true);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load brands:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, initialBrandName]);

  const handleOpenAddForm = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleEditClick = (brand: BrandItem) => {
    setEditingBrandId(brand.id);
    setName(brand.name);
    setCountry(brand.country || '');
    setDescription(brand.description || '');
    setStatus(brand.status);
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleSaveBrand = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError('Brand name is required.');
      return;
    }

    // Check for duplicate name (case insensitive) among other brands
    const duplicate = brands.find(
      (b) => b.id !== editingBrandId && b.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      setFormError(`A brand with the name "${duplicate.name}" already exists.`);
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const now = new Date().toISOString();
      const brandToSave: BrandItem = {
        id: editingBrandId || `brand_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: trimmedName,
        country: country.trim() || undefined,
        description: description.trim() || undefined,
        status,
        createdAt: editingBrandId
          ? brands.find((b) => b.id === editingBrandId)?.createdAt || now
          : now,
        updatedAt: now,
        syncStatus: 'pending',
      };

      await saveBrand(brandToSave);
      setSuccessMessage(
        editingBrandId ? `Brand "${trimmedName}" updated!` : `Brand "${trimmedName}" created successfully!`
      );
      setTimeout(() => setSuccessMessage(null), 3500);

      await fetchBrandData();
      if (onBrandsUpdated) onBrandsUpdated();

      // If called from a dropdown selection context
      if (onBrandSelected) {
        onBrandSelected(brandToSave.name);
        onClose();
        return;
      }

      resetForm();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save brand.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (brand: BrandItem) => {
    try {
      const nextStatus = brand.status === 'Active' ? 'Inactive' : 'Active';
      const updated: BrandItem = {
        ...brand,
        status: nextStatus,
        updatedAt: new Date().toISOString(),
        syncStatus: 'pending',
      };
      await saveBrand(updated);
      setSuccessMessage(`Brand "${brand.name}" set to ${nextStatus}.`);
      setTimeout(() => setSuccessMessage(null), 2500);
      await fetchBrandData();
      if (onBrandsUpdated) onBrandsUpdated();
    } catch (err: any) {
      console.error('Failed to toggle brand status:', err);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!brandToDelete) return;

    setIsDeleting(true);
    try {
      await deleteBrand(brandToDelete.id);
      setSuccessMessage(`Brand "${brandToDelete.name}" deleted.`);
      setTimeout(() => setSuccessMessage(null), 3000);
      setBrandToDelete(null);
      await fetchBrandData();
      if (onBrandsUpdated) onBrandsUpdated();
    } catch (err: any) {
      console.error('Failed to delete brand:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Count bikes matching each brand
  const brandBikeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const bike of inventory) {
      const makeKey = (bike.make || '').toLowerCase().trim();
      counts[makeKey] = (counts[makeKey] || 0) + (bike.stockCount || 1);
    }
    return counts;
  }, [inventory]);

  // Filtered brands
  const filteredBrands = useMemo(() => {
    return brands.filter((brand) => {
      const matchesSearch =
        brand.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (brand.country && brand.country.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (brand.description && brand.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus =
        statusFilter === 'All' ? true : brand.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [brands, searchQuery, statusFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-slate-900 border border-slate-800 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Motorcycle Brands & Manufacturers
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono font-normal">
                  {brands.length} Brands
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Manage dynamic brands for Inventory, Stock Lots, and POS billing dropdowns.
              </p>
            </div>
          </div>
          <button
            onClick={handleCloseModal}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Alert Banner */}
        {successMessage && (
          <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-6 py-2.5 flex items-center gap-2 text-xs text-emerald-300 font-medium">
            <Check className="w-4 h-4 text-emerald-400" />
            {successMessage}
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search brands (e.g. Yamaha, Honda, Crown)..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Status Filter Tabs */}
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                {(['All', 'Active', 'Inactive'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      statusFilter === filter
                        ? 'bg-indigo-600 text-white font-medium shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {!isFormOpen && (
              <button
                onClick={handleOpenAddForm}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add New Brand
              </button>
            )}
          </div>

          {/* Add / Edit Form Drawer */}
          {isFormOpen && (
            <div className="bg-slate-950/80 border border-indigo-500/30 rounded-2xl p-5 shadow-xl space-y-4 animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  {editingBrandId ? 'Edit Brand Details' : 'Register New Brand / Manufacturer'}
                </h3>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors text-xs flex items-center gap-1"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleSaveBrand} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Brand Name */}
                  <div className="sm:col-span-1">
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Brand Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Crown, Honda, Yamaha"
                      required
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 font-medium"
                    />
                  </div>

                  {/* Origin / Country */}
                  <div className="sm:col-span-1">
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Country / Origin <span className="text-slate-500">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="e.g. Pakistan, Japan, China"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Status */}
                  <div className="sm:col-span-1">
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as 'Active' | 'Inactive')}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="Active">Active (Visible in Dropdowns)</option>
                      <option value="Inactive">Inactive (Hidden from Dropdowns)</option>
                    </select>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Description / Popular Models <span className="text-slate-500">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Crown 70cc, 100cc & Cargo Rickshaws"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-600/30 disabled:opacity-50"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        {editingBrandId ? 'Update Brand' : onBrandSelected ? 'Save & Select Brand' : 'Save Brand'}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Brands Grid / List */}
          {loading ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
              <p className="text-sm">Loading dynamic brand catalog...</p>
            </div>
          ) : filteredBrands.length === 0 ? (
            <div className="py-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/30">
              <Tag className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <h4 className="text-sm font-semibold text-slate-300">No brands found</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                {searchQuery
                  ? `No brands match "${searchQuery}".`
                  : 'Start by registering vehicle brands like Yamaha, Honda, Crown, or United.'}
              </p>
              <button
                onClick={handleOpenAddForm}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-medium rounded-xl transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Brand Now
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredBrands.map((brand) => {
                const bikeCount = brandBikeCounts[brand.name.toLowerCase().trim()] || 0;
                return (
                  <div
                    key={brand.id}
                    className={`p-4 rounded-xl border transition-all ${
                      brand.status === 'Active'
                        ? 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                        : 'bg-slate-950/30 border-slate-800/40 opacity-70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-white font-mono tracking-tight">
                            {brand.name}
                          </h4>
                          <span
                            className={`px-2 py-0.5 text-[10px] font-semibold rounded-full uppercase tracking-wider ${
                              brand.status === 'Active'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {brand.status}
                          </span>
                        </div>

                        {brand.country && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-400">
                            <Globe className="w-3.5 h-3.5 text-slate-500" />
                            <span>{brand.country}</span>
                          </div>
                        )}

                        {brand.description && (
                          <p className="text-xs text-slate-400 line-clamp-2 pt-0.5">
                            {brand.description}
                          </p>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 bg-slate-900 border border-slate-800/80 p-1 rounded-xl">
                        {onBrandSelected && (
                          <button
                            onClick={() => {
                              onBrandSelected(brand.name);
                              onClose();
                            }}
                            className="px-2.5 py-1 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
                            title="Select this brand"
                          >
                            Select
                          </button>
                        )}
                        <button
                          onClick={() => handleToggleStatus(brand)}
                          className={`p-1.5 rounded-lg text-xs transition-colors ${
                            brand.status === 'Active'
                              ? 'text-slate-400 hover:text-amber-400 hover:bg-slate-800'
                              : 'text-slate-500 hover:text-emerald-400 hover:bg-slate-800'
                          }`}
                          title={brand.status === 'Active' ? 'Deactivate brand' : 'Activate brand'}
                        >
                          {brand.status === 'Active' ? 'Active' : 'Inactive'}
                        </button>
                        <button
                          onClick={() => handleEditClick(brand)}
                          className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition-colors"
                          title="Edit brand"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setBrandToDelete(brand)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                          title="Delete brand"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Footer stats: units in showroom inventory */}
                    <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <div className="flex items-center gap-1.5">
                        <Bike className="w-3.5 h-3.5 text-indigo-400" />
                        <span>
                          {bikeCount > 0 ? (
                            <strong className="text-white font-semibold">{bikeCount}</strong>
                          ) : (
                            '0'
                          )}{' '}
                          units in stock
                        </span>
                      </div>
                      <span className="text-slate-500">
                        Added {new Date(brand.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-indigo-400" />
            <span>Active brands are immediately available across Inventory and Quick POS dropdowns.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl transition-colors"
          >
            Done
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {brandToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white">
                Delete Brand &quot;{brandToDelete.name}&quot;?
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Are you sure you want to remove this brand? It will be removed from your catalog and
                all dropdown selection menus.
              </p>

              {(brandBikeCounts[brandToDelete.name.toLowerCase().trim()] || 0) > 0 && (
                <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>Notice:</strong> There are currently{' '}
                    {brandBikeCounts[brandToDelete.name.toLowerCase().trim()]} bike(s) in showroom inventory
                    registered under &quot;{brandToDelete.name}&quot;. Those inventory records will remain intact,
                    but this brand will no longer appear in new dropdowns.
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setBrandToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-rose-600/20 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Confirm Delete
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
