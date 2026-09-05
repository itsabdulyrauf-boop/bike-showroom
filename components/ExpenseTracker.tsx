'use client';

import React, { useState, useEffect } from 'react';
import { ExpenseRecord, ExpenseCategory } from '@/types';
import { formatPKR } from '@/lib/currency';
import { getAllExpenses, saveExpense, deleteExpense } from '@/lib/db';
import { Pagination } from '@/components/Pagination';
import { DollarSign, Plus, Search, Calendar, Trash2, X, AlertCircle, TrendingDown, Coffee, Building, Wrench, Loader2 } from 'lucide-react';

export const ExpenseTracker: React.FC = () => {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(5);

  // Reset page when filter changes during render
  const [prevFilters, setPrevFilters] = useState({ searchQuery, categoryFilter });
  if (prevFilters.searchQuery !== searchQuery || prevFilters.categoryFilter !== categoryFilter) {
    setPrevFilters({ searchQuery, categoryFilter });
    setCurrentPage(1);
  }

  // Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [formData, setFormData] = useState({
    title: '',
    category: 'Rent' as ExpenseCategory,
    amountPKR: 0,
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'Cash',
    notes: '',
  });

  const [formError, setFormError] = useState<string | null>(null);

  const loadExpenses = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const data = await getAllExpenses();
      setExpenses(data);
    } catch (err) {
      console.error('Error loading expenses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    getAllExpenses()
      .then((data) => {
        if (isMounted) {
          setExpenses(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Error loading expenses:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const openAddModal = () => {
    setFormData({
      title: '',
      category: 'Utilities & Electricity',
      amountPKR: 0,
      date: new Date().toISOString().split('T')[0],
      paymentMethod: 'Cash',
      notes: '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this expense record?')) {
      await deleteExpense(id);
      await loadExpenses();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.title || !formData.amountPKR) {
      setFormError('Please enter expense title and amount in PKR.');
      return;
    }

    setIsSubmitting(true);

    try {
      const newExpense: ExpenseRecord = {
        id: `exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        title: formData.title,
        category: formData.category,
        amountPKR: Number(formData.amountPKR),
        date: formData.date,
        paymentMethod: formData.paymentMethod,
        notes: formData.notes,
        createdAt: new Date().toISOString(),
        syncStatus: 'pending',
      };

      await saveExpense(newExpense);
      setIsModalOpen(false);
      await loadExpenses();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save expense record');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredExpenses = expenses.filter((e) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      e.title.toLowerCase().includes(q) ||
      (e.notes && e.notes.toLowerCase().includes(q)) ||
      e.category.toLowerCase().includes(q);

    const matchesCategory = categoryFilter === 'All' || e.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredExpenses.length / pageSize) || 1;
  const paginatedExpenses = filteredExpenses.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const totalExpensePKR = expenses.reduce((acc, e) => acc + e.amountPKR, 0);

  const categoriesList: ExpenseCategory[] = [
    'Rent',
    'Utilities & Electricity',
    'Staff Salary',
    'Showroom Maintenance',
    'Hospitality & Tea',
    'Transport & Freight',
    'Marketing',
    'Custom Expense',
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner & Summaries */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-slate-400 uppercase">Total Showroom Expenses</span>
            <span className="p-2 bg-rose-950 text-rose-400 rounded-lg border border-rose-800/50">
              <TrendingDown className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-rose-400">
            {formatPKR(totalExpensePKR)}
          </div>
          <p className="text-xs text-slate-400 mt-1">Operational PKR expenditures</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-slate-400 uppercase">Expense Count</span>
            <span className="p-2 bg-amber-950 text-amber-400 rounded-lg border border-amber-800/50">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-white">{expenses.length} Records</div>
          <p className="text-xs text-slate-400 mt-1">Rent, electricity, salaries, tea</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg text-white flex flex-col justify-between">
          <div>
            <span className="text-xs font-mono text-slate-400 uppercase block mb-1">
              Expense Logger
            </span>
            <p className="text-xs text-slate-300">Record daily showroom operational costs</p>
          </div>
          <button
            onClick={openAddModal}
            className="mt-3 w-full py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-600/20"
          >
            <Plus className="w-4 h-4" /> + Record New Expense
          </button>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg text-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search expense description or notes..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto text-xs">
          <span className="text-slate-400 font-mono">Category:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
          >
            <option value="All">All Categories</option>
            {categoriesList.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Expense Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] font-mono border-b border-slate-800">
              <tr>
                <th className="p-4">Expense Title</th>
                <th className="p-4">Category</th>
                <th className="p-4 text-center">Date</th>
                <th className="p-4">Payment Method</th>
                <th className="p-4 text-right">Amount (PKR)</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {paginatedExpenses.length > 0 ? (
                paginatedExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-800/40 transition-all">
                    <td className="p-4 font-bold text-white">
                      {exp.title}
                      {exp.notes && (
                        <span className="block text-xs font-normal text-slate-400">
                          {exp.notes}
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 bg-amber-950 text-amber-300 border border-amber-800/80 rounded-lg text-xs font-medium">
                        {exp.category}
                      </span>
                    </td>
                    <td className="p-4 text-center font-mono text-slate-300">{exp.date}</td>
                    <td className="p-4 text-slate-300">{exp.paymentMethod}</td>
                    <td className="p-4 text-right font-mono font-bold text-rose-400">
                      {formatPKR(exp.amountPKR)}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleDelete(exp.id)}
                        className="p-1.5 bg-slate-800 hover:bg-rose-950 text-rose-400 rounded-lg transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 text-xs">
                    No showroom expense records found.
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
          totalItems={filteredExpenses.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          pageSizeOptions={[5, 10, 20, 50]}
        />
      </div>

      {/* Add Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="bg-slate-800 px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="font-bold text-white text-base font-mono">
                Record Showroom Expense
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

              <div>
                <label className="block text-slate-400 mb-1">Expense Title / Description *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Electricity Bill, Staff Tea & Snacks, Showroom Rent..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-amber-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value as ExpenseCategory })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  >
                    {categoriesList.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Amount (PKR) *</label>
                  <input
                    type="number"
                    value={formData.amountPKR}
                    onChange={(e) => setFormData({ ...formData, amountPKR: Number(e.target.value) })}
                    placeholder="12000"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-rose-400 font-mono font-bold focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Date</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Payment Method</label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Bank Cheque</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Notes / Receipts Reference</label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="e.g. Paid via Meezan Bank Cheque #9821"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
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
                      ? 'bg-amber-700/80 text-white cursor-wait opacity-90'
                      : 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/30'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving Expense...</span>
                    </>
                  ) : (
                    <span>Save Expense</span>
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
