import * as XLSX from 'xlsx';
import { CustomerItem, InventoryItem, SaleRecord, StockEntry } from '@/types';

function saveWorkbook(workbook: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(workbook, filename, { compression: true });
}

function autoFitColumns(data: Record<string, any>[]): { wch: number }[] {
  if (data.length === 0) return [];
  const keys = Object.keys(data[0]);
  return keys.map((key) => {
    let maxLen = key.length;
    for (const row of data) {
      const val = row[key];
      if (val !== null && val !== undefined) {
        const strVal = String(val);
        if (strVal.length > maxLen) {
          maxLen = Math.min(strVal.length, 60);
        }
      }
    }
    return { wch: Math.max(maxLen + 3, 12) };
  });
}

// ================= 1. CUSTOMERS EXCEL EXPORT =================
export function exportCustomersToExcel(
  customers: CustomerItem[],
  sales: SaleRecord[],
  periodLabel: string,
  showroomName: string = 'HS Traders'
) {
  // Precompute customer-specific financial totals from sales
  const customerFinancials = new Map<string, { totalSpent: number; totalPaid: number; balance: number; invoiceCount: number }>();

  sales.forEach((s) => {
    const key = (s.customerId || s.customerPhone || s.customerName || '').toLowerCase().trim();
    if (!key) return;
    const current = customerFinancials.get(key) || { totalSpent: 0, totalPaid: 0, balance: 0, invoiceCount: 0 };
    current.totalSpent += Number(s.totalPKR) || 0;
    current.totalPaid += Number(s.paidAmountPKR) || 0;
    current.balance += Number(s.balancePKR) || 0;
    current.invoiceCount += 1;
    customerFinancials.set(key, current);
  });

  let totalSpentSum = 0;
  let totalPaidSum = 0;
  let totalBalanceSum = 0;
  let totalInvoicesSum = 0;

  const rows: Record<string, any>[] = customers.map((c) => {
    const keyById = (c.id || '').toLowerCase().trim();
    const keyByPhone = (c.phone || '').toLowerCase().trim();
    const keyByName = (c.name || '').toLowerCase().trim();

    const stats =
      customerFinancials.get(keyById) ||
      customerFinancials.get(keyByPhone) ||
      customerFinancials.get(keyByName) || {
        totalSpent: c.totalSpentPKR || 0,
        totalPaid: c.totalSpentPKR || 0,
        balance: 0,
        invoiceCount: c.totalPurchasesCount || 0,
      };

    totalSpentSum += stats.totalSpent;
    totalPaidSum += stats.totalPaid;
    totalBalanceSum += stats.balance;
    totalInvoicesSum += stats.invoiceCount;

    return {
      'Customer ID': c.id,
      'Customer Name': c.name,
      'Phone Number': c.phone ? `'${c.phone}` : 'N/A', // Preserve leading zeros
      'CNIC Number': c.cnic ? `'${c.cnic}` : 'N/A',
      'Address': c.address || 'N/A',
      'Registration Date': c.createdAt ? new Date(c.createdAt).toLocaleDateString() : 'N/A',
      'Total Invoices': stats.invoiceCount,
      'Total Purchases (PKR)': stats.totalSpent,
      'Total Paid (PKR)': stats.totalPaid,
      'Outstanding Balance (PKR)': stats.balance,
    };
  });

  // Add Summary Total Row
  if (rows.length > 0) {
    rows.push({
      'Customer ID': 'TOTALS',
      'Customer Name': `${customers.length} Customers`,
      'Phone Number': '',
      'CNIC Number': '',
      'Address': '',
      'Registration Date': '',
      'Total Invoices': totalInvoicesSum,
      'Total Purchases (PKR)': totalSpentSum,
      'Total Paid (PKR)': totalPaidSum,
      'Outstanding Balance (PKR)': totalBalanceSum,
    });
  }

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = autoFitColumns(rows);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers');

  const cleanDate = new Date().toISOString().split('T')[0];
  const filename = `${showroomName.replace(/\s+/g, '_')}_Customers_Report_${cleanDate}.xlsx`;
  saveWorkbook(workbook, filename);
}

// ================= 2. INVENTORY EXCEL EXPORT =================
export function exportInventoryToExcel(
  items: InventoryItem[],
  periodLabel: string,
  showroomName: string = 'HS Traders'
) {
  let totalUnits = 0;
  let totalPurchaseValue = 0;
  let totalSellingValue = 0;

  const rows: Record<string, any>[] = items.map((item) => {
    const qty = Number(item.stockCount) || 1;
    const purchaseCost = Number(item.purchasePricePKR) || 0;
    const sellingPrice = Number(item.sellingPricePKR) || 0;

    totalUnits += qty;
    totalPurchaseValue += purchaseCost * qty;
    totalSellingValue += sellingPrice * qty;

    return {
      'Item ID': item.id,
      'Item Type': item.itemType || 'New Bike',
      'Make / Brand': item.make,
      'Model': item.model,
      'Variant': item.variant || '-',
      'Model Year': item.year || '-',
      'Chassis Number': item.chassisNumber ? `'${item.chassisNumber}` : '-',
      'Engine Number': item.engineNumber ? `'${item.engineNumber}` : '-',
      'Color': item.color || '-',
      'Status': item.status,
      'Stock Lot': item.stockName || item.stockBatchNumber || 'Unassigned',
      'Stock Count': qty,
      'Unit Purchase Price (PKR)': purchaseCost,
      'Unit Selling Price (PKR)': sellingPrice,
      'Total Purchase Value (PKR)': purchaseCost * qty,
      'Total Sales Value (PKR)': sellingPrice * qty,
      'Notes': item.notes || '',
      'Last Updated': item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : 'N/A',
    };
  });

  if (rows.length > 0) {
    rows.push({
      'Item ID': 'TOTALS',
      'Item Type': `${items.length} Records`,
      'Make / Brand': '',
      'Model': '',
      'Variant': '',
      'Model Year': '',
      'Chassis Number': '',
      'Engine Number': '',
      'Color': '',
      'Status': '',
      'Stock Lot': '',
      'Stock Count': totalUnits,
      'Unit Purchase Price (PKR)': 0,
      'Unit Selling Price (PKR)': 0,
      'Total Purchase Value (PKR)': totalPurchaseValue,
      'Total Sales Value (PKR)': totalSellingValue,
      'Notes': '',
      'Last Updated': '',
    });
  }

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = autoFitColumns(rows);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory');

  const cleanDate = new Date().toISOString().split('T')[0];
  const filename = `${showroomName.replace(/\s+/g, '_')}_Inventory_Report_${cleanDate}.xlsx`;
  saveWorkbook(workbook, filename);
}

// ================= 3. INVOICES EXCEL EXPORT =================
export function exportInvoicesToExcel(
  sales: SaleRecord[],
  periodLabel: string,
  showroomName: string = 'HS Traders'
) {
  let grandSubtotal = 0;
  let grandDiscount = 0;
  let grandTotal = 0;
  let grandPaid = 0;
  let grandBalance = 0;

  // Sheet 1: Invoices Summary (One row per invoice to prevent duplicating financial totals)
  const summaryRows: Record<string, any>[] = sales.map((sale) => {
    const subtotal = Number(sale.subtotalPKR) || (Number(sale.totalPKR) + (Number(sale.discountPKR) || 0));
    const discount = Number(sale.discountPKR) || 0;
    const total = Number(sale.totalPKR) || 0;
    const paid = Number(sale.paidAmountPKR) || 0;
    const balance = Number(sale.balancePKR) || 0;

    grandSubtotal += subtotal;
    grandDiscount += discount;
    grandTotal += total;
    grandPaid += paid;
    grandBalance += balance;

    const itemCount = (sale.items || []).reduce((acc, it) => acc + (Number(it.quantity) || 1), 0);
    const itemSummary = (sale.items || []).map((it) => `${it.make} ${it.model} (x${it.quantity || 1})`).join('; ');

    return {
      'Invoice #': sale.invoiceNumber,
      'Invoice Date': sale.createdAt ? new Date(sale.createdAt).toLocaleDateString() : 'N/A',
      'Customer Name': sale.customerName || 'Walk-in Customer',
      'Customer Phone': sale.customerPhone ? `'${sale.customerPhone}` : 'N/A',
      'Customer CNIC': sale.customerCnic ? `'${sale.customerCnic}` : 'N/A',
      'Payment Status': sale.paymentStatus,
      'Payment Method': sale.paymentMethod,
      'Units Billed': itemCount,
      'Vehicles / Items': itemSummary,
      'Subtotal (PKR)': subtotal,
      'Discount (PKR)': discount,
      'Total Amount (PKR)': total,
      'Paid Amount (PKR)': paid,
      'Balance Due (PKR)': balance,
      'Letter Issued': sale.letterIssued || 'No',
      'Letter Number': sale.letterNumber || 'N/A',
    };
  });

  if (summaryRows.length > 0) {
    summaryRows.push({
      'Invoice #': 'TOTALS',
      'Invoice Date': `${sales.length} Invoices`,
      'Customer Name': '',
      'Customer Phone': '',
      'Customer CNIC': '',
      'Payment Status': '',
      'Payment Method': '',
      'Units Billed': 0,
      'Vehicles / Items': '',
      'Subtotal (PKR)': grandSubtotal,
      'Discount (PKR)': grandDiscount,
      'Total Amount (PKR)': grandTotal,
      'Paid Amount (PKR)': grandPaid,
      'Balance Due (PKR)': grandBalance,
      'Letter Issued': '',
      'Letter Number': '',
    });
  }

  // Sheet 2: Line Items Detail (Linked by Invoice #)
  const lineItemRows: any[] = [];
  sales.forEach((sale) => {
    (sale.items || []).forEach((item, idx) => {
      const qty = Number(item.quantity) || 1;
      const unitPrice = Number(item.pricePKR) || 0;
      lineItemRows.push({
        'Invoice #': sale.invoiceNumber,
        'Invoice Date': sale.createdAt ? new Date(sale.createdAt).toLocaleDateString() : 'N/A',
        'Customer Name': sale.customerName,
        'Item #': idx + 1,
        'Item Type': item.itemType || 'Motorcycle',
        'Make': item.make,
        'Model': item.model,
        'Variant': item.variant || '-',
        'Model Year': item.year || '-',
        'Chassis Number': item.chassisNumber ? `'${item.chassisNumber}` : '-',
        'Engine Number': item.engineNumber ? `'${item.engineNumber}` : '-',
        'Color': item.color || '-',
        'Stock Batch': item.stockBatchNumber || '-',
        'Quantity': qty,
        'Unit Price (PKR)': unitPrice,
        'Line Total (PKR)': qty * unitPrice,
      });
    });
  });

  const workbook = XLSX.utils.book_new();

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary['!cols'] = autoFitColumns(summaryRows);
  XLSX.utils.book_append_sheet(workbook, wsSummary, 'Invoices Summary');

  if (lineItemRows.length > 0) {
    const wsLineItems = XLSX.utils.json_to_sheet(lineItemRows);
    wsLineItems['!cols'] = autoFitColumns(lineItemRows);
    XLSX.utils.book_append_sheet(workbook, wsLineItems, 'Line Items Breakdown');
  }

  const cleanDate = new Date().toISOString().split('T')[0];
  const filename = `${showroomName.replace(/\s+/g, '_')}_Invoices_Report_${cleanDate}.xlsx`;
  saveWorkbook(workbook, filename);
}

// ================= 4. INDIVIDUAL STOCK EXCEL EXPORT =================
export function exportIndividualStockToExcel(
  stock: StockEntry,
  inventory: InventoryItem[],
  sales: SaleRecord[],
  showroomName: string = 'HS Traders'
) {
  // Find inventory matching this stock
  const stockInventory = inventory.filter(
    (inv) =>
      inv.stockId === stock.id ||
      (inv.stockBatchNumber && inv.stockBatchNumber.trim().toLowerCase() === stock.batchNumber.trim().toLowerCase())
  );

  // Find sales that sold items from this stock
  const stockSalesRows: any[] = [];
  let totalStockRevenue = 0;
  let totalStockCostOfSold = 0;
  let totalStockUnitsSold = 0;
  let totalPaidForStock = 0;
  let totalPendingForStock = 0;

  sales.forEach((s) => {
    (s.items || []).forEach((item) => {
      const matchStockId = item.stockId && item.stockId === stock.id;
      const matchBatch = item.stockBatchNumber && item.stockBatchNumber.toLowerCase() === stock.batchNumber.toLowerCase();
      const matchInventory = stockInventory.some(
        (inv) =>
          inv.id === item.bikeId ||
          (item.chassisNumber && inv.chassisNumber && item.chassisNumber.toLowerCase() === inv.chassisNumber.toLowerCase())
      );

      if (matchStockId || matchBatch || matchInventory) {
        const qty = Number(item.quantity) || 1;
        const salePrice = Number(item.pricePKR) || 0;
        const unitCost =
          Number(item.purchasePricePKR) ||
          (stock.totalQuantity > 0 ? stock.purchaseCostPKR / stock.totalQuantity : 0);
        const revenue = salePrice * qty;
        const cost = unitCost * qty;
        const profit = revenue - cost;

        totalStockUnitsSold += qty;
        totalStockRevenue += revenue;
        totalStockCostOfSold += cost;

        // Payment status allocation for this item
        const invoiceTotal = Number(s.totalPKR) || 1;
        const paidRatio = Math.min(1, Math.max(0, (Number(s.paidAmountPKR) || 0) / invoiceTotal));
        const itemPaid = Math.round(revenue * paidRatio);
        const itemPending = revenue - itemPaid;

        totalPaidForStock += itemPaid;
        totalPendingForStock += itemPending;

        stockSalesRows.push({
          'Invoice #': s.invoiceNumber,
          'Invoice Date': s.createdAt ? new Date(s.createdAt).toLocaleDateString() : 'N/A',
          'Customer': s.customerName,
          'Make / Model': `${item.make} ${item.model}`,
          'Chassis Number': item.chassisNumber ? `'${item.chassisNumber}` : '-',
          'Quantity Sold': qty,
          'Unit Cost (PKR)': unitCost,
          'Sale Price (PKR)': salePrice,
          'Total Revenue (PKR)': revenue,
          'Realized Profit (PKR)': profit,
          'Paid PKR (Allocated)': itemPaid,
          'Pending PKR (Allocated)': itemPending,
          'Invoice Payment Status': s.paymentStatus,
        });
      }
    });
  });

  const availableUnits = stockInventory.filter((i) => i.status === 'Available').length;
  const realizedProfit = totalStockRevenue - totalStockCostOfSold;
  const recoveryPKR = totalStockRevenue - stock.purchaseCostPKR;

  // Sheet 1: Stock Overview & KPIs
  const overviewRows = [
    { Field: 'Stock Batch Number', Value: stock.batchNumber },
    { Field: 'Stock Name / Reference', Value: stock.stockName },
    { Field: 'Arrival Date', Value: stock.stockDate },
    { Field: 'Status', Value: stock.status },
    { Field: 'Supplier / Factory', Value: stock.supplier || 'N/A' },
    { Field: 'Notes', Value: stock.notes || '' },
    { Field: 'Total Procured Units', Value: stock.totalQuantity },
    { Field: 'Total Units Sold', Value: totalStockUnitsSold },
    { Field: 'Available Units Remaining', Value: availableUnits },
    { Field: 'Total Purchase Investment (PKR)', Value: stock.purchaseCostPKR },
    { Field: 'Average Unit Cost (PKR)', Value: stock.totalQuantity > 0 ? Math.round(stock.purchaseCostPKR / stock.totalQuantity) : 0 },
    { Field: 'Total Revenue Generated (PKR)', Value: totalStockRevenue },
    { Field: 'Cost of Sold Units (PKR)', Value: totalStockCostOfSold },
    { Field: 'Realized Gross Profit (PKR)', Value: realizedProfit },
    { Field: 'Investment Recovery / Net Cash (PKR)', Value: recoveryPKR },
    { Field: 'Total Collected (Paid PKR)', Value: totalPaidForStock },
    { Field: 'Total Outstanding (Unpaid PKR)', Value: totalPendingForStock },
  ];

  // Sheet 2: Inventory Items in this Stock
  const invRows = stockInventory.map((item) => ({
    'Item ID': item.id,
    'Make': item.make,
    'Model': item.model,
    'Variant': item.variant || '-',
    'Year': item.year || '-',
    'Chassis Number': item.chassisNumber ? `'${item.chassisNumber}` : '-',
    'Engine Number': item.engineNumber ? `'${item.engineNumber}` : '-',
    'Color': item.color || '-',
    'Status': item.status,
    'Stock Count': item.stockCount,
    'Purchase Cost (PKR)': item.purchasePricePKR,
    'Selling Price (PKR)': item.sellingPricePKR,
  }));

  const workbook = XLSX.utils.book_new();

  const wsOverview = XLSX.utils.json_to_sheet(overviewRows);
  wsOverview['!cols'] = [{ wch: 35 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(workbook, wsOverview, 'Stock Summary');

  if (invRows.length > 0) {
    const wsInv = XLSX.utils.json_to_sheet(invRows);
    wsInv['!cols'] = autoFitColumns(invRows);
    XLSX.utils.book_append_sheet(workbook, wsInv, 'Assigned Inventory');
  }

  if (stockSalesRows.length > 0) {
    const wsSales = XLSX.utils.json_to_sheet(stockSalesRows);
    wsSales['!cols'] = autoFitColumns(stockSalesRows);
    XLSX.utils.book_append_sheet(workbook, wsSales, 'Sales & Recoveries');
  }

  const cleanBatch = stock.batchNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${showroomName.replace(/\s+/g, '_')}_Stock_${cleanBatch}_Report.xlsx`;
  saveWorkbook(workbook, filename);
}

// ================= 5. CONSOLIDATED ALL STOCKS EXCEL EXPORT =================
export function exportConsolidatedStocksToExcel(
  stocks: StockEntry[],
  inventory: InventoryItem[],
  sales: SaleRecord[],
  showroomName: string = 'HS Traders'
) {
  // Pre-calculate sales revenue and cost per stock
  const stockStatsMap = new Map<
    string,
    {
      unitsSold: number;
      revenue: number;
      costOfSold: number;
      paidPKR: number;
      outstandingPKR: number;
    }
  >();

  // Initialize all stocks
  stocks.forEach((s) => {
    stockStatsMap.set(s.id, {
      unitsSold: 0,
      revenue: 0,
      costOfSold: 0,
      paidPKR: 0,
      outstandingPKR: 0,
    });
  });

  // Associate sales items
  sales.forEach((sale) => {
    (sale.items || []).forEach((item) => {
      let matchedStockId = item.stockId;
      if (!matchedStockId && item.stockBatchNumber) {
        const found = stocks.find((s) => s.batchNumber.toLowerCase() === item.stockBatchNumber!.toLowerCase());
        if (found) matchedStockId = found.id;
      }
      if (!matchedStockId) {
        const invMatch = inventory.find(
          (inv) =>
            inv.id === item.bikeId ||
            (item.chassisNumber && inv.chassisNumber && item.chassisNumber.toLowerCase() === inv.chassisNumber.toLowerCase())
        );
        if (invMatch && invMatch.stockId) matchedStockId = invMatch.stockId;
      }

      if (matchedStockId && stockStatsMap.has(matchedStockId)) {
        const current = stockStatsMap.get(matchedStockId)!;
        const qty = Number(item.quantity) || 1;
        const price = Number(item.pricePKR) || 0;
        const rev = price * qty;
        const matchedStock = stocks.find((s) => s.id === matchedStockId);
        const defaultUnitCost =
          matchedStock && matchedStock.totalQuantity > 0 ? matchedStock.purchaseCostPKR / matchedStock.totalQuantity : 0;
        const cost = (Number(item.purchasePricePKR) || defaultUnitCost) * qty;

        const invoiceTotal = Number(sale.totalPKR) || 1;
        const paidRatio = Math.min(1, Math.max(0, (Number(sale.paidAmountPKR) || 0) / invoiceTotal));
        const itemPaid = Math.round(rev * paidRatio);
        const itemPending = rev - itemPaid;

        current.unitsSold += qty;
        current.revenue += rev;
        current.costOfSold += cost;
        current.paidPKR += itemPaid;
        current.outstandingPKR += itemPending;
      }
    });
  });

  let grandTotalProcured = 0;
  let grandTotalSold = 0;
  let grandTotalRemaining = 0;
  let grandTotalInvestment = 0;
  let grandTotalRevenue = 0;
  let grandTotalCostOfSold = 0;
  let grandTotalProfit = 0;
  let grandTotalPaid = 0;
  let grandTotalOutstanding = 0;

  // Sheet 1: Summary of all Stocks
  const summaryRows: Record<string, any>[] = stocks.map((stk) => {
    const stats = stockStatsMap.get(stk.id) || {
      unitsSold: 0,
      revenue: 0,
      costOfSold: 0,
      paidPKR: 0,
      outstandingPKR: 0,
    };

    const remainingUnits = Math.max(0, stk.totalQuantity - stats.unitsSold);
    const profit = stats.revenue - stats.costOfSold;
    const profitMargin = stats.revenue > 0 ? Math.round((profit / stats.revenue) * 100) : 0;
    const recoveryPKR = stats.revenue - stk.purchaseCostPKR;

    grandTotalProcured += stk.totalQuantity;
    grandTotalSold += stats.unitsSold;
    grandTotalRemaining += remainingUnits;
    grandTotalInvestment += stk.purchaseCostPKR;
    grandTotalRevenue += stats.revenue;
    grandTotalCostOfSold += stats.costOfSold;
    grandTotalProfit += profit;
    grandTotalPaid += stats.paidPKR;
    grandTotalOutstanding += stats.outstandingPKR;

    return {
      'Stock Batch #': stk.batchNumber,
      'Stock Name / Reference': stk.stockName,
      'Arrival Date': stk.stockDate,
      'Status': stk.status,
      'Supplier / Source': stk.supplier || 'N/A',
      'Procured Units': stk.totalQuantity,
      'Sold Units': stats.unitsSold,
      'Remaining Units': remainingUnits,
      'Total Investment (PKR)': stk.purchaseCostPKR,
      'Avg Unit Cost (PKR)': stk.totalQuantity > 0 ? Math.round(stk.purchaseCostPKR / stk.totalQuantity) : 0,
      'Revenue Generated (PKR)': stats.revenue,
      'Cost of Sold (PKR)': stats.costOfSold,
      'Realized Profit (PKR)': profit,
      'Profit Margin %': profitMargin,
      'Investment Recovery (PKR)': recoveryPKR,
      'Paid / Collected (PKR)': stats.paidPKR,
      'Outstanding / Pending (PKR)': stats.outstandingPKR,
    };
  });

  if (summaryRows.length > 0) {
    summaryRows.push({
      'Stock Batch #': 'CONSOLIDATED TOTALS',
      'Stock Name / Reference': `${stocks.length} Stock Batches`,
      'Arrival Date': '',
      'Status': '',
      'Supplier / Source': '',
      'Procured Units': grandTotalProcured,
      'Sold Units': grandTotalSold,
      'Remaining Units': grandTotalRemaining,
      'Total Investment (PKR)': grandTotalInvestment,
      'Avg Unit Cost (PKR)': 0,
      'Revenue Generated (PKR)': grandTotalRevenue,
      'Cost of Sold (PKR)': grandTotalCostOfSold,
      'Realized Profit (PKR)': grandTotalProfit,
      'Profit Margin %': grandTotalRevenue > 0 ? Math.round((grandTotalProfit / grandTotalRevenue) * 100) : 0,
      'Investment Recovery (PKR)': grandTotalRevenue - grandTotalInvestment,
      'Paid / Collected (PKR)': grandTotalPaid,
      'Outstanding / Pending (PKR)': grandTotalOutstanding,
    });
  }

  // Sheet 2: All Inventory Items Across All Stocks with clear Stock ID & Name columns
  const allInventoryRows = inventory.map((inv) => {
    const parentStock = stocks.find((s) => s.id === inv.stockId);
    return {
      'Stock Batch #': parentStock ? parentStock.batchNumber : inv.stockBatchNumber || 'Unassigned',
      'Stock Name': parentStock ? parentStock.stockName : inv.stockName || 'Direct Inventory',
      'Item ID': inv.id,
      'Item Type': inv.itemType || 'New Bike',
      'Make': inv.make,
      'Model': inv.model,
      'Variant': inv.variant || '-',
      'Chassis Number': inv.chassisNumber ? `'${inv.chassisNumber}` : '-',
      'Engine Number': inv.engineNumber ? `'${inv.engineNumber}` : '-',
      'Color': inv.color || '-',
      'Status': inv.status,
      'Quantity': inv.stockCount,
      'Purchase Price (PKR)': inv.purchasePricePKR,
      'Selling Price (PKR)': inv.sellingPricePKR,
    };
  });

  const workbook = XLSX.utils.book_new();

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary['!cols'] = autoFitColumns(summaryRows);
  XLSX.utils.book_append_sheet(workbook, wsSummary, 'All Stocks Summary');

  if (allInventoryRows.length > 0) {
    const wsAllInv = XLSX.utils.json_to_sheet(allInventoryRows);
    wsAllInv['!cols'] = autoFitColumns(allInventoryRows);
    XLSX.utils.book_append_sheet(workbook, wsAllInv, 'All Stock Items');
  }

  const cleanDate = new Date().toISOString().split('T')[0];
  const filename = `${showroomName.replace(/\s+/g, '_')}_Consolidated_All_Stocks_Report_${cleanDate}.xlsx`;
  saveWorkbook(workbook, filename);
}
