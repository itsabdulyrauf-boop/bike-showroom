'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { SaleRecord, ExpenseRecord, InventoryItem, StockEntry } from '@/types';
import { formatPKR } from '@/lib/currency';
import { getAllSales, getAllExpenses, getAllInventory, getAllStocks } from '@/lib/db';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  Bike,
  Receipt,
  PieChart,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Calendar,
  Filter,
  ChevronLeft,
  ChevronRight,
  X,
  CreditCard,
  Boxes,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Archive,
} from 'lucide-react';

export const AnalyticsDashboard: React.FC = () => {
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [stocks, setStocks] = useState<StockEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedMonth, setSelectedMonth] = useState<string>('all'); // 'all' | 'YYYY-MM'
  const [stockSearchQuery, setStockSearchQuery] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    Promise.all([getAllSales(), getAllExpenses(), getAllInventory(), getAllStocks()])
      .then(([s, e, inv, stk]) => {
        if (isMounted) {
          setSales(s);
          setExpenses(e);
          setInventory(inv);
          setStocks(stk);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Error loading analytics:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Compute available unique months from sales & expense data
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    monthsSet.add(currentYearMonth);

    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevYearMonth = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
    monthsSet.add(prevYearMonth);

    sales.forEach((s) => {
      try {
        const d = new Date(s.createdAt);
        if (!isNaN(d.getTime())) {
          monthsSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }
      } catch {}
    });

    expenses.forEach((e) => {
      try {
        const d = new Date(e.date || e.createdAt);
        if (!isNaN(d.getTime())) {
          monthsSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }
      } catch {}
    });

    return Array.from(monthsSet).sort().reverse();
  }, [sales, expenses]);

  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const lastMonthKey = useMemo(() => {
    const now = new Date();
    const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const formatMonthLabel = (ym: string) => {
    if (ym === 'all') return 'All Time';
    const [year, month] = ym.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const handlePrevMonth = () => {
    let ym = selectedMonth === 'all' ? currentMonthKey : selectedMonth;
    const [year, month] = ym.split('-').map(Number);
    const prev = new Date(year, month - 2, 1);
    setSelectedMonth(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    let ym = selectedMonth === 'all' ? currentMonthKey : selectedMonth;
    const [year, month] = ym.split('-').map(Number);
    const next = new Date(year, month, 1);
    setSelectedMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
  };

  // Filtered dataset according to selected month
  const filteredSales = useMemo(() => {
    if (selectedMonth === 'all') return sales;
    return sales.filter((s) => {
      try {
        const d = new Date(s.createdAt);
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return ym === selectedMonth;
      } catch {
        return false;
      }
    });
  }, [sales, selectedMonth]);

  const filteredExpenses = useMemo(() => {
    if (selectedMonth === 'all') return expenses;
    return expenses.filter((e) => {
      try {
        const d = new Date(e.date || e.createdAt);
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return ym === selectedMonth;
      } catch {
        return false;
      }
    });
  }, [expenses, selectedMonth]);

  // Helper to download CSV file
  const downloadCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csvContent = [
      headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export Sales CSV
  const handleExportSalesCSV = () => {
    const headers = [
      'Invoice Number',
      'Date & Time',
      'Customer Name',
      'Customer Phone',
      'Payment Method',
      'Payment Status',
      'Item Count',
      'Purchased Items',
      'Subtotal (PKR)',
      'Discount (PKR)',
      'Total Amount (PKR)',
    ];

    const rows = filteredSales.map((sale) => {
      const itemsFormatted = sale.items
        .map((i) => `${i.make} ${i.model} (${i.quantity}x @ ${i.pricePKR})`)
        .join('; ');
      const subtotal = sale.totalPKR + (sale.discountPKR || 0);

      return [
        `#${sale.invoiceNumber}`,
        new Date(sale.createdAt).toLocaleString(),
        sale.customerName || 'Walk-in Customer',
        sale.customerPhone || 'N/A',
        sale.paymentMethod,
        sale.paymentStatus,
        sale.items.reduce((acc, i) => acc + i.quantity, 0),
        itemsFormatted,
        subtotal,
        sale.discountPKR || 0,
        sale.totalPKR,
      ];
    });

    const monthSuffix = selectedMonth === 'all' ? 'All_Time' : selectedMonth;
    const filename = `Sales_Report_${monthSuffix}_${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(filename, headers, rows);
  };

  // Export Expenses CSV
  const handleExportExpensesCSV = () => {
    const headers = ['Expense Title', 'Category', 'Amount (PKR)', 'Date', 'Notes'];

    const rows = filteredExpenses.map((e) => [
      e.title,
      e.category,
      e.amountPKR,
      new Date(e.date).toLocaleDateString(),
      e.notes || '',
    ]);

    const monthSuffix = selectedMonth === 'all' ? 'All_Time' : selectedMonth;
    const filename = `Expenses_Report_${monthSuffix}_${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(filename, headers, rows);
  };

  // Export Stock Analytics CSV
  const handleExportStocksCSV = () => {
    const headers = [
      'Batch Number',
      'Stock Name / Reference',
      'Arrival Date',
      'Status',
      'Total Units Procured',
      'Units Sold',
      'Remaining Stock',
      'Total Investment (PKR)',
      'Total Revenue (PKR)',
      'Cost of Sold Units (PKR)',
      'Realized Profit (PKR)',
      'Profit Margin %',
      'Investment Recovery (PKR)',
    ];

    const rows = stockWisePerformance.map((stk) => [
      stk.batchNumber,
      stk.stockName,
      stk.stockDate,
      stk.status,
      stk.totalQuantity,
      stk.soldUnits,
      stk.remainingUnits,
      stk.totalInvestmentPKR,
      stk.totalRevenuePKR,
      stk.cogsPKR,
      stk.profitPKR,
      `${stk.profitMarginPercent}%`,
      stk.investmentRecoveryPKR,
    ]);

    const filename = `Stock_Performance_Report_${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(filename, headers, rows);
  };

  // Compute Metrics for current filter
  const totalRevenuePKR = filteredSales.reduce((acc, s) => acc + (Number(s.totalPKR) || 0), 0);
  const totalExpensePKR = filteredExpenses.reduce((acc, e) => acc + (Number(e.amountPKR) || 0), 0);

  // Dynamic Cost of Goods Sold (Actual vehicle procurement cost for sold items)
  const totalCogsPKR = filteredSales.reduce((acc, sale) => {
    const saleCost = sale.items.reduce((sum, item) => {
      let unitCost = Number(item.purchasePricePKR);
      if (!unitCost || isNaN(unitCost)) {
        const invItem = inventory.find((inv) => inv.id === item.bikeId);
        unitCost = invItem ? Number(invItem.purchasePricePKR) || 0 : 0;
      }
      return sum + unitCost * (Number(item.quantity) || 1);
    }, 0);
    return acc + saleCost;
  }, 0);

  // Profit Calculation: Profit = Revenue - Actual Cost (COGS + Operating Expenses)
  const grossProfitPKR = totalRevenuePKR - totalCogsPKR;
  const totalActualCostPKR = totalCogsPKR + totalExpensePKR;
  const netProfitPKR = totalRevenuePKR - totalActualCostPKR;

  const grossMarginPercent =
    totalRevenuePKR > 0 ? Math.round((grossProfitPKR / totalRevenuePKR) * 100) : 0;
  const netMarginPercent =
    totalRevenuePKR > 0 ? Math.round((netProfitPKR / totalRevenuePKR) * 100) : 0;

  const totalBikesSold = filteredSales.reduce(
    (acc, s) => acc + s.items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0),
    0
  );

  const availableStock = inventory.filter(
    (i) => i.status === 'Available' && (Number(i.stockCount) || 0) > 0
  );
  const totalAvailableStockUnits = availableStock.reduce(
    (acc, i) => acc + (Number(i.stockCount) || 1),
    0
  );
  const totalStockValuationPKR = availableStock.reduce(
    (acc, i) => acc + (Number(i.sellingPricePKR) || 0) * (Number(i.stockCount) || 1),
    0
  );
  const totalStockCostValuationPKR = availableStock.reduce(
    (acc, i) => acc + (Number(i.purchasePricePKR) || 0) * (Number(i.stockCount) || 1),
    0
  );

  // Dynamic Stock-Wise Performance Analytics
  const stockWisePerformance = stocks.map((stock) => {
    const totalInvestment = Number(stock.purchaseCostPKR) || 0;
    const totalUnits = Number(stock.totalQuantity) || 0;
    const unitCost = totalUnits > 0 ? Math.round(totalInvestment / totalUnits) : 0;

    // Filter inventory assigned to this stock
    const assignedInv = inventory.filter((inv) => inv.stockId === stock.id);
    const remainingUnits = assignedInv
      .filter((inv) => inv.status === 'Available')
      .reduce((sum, inv) => sum + (Number(inv.stockCount) || 1), 0);

    // Filter sales related to this stock
    let soldUnits = 0;
    let stockRevenue = 0;
    let stockCogs = 0;

    sales.forEach((sale) => {
      const saleSubtotal =
        sale.subtotalPKR ||
        sale.items.reduce(
          (sum, it) => sum + (Number(it.pricePKR) || 0) * (Number(it.quantity) || 1),
          0
        ) ||
        sale.totalPKR;

      sale.items.forEach((it) => {
        const matchesDirectly = it.stockId === stock.id;
        const matchesInv = assignedInv.some((inv) => inv.id === it.bikeId);

        if (matchesDirectly || matchesInv) {
          const qty = Number(it.quantity) || 1;
          const itemGrossTotal = (Number(it.pricePKR) || 0) * qty;
          // Proportionately distribute net invoice amount (after discount)
          const itemNetRevenue =
            saleSubtotal > 0
              ? Math.round((itemGrossTotal / saleSubtotal) * Number(sale.totalPKR))
              : itemGrossTotal;

          soldUnits += qty;
          stockRevenue += itemNetRevenue;

          let c = Number(it.purchasePricePKR);
          if (!c || isNaN(c)) c = unitCost;
          stockCogs += c * qty;
        }
      });
    });

    const profitPKR = stockRevenue - stockCogs;
    const profitMarginPercent =
      stockRevenue > 0 ? Math.round((profitPKR / stockRevenue) * 100) : 0;
    const investmentRecoveryPKR = stockRevenue - totalInvestment;

    return {
      id: stock.id,
      batchNumber: stock.batchNumber,
      stockName: stock.stockName,
      stockDate: stock.stockDate,
      status: stock.status,
      supplier: stock.supplier || 'Standard',
      totalQuantity: totalUnits,
      soldUnits,
      remainingUnits,
      unitCostPKR: unitCost,
      totalInvestmentPKR: totalInvestment,
      totalRevenuePKR: stockRevenue,
      cogsPKR: stockCogs,
      profitPKR,
      profitMarginPercent,
      investmentRecoveryPKR,
    };
  });

  // Filtered stocks according to search
  const filteredStockPerformance = stockSearchQuery.trim()
    ? stockWisePerformance.filter((s) => {
        const q = stockSearchQuery.toLowerCase();
        return (
          s.batchNumber.toLowerCase().includes(q) ||
          s.stockName.toLowerCase().includes(q) ||
          s.supplier.toLowerCase().includes(q)
        );
      })
    : stockWisePerformance;

  // Group Sales by Bike Model - Proportionally allocating invoice totals so model revenue equals gross income
  const modelSalesCount: { [key: string]: { model: string; count: number; totalPKR: number } } = {};
  filteredSales.forEach((s) => {
    const saleSubtotal = s.subtotalPKR || s.items.reduce((sum, it) => sum + (Number(it.pricePKR) || 0) * (Number(it.quantity) || 1), 0) || s.totalPKR;

    s.items.forEach((item) => {
      const key = `${item.make} ${item.model}`;
      if (!modelSalesCount[key]) {
        modelSalesCount[key] = { model: key, count: 0, totalPKR: 0 };
      }
      const itemQty = Number(item.quantity) || 1;
      const itemSubtotal = (Number(item.pricePKR) || 0) * itemQty;
      const itemNetPKR = saleSubtotal > 0 ? Math.round((itemSubtotal / saleSubtotal) * s.totalPKR) : itemSubtotal;

      modelSalesCount[key].count += itemQty;
      modelSalesCount[key].totalPKR += itemNetPKR;
    });
  });

  const topSellingModels = Object.values(modelSalesCount).sort((a, b) => b.totalPKR - a.totalPKR);

  // Group Expenses by Category
  const expenseByCategory: { [key: string]: number } = {};
  filteredExpenses.forEach((e) => {
    expenseByCategory[e.category] = (expenseByCategory[e.category] || 0) + e.amountPKR;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner with CSV Export Actions */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-slate-800 text-indigo-400 rounded-xl border border-slate-700 shadow-inner">
              <BarChart3 className="w-6 h-6" />
            </span>
            <div>
              <h2 className="text-xl font-bold font-mono tracking-tight text-white">
                Showroom Financial Analytics
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Monthly revenue, expense breakdown, net profit, and CSV reports
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <button
            onClick={handleExportSalesCSV}
            disabled={filteredSales.length === 0}
            className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
            title="Export filtered sales records to CSV"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Sales CSV ({filteredSales.length})</span>
          </button>

          <button
            onClick={handleExportExpensesCSV}
            disabled={filteredExpenses.length === 0}
            className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all"
            title="Export filtered expense records to CSV"
          >
            <Download className="w-4 h-4" />
            <span>Export Expenses CSV</span>
          </button>
        </div>
      </div>

      {/* Monthly Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center flex-wrap gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono mr-1">
            <Filter className="w-3.5 h-3.5 text-indigo-400" />
            <span>Analytics Period:</span>
          </div>

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

        {/* Selected Period Badge */}
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <span>Active Range:</span>
          <span className="font-bold text-emerald-400 uppercase bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
            {formatMonthLabel(selectedMonth)}
          </span>
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sales Revenue */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-slate-400 uppercase">
              {selectedMonth === 'all' ? 'Gross Sales Revenue' : 'Monthly Sales Revenue'}
            </span>
            <span className="p-2 bg-emerald-950 text-emerald-400 rounded-lg border border-emerald-800/50">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-black font-mono text-emerald-400">
            {formatPKR(totalRevenuePKR)}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {filteredSales.length} Invoices ({totalBikesSold} Vehicles Sold)
          </p>
        </div>

        {/* Total Actual Cost (COGS + Showroom Expenses) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-slate-400 uppercase">
              {selectedMonth === 'all' ? 'Total Actual Cost' : 'Monthly Actual Cost'}
            </span>
            <span className="p-2 bg-rose-950 text-rose-400 rounded-lg border border-rose-800/50">
              <TrendingDown className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-black font-mono text-rose-400">
            {formatPKR(totalActualCostPKR)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-mono truncate">
            COGS: {formatPKR(totalCogsPKR)} | OpEx: {formatPKR(totalExpensePKR)}
          </p>
        </div>

        {/* Dynamic Net Profit: Profit = Revenue - Actual Cost */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-slate-400 uppercase">
              {selectedMonth === 'all' ? 'Net Showroom Profit' : 'Monthly Net Profit'}
            </span>
            <span className="p-2 bg-indigo-950 text-indigo-400 rounded-lg border border-indigo-800/50">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div
            className={`text-xl font-black font-mono ${
              netProfitPKR >= 0 ? 'text-indigo-300' : 'text-rose-400'
            }`}
          >
            {formatPKR(netProfitPKR)}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
            <span>Margin: <strong className={netMarginPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{netMarginPercent}%</strong></span>
            <span className="text-slate-500 font-mono">Gross: {grossMarginPercent}%</span>
          </div>
        </div>

        {/* Inventory Valuation */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-slate-400 uppercase">Available Stock Value</span>
            <span className="p-2 bg-blue-950 text-blue-400 rounded-lg border border-blue-800/50">
              <Package className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-black font-mono text-blue-300">
            {formatPKR(totalStockValuationPKR)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-mono truncate">
            {totalAvailableStockUnits} Available units (Cost: {formatPKR(totalStockCostValuationPKR)})
          </p>
        </div>
      </div>

      {/* Stock-Wise Procurement & Performance Analytics Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl text-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 border-b border-slate-800 pb-4 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-950 text-cyan-400 rounded-xl border border-cyan-800/60">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base font-mono uppercase tracking-wider text-white">
                Stock-Wise Performance Analytics
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Dynamic tracking of investment, revenue, profit, and remaining inventory per procurement batch
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <input
              type="text"
              placeholder="Search batch # or stock name..."
              value={stockSearchQuery}
              onChange={(e) => setStockSearchQuery(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
            />
            <button
              type="button"
              onClick={handleExportStocksCSV}
              disabled={stockWisePerformance.length === 0}
              className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Export Stocks CSV</span>
            </button>
          </div>
        </div>

        {/* Stock Analytics Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase font-mono border-b border-slate-800 text-[11px]">
              <tr>
                <th className="py-3 px-4 font-semibold">Stock Batch</th>
                <th className="py-3 px-3 font-semibold">Status</th>
                <th className="py-3 px-3 font-semibold text-center">Procured / Sold / Left</th>
                <th className="py-3 px-3 font-semibold text-right">Total Investment</th>
                <th className="py-3 px-3 font-semibold text-right">Revenue Generated</th>
                <th className="py-3 px-3 font-semibold text-right">Realized Profit</th>
                <th className="py-3 px-4 font-semibold text-right">Recovery Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filteredStockPerformance.length > 0 ? (
                filteredStockPerformance.map((stk) => {
                  const soldPercent =
                    stk.totalQuantity > 0
                      ? Math.min(100, Math.round((stk.soldUnits / stk.totalQuantity) * 100))
                      : 0;

                  return (
                    <tr key={stk.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-white font-mono text-xs">{stk.batchNumber}</div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                          {stk.stockName}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          Arrived: {stk.stockDate}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                            stk.status === 'Active'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : stk.status === 'Completed'
                              ? 'bg-amber-950 text-amber-400 border border-amber-800'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {stk.status}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <div className="font-mono text-xs text-white">
                          <span className="text-cyan-400 font-bold">{stk.totalQuantity}</span>
                          <span className="text-slate-500 mx-1">/</span>
                          <span className="text-emerald-400 font-bold">{stk.soldUnits}</span>
                          <span className="text-slate-500 mx-1">/</span>
                          <span className="text-blue-400 font-bold">{stk.remainingUnits}</span>
                        </div>
                        <div className="w-24 bg-slate-950 h-1.5 rounded-full overflow-hidden mx-auto mt-1.5 border border-slate-800">
                          <div
                            className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-full rounded-full"
                            style={{ width: `${soldPercent}%` }}
                          />
                        </div>
                        <span className="text-[9px] text-slate-500 font-mono">{soldPercent}% Sold</span>
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="font-mono font-bold text-rose-300">
                          {formatPKR(stk.totalInvestmentPKR)}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          @{formatPKR(stk.unitCostPKR)}/unit
                        </div>
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="font-mono font-bold text-emerald-400">
                          {formatPKR(stk.totalRevenuePKR)}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {stk.soldUnits} unit(s) billed
                        </div>
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div
                          className={`font-mono font-bold ${
                            stk.profitPKR >= 0 ? 'text-indigo-300' : 'text-rose-400'
                          }`}
                        >
                          {formatPKR(stk.profitPKR)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Margin: <span className={stk.profitMarginPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{stk.profitMarginPercent}%</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <span
                          className={`font-mono font-bold text-xs ${
                            stk.investmentRecoveryPKR >= 0
                              ? 'text-emerald-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {stk.investmentRecoveryPKR >= 0 ? '+' : ''}
                          {formatPKR(stk.investmentRecoveryPKR)}
                        </span>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {stk.investmentRecoveryPKR >= 0 ? 'Cost Recouped' : 'In Progress'}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    <Boxes className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">No stock procurement records match your criteria.</p>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Create batches in the Stock Lots module to begin tracking performance.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Two Column Detailed Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Selling Motorcycle Models for Period */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg text-slate-100">
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Bike className="w-5 h-5 text-indigo-400" />
              <h3 className="font-bold text-base font-mono uppercase tracking-wider">
                Top Selling Models ({formatMonthLabel(selectedMonth)})
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {topSellingModels.length} Model(s)
            </span>
          </div>

          <div className="space-y-3">
            {topSellingModels.length > 0 ? (
              topSellingModels.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 bg-slate-950 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-indigo-950 text-indigo-300 border border-indigo-800 flex items-center justify-center font-bold font-mono">
                      #{idx + 1}
                    </span>
                    <div>
                      <span className="font-bold text-white text-sm block">{item.model}</span>
                      <span className="text-slate-400">{item.count} Unit(s) Sold</span>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    {formatPKR(item.totalPKR)}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 py-6 text-center">
                No bike sales recorded for {formatMonthLabel(selectedMonth)}.
              </p>
            )}
          </div>
        </div>

        {/* Expense Category Breakdown for Period */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg text-slate-100">
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <PieChart className="w-5 h-5 text-amber-400" />
              <h3 className="font-bold text-base font-mono uppercase tracking-wider">
                Expense Breakdown ({formatMonthLabel(selectedMonth)})
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-400 font-bold text-rose-400">
              {formatPKR(totalExpensePKR)}
            </span>
          </div>

          <div className="space-y-3">
            {Object.keys(expenseByCategory).length > 0 ? (
              Object.entries(expenseByCategory).map(([cat, amount], idx) => {
                const percentage =
                  totalExpensePKR > 0 ? Math.round((amount / totalExpensePKR) * 100) : 0;
                return (
                  <div key={idx} className="p-3.5 bg-slate-950 border border-slate-800/80 rounded-xl space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-200">{cat}</span>
                      <span className="font-mono font-bold text-rose-400">
                        {formatPKR(amount)} ({percentage}%)
                      </span>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-amber-500 to-rose-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, percentage)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-slate-500 py-6 text-center">
                No showroom expenses recorded for {formatMonthLabel(selectedMonth)}.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

