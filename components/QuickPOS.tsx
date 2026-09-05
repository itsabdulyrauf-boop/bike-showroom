'use client';

import React, { useState, useEffect } from 'react';
import {
  InventoryItem,
  CustomerItem,
  SaleItem,
  SaleRecord,
  PaymentMethod,
  RegistrationStatus,
  ShowroomSettings,
  InventoryItemType,
} from '@/types';
import { formatPKR } from '@/lib/currency';
import {
  getAllInventory,
  getAllCustomers,
  saveSaleRecord,
} from '@/lib/db';
import {
  ShoppingBag,
  User,
  Search,
  Plus,
  Bike,
  Trash2,
  DollarSign,
  Shield,
  FileCheck,
  CheckCircle,
  AlertCircle,
  Sparkles,
  CreditCard,
  UserPlus,
  Loader2,
} from 'lucide-react';

interface QuickPOSProps {
  onSaleComplete: (sale: SaleRecord) => void;
  settings: ShowroomSettings;
}

function generateInvoiceNumber() {
  return `INV-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
}

function generateSaleId() {
  return `sale_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

export const QuickPOS: React.FC<QuickPOSProps> = ({ onSaleComplete, settings }) => {
  // Data Sources
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Customer Selection State
  const [customerMode, setCustomerMode] = useState<'search' | 'manual'>('search');
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(null);

  // Manual Customer Form
  const [manualCustomer, setManualCustomer] = useState({
    name: '',
    phone: '',
    cnic: '',
    address: '',
  });

  // Bike / Item Selection State
  const [itemMode, setItemMode] = useState<'inventory' | 'custom'>('inventory');
  const [bikeSearchQuery, setBikeSearchQuery] = useState<string>('');
  const [cartItems, setCartItems] = useState<SaleItem[]>([]);

  // Custom Unregistered Bike Form
  const [customBike, setCustomBike] = useState({
    itemType: 'New Bike' as InventoryItemType,
    make: 'Honda',
    model: '',
    variant: '',
    chassisNumber: '',
    engineNumber: '',
    color: '',
    year: new Date().getFullYear().toString(),
    pricePKR: 0,
  });

  // Financial & Sale Parameters
  const [discountPKR, setDiscountPKR] = useState<number>(0);
  const [taxPKR, setTaxPKR] = useState<number>(0);
  const [paidAmountPKR, setPaidAmountPKR] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [warrantyMonths, setWarrantyMonths] = useState<number>(12);
  const [registrationStatus, setRegistrationStatus] =
    useState<RegistrationStatus>('Showroom Registration');
  const [saleNotes, setSaleNotes] = useState<string>('');

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Load Inventory & Customers
  const loadData = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const invData = await getAllInventory();
      const availableInv = invData.filter((i) => i.status === 'Available' && i.stockCount > 0);
      setInventory(availableInv);

      const custData = await getAllCustomers();
      setCustomers(custData);
    } catch (err) {
      console.error('Error loading POS data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    Promise.all([getAllInventory(), getAllCustomers()])
      .then(([invData, custData]) => {
        if (isMounted) {
          const availableInv = invData.filter((i) => i.status === 'Available' && i.stockCount > 0);
          setInventory(availableInv);
          setCustomers(custData);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Error loading POS data:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Filtered Inventory
  const filteredInventory = inventory.filter((item) => {
    const q = bikeSearchQuery.toLowerCase();
    return (
      item.model.toLowerCase().includes(q) ||
      item.make.toLowerCase().includes(q) ||
      item.chassisNumber.toLowerCase().includes(q) ||
      item.engineNumber.toLowerCase().includes(q) ||
      item.color.toLowerCase().includes(q)
    );
  });

  // Filtered Customers
  const filteredCustomers = customers.filter((cust) => {
    const q = customerSearchQuery.toLowerCase();
    return (
      cust.name.toLowerCase().includes(q) ||
      cust.phone.includes(q) ||
      cust.cnic.includes(q)
    );
  });

  // Add Inventory Item to Cart
  const handleAddInventoryToCart = (item: InventoryItem) => {
    // Check if item already in cart
    const exists = cartItems.some((ci) => ci.bikeId === item.id);
    if (exists) {
      setFormError('This specific bike / chassis is already in your checkout list.');
      return;
    }

    const newItem: SaleItem = {
      bikeId: item.id,
      itemType: item.itemType || 'New Bike',
      make: item.make,
      model: item.model,
      variant: item.variant,
      chassisNumber: item.chassisNumber,
      engineNumber: item.engineNumber,
      color: item.color,
      year: item.year,
      pricePKR: item.sellingPricePKR,
      quantity: 1,
    };

    setCartItems([...cartItems, newItem]);
    if (paidAmountPKR === 0) {
      setPaidAmountPKR(item.sellingPricePKR);
    } else {
      setPaidAmountPKR((prev) => prev + item.sellingPricePKR);
    }
    setFormError(null);
  };

  // Add Custom Manual Bike / Item to Cart
  const handleAddCustomBikeToCart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customBike.make || !customBike.model) {
      setFormError('Please specify brand/make and model for this item.');
      return;
    }

    if (customBike.pricePKR <= 0) {
      setFormError('Please enter a valid selling rate (PKR).');
      return;
    }

    const isRickshawBody = customBike.itemType === 'Rickshaw Body';
    const fallbackId = Date.now().toString().slice(-6);

    const newItem: SaleItem = {
      itemType: customBike.itemType,
      make: customBike.make,
      model: customBike.model,
      variant: customBike.variant || (isRickshawBody ? 'Rickshaw Body Unit' : 'Standard'),
      chassisNumber: customBike.chassisNumber || `CH-${fallbackId}`,
      engineNumber: isRickshawBody ? (customBike.engineNumber || 'N/A') : (customBike.engineNumber || `ENG-${fallbackId}`),
      color: customBike.color || 'Standard',
      year: customBike.year || new Date().getFullYear().toString(),
      pricePKR: Number(customBike.pricePKR) || 0,
      quantity: 1,
    };

    setCartItems([...cartItems, newItem]);
    setPaidAmountPKR((prev) => prev + newItem.pricePKR);
    setFormError(null);

    // Reset custom bike form
    setCustomBike({
      itemType: 'New Bike',
      make: 'Honda',
      model: '',
      variant: '',
      chassisNumber: '',
      engineNumber: '',
      color: '',
      year: new Date().getFullYear().toString(),
      pricePKR: 0,
    });
  };

  const handleRemoveFromCart = (index: number) => {
    const updated = [...cartItems];
    const removed = updated.splice(index, 1)[0];
    setCartItems(updated);
    if (removed) {
      setPaidAmountPKR((prev) => Math.max(0, prev - removed.pricePKR));
    }
  };

  // Computations
  const subtotalPKR = cartItems.reduce((acc, item) => acc + item.pricePKR * item.quantity, 0);
  const totalPKR = Math.max(0, subtotalPKR - discountPKR + taxPKR);
  const balancePKR = Math.max(0, totalPKR - paidAmountPKR);

  // Finalize Sale
  const handleCheckout = async () => {
    setFormError(null);

    if (cartItems.length === 0) {
      setFormError('Please add at least one motorcycle to checkout.');
      return;
    }

    let custName = '';
    let custPhone = '';
    let custCnic = '';
    let custAddress = '';
    let customerId = undefined;

    if (customerMode === 'search') {
      if (!selectedCustomer) {
        setFormError('Please select a customer or switch to manual customer entry.');
        return;
      }
      custName = selectedCustomer.name;
      custPhone = selectedCustomer.phone;
      custCnic = selectedCustomer.cnic;
      custAddress = selectedCustomer.address;
      customerId = selectedCustomer.id;
    } else {
      if (!manualCustomer.name) {
        setFormError('Please enter customer full name.');
        return;
      }
      custName = manualCustomer.name;
      custPhone = manualCustomer.phone;
      custCnic = manualCustomer.cnic;
      custAddress = manualCustomer.address;
    }

    setIsSubmitting(true);

    try {
      const invoiceNumber = generateInvoiceNumber();

      const actualPaid = paidAmountPKR >= totalPKR ? totalPKR : Math.max(0, paidAmountPKR);
      const paymentStatus =
        actualPaid >= totalPKR
          ? 'Paid'
          : actualPaid > 0
          ? 'Partial'
          : 'Unpaid';

      const newSale: SaleRecord = {
        id: generateSaleId(),
        invoiceNumber,
        customerId,
        customerName: custName,
        customerPhone: custPhone,
        customerCnic: custCnic,
        customerAddress: custAddress,
        items: cartItems,
        subtotalPKR,
        discountPKR,
        taxPKR,
        totalPKR,
        paidAmountPKR: actualPaid,
        balancePKR: Math.max(0, totalPKR - actualPaid),
        paymentMethod,
        paymentStatus,
        accountNumber: accountNumber.trim() || undefined,
        warrantyMonths,
        registrationStatus,
        notes: saleNotes,
        createdAt: new Date().toISOString(),
        syncStatus: 'pending',
      };

      // Save to IndexedDB (offline-first!)
      await saveSaleRecord(newSale);

      // Trigger Invoice Callback
      onSaleComplete(newSale);

      // Refresh local inventory & customers lists
      await loadData();

      // Reset Form
      setCartItems([]);
      setSelectedCustomer(null);
      setManualCustomer({ name: '', phone: '', cnic: '', address: '' });
      setDiscountPKR(0);
      setTaxPKR(0);
      setPaidAmountPKR(0);
      setAccountNumber('');
      setSaleNotes('');
    } catch (err: any) {
      console.error('Checkout error:', err);
      setFormError('Failed to complete transaction: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-6 border border-indigo-800/50 shadow-xl text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-500/20 text-indigo-300 rounded-lg border border-indigo-500/30">
              <ShoppingBag className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold font-mono tracking-tight">Quick POS & Sales Screen</h2>
          </div>
          <p className="text-xs text-indigo-200 mt-1">
            Rapid single-screen customer checkout with instant PKR computation and invoice generation.
          </p>
        </div>
        <div className="flex items-center gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-xs font-mono">
          <div>
            <span className="text-slate-400 block text-[10px]">CURRENT ITEM COUNT</span>
            <span className="font-bold text-indigo-300 text-base">{cartItems.length} Bike(s)</span>
          </div>
          <div className="h-8 w-px bg-slate-800" />
          <div>
            <span className="text-slate-400 block text-[10px]">TOTAL PAYABLE (PKR)</span>
            <span className="font-bold text-emerald-400 text-base">{formatPKR(totalPKR)}</span>
          </div>
        </div>
      </div>

      {formError && (
        <div className="bg-rose-950/80 border border-rose-800 text-rose-200 p-4 rounded-xl text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {/* Grid Layout: Left Column (Customer & Bike Picker) | Right Column (Cart & Payment Summary) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Customer Selection & Bike Selection (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* 1. CUSTOMER SELECTION CARD */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg text-slate-100">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-sm uppercase tracking-wider text-slate-200">
                  Customer Selection
                </h3>
              </div>
              <div className="flex bg-slate-950 rounded-lg p-1 border border-slate-800 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setCustomerMode('search')}
                  className={`px-3 py-1 rounded-md transition-all ${
                    customerMode === 'search'
                      ? 'bg-indigo-600 text-white font-semibold shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Search Registered
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerMode('manual')}
                  className={`px-3 py-1 rounded-md transition-all ${
                    customerMode === 'manual'
                      ? 'bg-indigo-600 text-white font-semibold shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  + Type New Customer
                </button>
              </div>
            </div>

            {customerMode === 'search' ? (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={customerSearchQuery}
                    onChange={(e) => setCustomerSearchQuery(e.target.value)}
                    placeholder="Search by name, phone (0300-...), or CNIC..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {selectedCustomer ? (
                  <div className="bg-indigo-950/40 border border-indigo-700/50 p-3.5 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-indigo-300 uppercase block">Selected Customer:</span>
                      <h4 className="font-bold text-white text-base">{selectedCustomer.name}</h4>
                      <p className="text-xs text-slate-300 font-mono">
                        Phone: {selectedCustomer.phone || 'N/A'} | CNIC: {selectedCustomer.cnic || 'N/A'}
                      </p>
                      <p className="text-xs text-slate-400 truncate max-w-sm mt-0.5">{selectedCustomer.address}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedCustomer(null)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                    {filteredCustomers.length > 0 ? (
                      filteredCustomers.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => setSelectedCustomer(c)}
                          className="p-2.5 bg-slate-950 hover:bg-slate-800/80 rounded-xl cursor-pointer transition-all border border-slate-800 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-bold text-white block">{c.name}</span>
                            <span className="text-slate-400 font-mono">
                              {c.phone} {c.cnic ? `• ${c.cnic}` : ''}
                            </span>
                          </div>
                          <span className="px-2 py-0.5 bg-indigo-950 text-indigo-300 rounded text-[10px] font-mono">
                            Select
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500 text-center py-3">
                        No customer found matching query. Use &quot;+ Type New Customer&quot; tab to add manually.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Customer Full Name *</label>
                  <input
                    type="text"
                    value={manualCustomer.name}
                    onChange={(e) => setManualCustomer({ ...manualCustomer, name: e.target.value })}
                    placeholder="e.g. Muhammad Tariq Khan"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Mobile Phone Number</label>
                  <input
                    type="text"
                    value={manualCustomer.phone}
                    onChange={(e) => setManualCustomer({ ...manualCustomer, phone: e.target.value })}
                    placeholder="0300-1234567"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">National CNIC Number</label>
                  <input
                    type="text"
                    value={manualCustomer.cnic}
                    onChange={(e) => setManualCustomer({ ...manualCustomer, cnic: e.target.value })}
                    placeholder="42101-9823411-3"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Residential / City Address</label>
                  <input
                    type="text"
                    value={manualCustomer.address}
                    onChange={(e) => setManualCustomer({ ...manualCustomer, address: e.target.value })}
                    placeholder="Karachi, Pakistan"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:border-indigo-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 2. BIKE / PRODUCT SELECTION CARD */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg text-slate-100">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Bike className="w-4 h-4 text-blue-400" />
                <h3 className="font-bold text-sm uppercase tracking-wider text-slate-200">
                  Select Motorcycle / Product
                </h3>
              </div>
              <div className="flex bg-slate-950 rounded-lg p-1 border border-slate-800 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setItemMode('inventory')}
                  className={`px-3 py-1 rounded-md transition-all ${
                    itemMode === 'inventory'
                      ? 'bg-blue-600 text-white font-semibold shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Showroom Stock ({inventory.length})
                </button>
                <button
                  type="button"
                  onClick={() => setItemMode('custom')}
                  className={`px-3 py-1 rounded-md transition-all ${
                    itemMode === 'custom'
                      ? 'bg-blue-600 text-white font-semibold shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  + Custom / Unregistered
                </button>
              </div>
            </div>

            {itemMode === 'inventory' ? (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={bikeSearchQuery}
                    onChange={(e) => setBikeSearchQuery(e.target.value)}
                    placeholder="Search model, chassis #, or engine #..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
                  {filteredInventory.length > 0 ? (
                    filteredInventory.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 bg-slate-950 hover:bg-slate-800/90 rounded-xl border border-slate-800 flex flex-col justify-between transition-all group"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-white text-sm">
                                {item.make} {item.model}
                              </span>
                              {item.itemType && (
                                <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider ${
                                  item.itemType === 'Used Bike'
                                    ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                    : item.itemType === 'Rickshaw Body'
                                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                                    : item.itemType === 'Auto Rickshaw'
                                    ? 'bg-purple-950 text-purple-300 border border-purple-800'
                                    : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                }`}>
                                  {item.itemType}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                              Stock: {item.stockCount}
                            </span>
                          </div>
                          <span className="text-xs text-slate-400 block mb-1">
                            {item.variant} ({item.color || 'Std'}, {item.year})
                          </span>
                          <div className="text-[11px] font-mono text-slate-400 bg-slate-900/80 p-1.5 rounded space-y-0.5 mb-2">
                            <p className="truncate">Chassis / Frame: <span className="text-indigo-300 font-bold">{item.chassisNumber}</span></p>
                            <p className="truncate">Engine: <span className="text-slate-200 font-bold">{item.engineNumber || 'N/A'}</span></p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                          <span className="font-mono font-bold text-emerald-400 text-sm">
                            {formatPKR(item.sellingPricePKR)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAddInventoryToCart(item)}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 text-center py-6 text-slate-500 text-xs">
                      No matching available stock. Add items via Inventory module or use &quot;+ Custom / Unregistered&quot;.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <form onSubmit={handleAddCustomBikeToCart} className="space-y-3 text-xs">
                {/* Item Type Selector for Custom Items */}
                <div>
                  <label className="block text-slate-400 mb-1.5 font-bold uppercase tracking-wider text-[11px]">
                    Select Item Type / Category *
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'New Bike', label: 'New Bike', sub: 'Brand New', icon: '🏍️' },
                      { id: 'Used Bike', label: 'Used Bike', sub: '2nd Hand', icon: '🛵' },
                      { id: 'Rickshaw Body', label: 'Rickshaw Body', sub: 'Frame / Cabin', icon: '🛺' },
                      { id: 'Auto Rickshaw', label: 'Auto Rickshaw', sub: 'Complete 3W', icon: '🛺' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setCustomBike({ ...customBike, itemType: t.id as InventoryItemType })}
                        className={`p-2 rounded-xl border text-left flex flex-col justify-between transition-all ${
                          customBike.itemType === t.id
                            ? 'bg-indigo-950/80 border-indigo-500 text-white shadow-md ring-1 ring-indigo-500'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        <div className="text-sm mb-0.5">{t.icon}</div>
                        <span className="font-bold text-white text-xs block">{t.label}</span>
                        <span className="text-[10px] text-slate-400">{t.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Make / Manufacturer *</label>
                    <select
                      value={[
                        'Honda',
                        'Yamaha',
                        'Suzuki',
                        'United',
                        'Road Prince',
                        'Super Power',
                        'Sazgar',
                        'New Asia',
                        'Qingqi',
                        'Siwa',
                        'Crown',
                        'Unique',
                        'Kawasaki',
                        'Hi-Speed',
                      ].includes(customBike.make) ? customBike.make : 'Other'}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomBike({ ...customBike, make: val });
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="Honda">Honda</option>
                      <option value="Yamaha">Yamaha</option>
                      <option value="Suzuki">Suzuki</option>
                      <option value="United">United</option>
                      <option value="Road Prince">Road Prince</option>
                      <option value="Super Power">Super Power</option>
                      <option value="Sazgar">Sazgar</option>
                      <option value="New Asia">New Asia</option>
                      <option value="Qingqi">Qingqi</option>
                      <option value="Siwa">Siwa</option>
                      <option value="Crown">Crown</option>
                      <option value="Unique">Unique</option>
                      <option value="Kawasaki">Kawasaki</option>
                      <option value="Hi-Speed">Hi-Speed</option>
                      <option value="Other">Other / Custom Builder</option>
                    </select>
                    {![
                      'Honda',
                      'Yamaha',
                      'Suzuki',
                      'United',
                      'Road Prince',
                      'Super Power',
                      'Sazgar',
                      'New Asia',
                      'Qingqi',
                      'Siwa',
                      'Crown',
                      'Unique',
                      'Kawasaki',
                      'Hi-Speed',
                    ].includes(customBike.make) && (
                      <input
                        type="text"
                        value={customBike.make === 'Other' ? '' : customBike.make}
                        onChange={(e) => setCustomBike({ ...customBike, make: e.target.value })}
                        placeholder="Type custom manufacturer name..."
                        className="mt-1.5 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white focus:border-indigo-500"
                        required
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">
                      {customBike.itemType === 'Rickshaw Body' ? 'Body Model / Spec *' : 'Model Name *'}
                    </label>
                    <input
                      type="text"
                      value={customBike.model}
                      onChange={(e) => setCustomBike({ ...customBike, model: e.target.value })}
                      placeholder={
                        customBike.itemType === 'Rickshaw Body'
                          ? '6-Seater, 9-Seater, Loader 5ft Body...'
                          : 'CG 125, CD 70, YBR 125, GS 150...'
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:border-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">
                      {customBike.itemType === 'Rickshaw Body' ? 'Chassis / Frame / Serial #' : 'Chassis / Frame Number'}
                    </label>
                    <input
                      type="text"
                      value={customBike.chassisNumber}
                      onChange={(e) => setCustomBike({ ...customBike, chassisNumber: e.target.value })}
                      placeholder={customBike.itemType === 'Rickshaw Body' ? 'FRM-...' : 'PAK-HND-...'}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">
                      Engine Number {customBike.itemType === 'Rickshaw Body' ? '(Optional for Body)' : ''}
                    </label>
                    <input
                      type="text"
                      value={customBike.engineNumber}
                      onChange={(e) => setCustomBike({ ...customBike, engineNumber: e.target.value })}
                      placeholder={customBike.itemType === 'Rickshaw Body' ? 'N/A or Optional' : 'CG125E-...'}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Color / Year</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={customBike.color}
                        onChange={(e) => setCustomBike({ ...customBike, color: e.target.value })}
                        placeholder="Red / Black / Blue"
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-white"
                      />
                      <input
                        type="text"
                        value={customBike.year}
                        onChange={(e) => setCustomBike({ ...customBike, year: e.target.value })}
                        placeholder="2026"
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-white font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Selling Rate (PKR) *</label>
                    <input
                      type="number"
                      value={customBike.pricePKR || ''}
                      onChange={(e) => setCustomBike({ ...customBike, pricePKR: Number(e.target.value) })}
                      placeholder="e.g. 282900"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-emerald-400 font-mono font-bold focus:border-indigo-500"
                      required
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all"
                  >
                    <Plus className="w-4 h-4" /> Add Custom {customBike.itemType} to Cart
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Selected Cart Items, Pricing & Checkout Action (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg text-slate-100 sticky top-20">
            <h3 className="font-bold text-sm uppercase tracking-wider text-slate-200 mb-3 border-b border-slate-800 pb-2 flex items-center justify-between">
              <span>Checkout Order List</span>
              <span className="text-xs font-mono bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded border border-indigo-800">
                {cartItems.length} Item(s)
              </span>
            </h3>

            {/* Selected Items List */}
            <div className="space-y-2 mb-4 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
              {cartItems.length > 0 ? (
                cartItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="font-bold text-white block">
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
                      <span className="text-slate-400 font-mono text-[11px] block">
                        Chassis / Frame: {item.chassisNumber} {item.engineNumber && item.engineNumber !== 'N/A' ? `• Eng: ${item.engineNumber}` : ''}
                      </span>
                      <span className="text-emerald-400 font-mono font-bold">
                        {formatPKR(item.pricePKR)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveFromCart(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                  No motorcycle selected yet. Pick an item from the left panel.
                </div>
              )}
            </div>

            {/* Financial Calculations Form */}
            <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs">
              <div className="flex justify-between items-center text-slate-300 font-mono">
                <span>Subtotal Rate:</span>
                <span className="font-bold text-white text-sm">{formatPKR(subtotalPKR)}</span>
              </div>

              {/* Trade Discount */}
              <div className="flex justify-between items-center gap-2">
                <label className="text-slate-400 shrink-0">Discount (PKR):</label>
                <input
                  type="number"
                  value={discountPKR}
                  onChange={(e) => setDiscountPKR(Math.max(0, Number(e.target.value)))}
                  placeholder="0"
                  className="w-32 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-right font-mono text-emerald-400 focus:border-indigo-500"
                />
              </div>

              {/* Tax / Registration Fee */}
              <div className="flex justify-between items-center gap-2">
                <label className="text-slate-400 shrink-0">Tax / Reg Fee (PKR):</label>
                <input
                  type="number"
                  value={taxPKR}
                  onChange={(e) => setTaxPKR(Math.max(0, Number(e.target.value)))}
                  placeholder="0"
                  className="w-32 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-right font-mono text-slate-200 focus:border-indigo-500"
                />
              </div>

              <div className="border-t border-slate-800 pt-2 flex justify-between items-center font-bold text-base text-white font-mono">
                <span>Grand Total:</span>
                <span className="text-indigo-400 text-lg">{formatPKR(totalPKR)}</span>
              </div>

              {/* Paid Amount */}
              <div className="flex justify-between items-center gap-2 pt-1 border-t border-slate-800/80">
                <label className="text-slate-300 font-semibold shrink-0">Paid Amount (PKR):</label>
                <input
                  type="number"
                  value={paidAmountPKR}
                  onChange={(e) => setPaidAmountPKR(Number(e.target.value))}
                  placeholder="0"
                  className="w-36 bg-slate-900 border border-emerald-800/80 rounded px-2 py-1.5 text-right font-mono text-emerald-400 font-bold text-sm focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-between items-center text-slate-400 font-mono text-[11px]">
                <span>Remaining Balance:</span>
                <span className={balancePKR > 0 ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                  {formatPKR(balancePKR)}
                </span>
              </div>
            </div>

            {/* Transaction Parameters */}
            <div className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-white"
                  >
                    <option value="Cash">Cash Payment</option>
                    <option value="Bank Transfer">Bank Online Transfer</option>
                    <option value="Cheque">Bank Cheque</option>
                    <option value="Pay Order">Pay Order</option>
                    <option value="Installment">Showroom Installment</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 flex items-center justify-between">
                    <span>Account No:</span>
                    <span className="text-[10px] text-slate-500 font-normal italic">Optional</span>
                  </label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="e.g. 0123-45678"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-white font-mono text-xs focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Registration</label>
                  <select
                    value={registrationStatus}
                    onChange={(e) => setRegistrationStatus(e.target.value as RegistrationStatus)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-white"
                  >
                    <option value="Showroom Registration">Showroom Reg</option>
                    <option value="Self-Registration">Self Registration</option>
                    <option value="Registered">Already Registered</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Warranty</label>
                  <select
                    value={warrantyMonths}
                    onChange={(e) => setWarrantyMonths(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-white"
                  >
                    <option value={12}>12 Months Warranty</option>
                    <option value={24}>24 Months Warranty</option>
                    <option value={6}>6 Months Warranty</option>
                    <option value={0}>No Warranty</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Sale Reference / Notes</label>
                <input
                  type="text"
                  value={saleNotes}
                  onChange={(e) => setSaleNotes(e.target.value)}
                  placeholder="e.g. Helmet included, Paid via Meezan Bank"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white"
                />
              </div>
            </div>

            {/* Instant Checkout Button */}
            <button
              type="button"
              onClick={handleCheckout}
              disabled={isSubmitting || cartItems.length === 0}
              className={`w-full mt-5 py-3.5 rounded-xl font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl transition-all ${
                cartItems.length > 0 && !isSubmitting
                  ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white shadow-emerald-600/25'
                  : isSubmitting
                  ? 'bg-indigo-700 text-white cursor-wait'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Processing Sale...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  <span>Generate Invoice & Complete Sale</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
