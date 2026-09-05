'use client';

import React, { useState, useEffect } from 'react';
import { CustomerItem } from '@/types';
import { formatPKR } from '@/lib/currency';
import { getAllCustomers, saveCustomer, deleteCustomer } from '@/lib/db';
import { Pagination } from '@/components/Pagination';
import { Users, UserPlus, Search, Phone, MapPin, CreditCard, Trash2, X, AlertCircle, Loader2 } from 'lucide-react';

export const CustomerManager: React.FC = () => {
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(6);

  // Reset page when search changes during render
  const [prevSearchQuery, setPrevSearchQuery] = useState(searchQuery);
  if (prevSearchQuery !== searchQuery) {
    setPrevSearchQuery(searchQuery);
    setCurrentPage(1);
  }

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    cnic: '',
    address: '',
  });

  const [formError, setFormError] = useState<string | null>(null);

  const loadCustomers = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const data = await getAllCustomers();
      setCustomers(data);
    } catch (err) {
      console.error('Error loading customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    getAllCustomers()
      .then((data) => {
        if (isMounted) {
          setCustomers(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Error loading customers:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const openAddModal = () => {
    setFormData({
      name: '',
      phone: '',
      cnic: '',
      address: '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this customer record?')) {
      await deleteCustomer(id);
      await loadCustomers();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.name) {
      setFormError('Customer name is required.');
      return;
    }

    setIsSubmitting(true);

    try {
      const newCust: CustomerItem = {
        id: `cust_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: formData.name,
        phone: formData.phone,
        cnic: formData.cnic,
        address: formData.address,
        totalPurchasesCount: 0,
        totalSpentPKR: 0,
        createdAt: new Date().toISOString(),
        syncStatus: 'pending',
      };

      await saveCustomer(newCust);
      setIsModalOpen(false);
      await loadCustomers();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save customer record');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCustomers = customers.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      c.cnic.includes(q) ||
      c.address.toLowerCase().includes(q)
    );
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredCustomers.length / pageSize) || 1;
  const paginatedCustomers = filteredCustomers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-purple-950 text-purple-400 rounded-lg border border-purple-800/50">
              <Users className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-bold font-mono tracking-tight">Registered Customers Database</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Customer directories, CNIC identification records, and purchase ledgers
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="py-2.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-purple-600/20"
        >
          <UserPlus className="w-4 h-4" /> Add New Customer
        </button>
      </div>

      {/* Search Input */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg text-slate-100 flex items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search customer name, phone, or CNIC..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
          />
        </div>

        <span className="text-xs text-slate-400 font-mono hidden sm:inline">
          Total Registered: <strong className="text-white">{customers.length}</strong>
        </span>
      </div>

      {/* Customer Grid Cards */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedCustomers.length > 0 ? (
            paginatedCustomers.map((cust) => (
              <div
                key={cust.id}
                className="bg-slate-950 border border-slate-800/80 hover:border-slate-700 rounded-2xl p-5 shadow-lg text-slate-100 flex flex-col justify-between transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <h3 className="font-bold text-white text-base leading-snug">{cust.name}</h3>
                      <p className="text-xs font-mono text-purple-400">
                        CNIC: {cust.cnic || 'N/A'}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(cust.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-300 mb-4 bg-slate-900 p-3 rounded-xl border border-slate-800/80">
                    <p className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="font-mono">{cust.phone || 'No phone provided'}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{cust.address || 'Karachi, Pakistan'}</span>
                    </p>
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-3 flex justify-between items-center text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">Purchases</span>
                    <span className="font-bold text-white">{cust.totalPurchasesCount} Bike(s)</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block uppercase">Total Spent</span>
                    <span className="font-bold text-emerald-400">{formatPKR(cust.totalSpentPKR)}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-12 bg-slate-950 border border-slate-800 rounded-2xl text-slate-500 text-xs">
              No customers found matching search query.
            </div>
          )}
        </div>

        {/* Pagination Controls */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filteredCustomers.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          pageSizeOptions={[6, 12, 24, 48]}
        />
      </div>

      {/* Add Customer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="bg-slate-800 px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="font-bold text-white text-base font-mono">
                Add New Showroom Customer
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
                <label className="block text-slate-400 mb-1">Customer Full Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Muhammad Tariq Khan"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Mobile Phone Number</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="0300-1234567"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">National ID / CNIC #</label>
                <input
                  type="text"
                  value={formData.cnic}
                  onChange={(e) => setFormData({ ...formData, cnic: e.target.value })}
                  placeholder="42101-9823411-3"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Residential / City Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="House #12, Block 4, Karachi"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-purple-500"
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
                      ? 'bg-purple-700/80 text-white cursor-wait opacity-90'
                      : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving Customer...</span>
                    </>
                  ) : (
                    <span>Save Customer</span>
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
