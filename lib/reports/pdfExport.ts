import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { CustomerItem, InventoryItem, SaleRecord, StockEntry, ExpenseRecord } from '@/types';
import { formatPKR } from '@/lib/currency';

// Helper to draw standard header on first page
function drawReportHeader(
  doc: jsPDF,
  title: string,
  showroomName: string,
  periodLabel: string,
  metaDetails: string[]
) {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Top Accent Bar
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Showroom Name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(showroomName.toUpperCase(), 14, 12);

  // Subtitle / Tagline
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('Showroom Management & Financial Reporting System', 14, 18);

  // Generation timestamp
  const dateStr = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  doc.setFontSize(8);
  doc.text(`Generated: ${dateStr}`, pageWidth - 14, 12, { align: 'right' });
  doc.text(`Period: ${periodLabel}`, pageWidth - 14, 18, { align: 'right' });

  // Report Title Banner
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 38);

  // Metadata Line(s)
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105); // slate-600

  let metaY = 44;
  metaDetails.forEach((line) => {
    doc.text(line, 14, metaY);
    metaY += 5;
  });

  return metaY + 2;
}

// Add page numbering footer to all pages
function applyPageNumbers(doc: jsPDF, showroomName: string) {
  const totalPages = (doc as any).internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');

    // Bottom rule
    doc.setDrawColor(226, 232, 240);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

    doc.text(`${showroomName} - Confidential Business Report`, 14, pageHeight - 7);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - 14, pageHeight - 7, { align: 'right' });
  }
}

// ================= 1. CUSTOMERS PDF EXPORT =================
export function exportCustomersToPdf(
  customers: CustomerItem[],
  sales: SaleRecord[],
  periodLabel: string,
  showroomName: string = 'HS Traders'
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Calculate customer financial totals
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

  let totalSpent = 0;
  let totalPaid = 0;
  let totalBalance = 0;

  const tableBody = customers.map((c, idx) => {
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

    totalSpent += stats.totalSpent;
    totalPaid += stats.totalPaid;
    totalBalance += stats.balance;

    return [
      String(idx + 1),
      c.name,
      c.phone || 'N/A',
      c.cnic || 'N/A',
      c.address || 'N/A',
      String(stats.invoiceCount),
      formatPKR(stats.totalSpent),
      formatPKR(stats.totalPaid),
      formatPKR(stats.balance),
    ];
  });

  const startY = drawReportHeader(
    doc,
    'CUSTOMERS DIRECTORY & FINANCIAL LEDGER',
    showroomName,
    periodLabel,
    [
      `Total Registered Customers: ${customers.length}`,
      `Total Purchases: ${formatPKR(totalSpent)}  |  Total Received: ${formatPKR(totalPaid)}  |  Outstanding Balance: ${formatPKR(totalBalance)}`,
    ]
  );

  autoTable(doc, {
    startY,
    head: [['#', 'Customer Name', 'Phone', 'CNIC', 'Address', 'Invoices', 'Purchases', 'Paid', 'Balance']],
    body: tableBody,
    foot: [
      [
        '',
        `Total (${customers.length})`,
        '',
        '',
        '',
        '',
        formatPKR(totalSpent),
        formatPKR(totalPaid),
        formatPKR(totalBalance),
      ],
    ],
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      font: 'helvetica',
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 32, fontStyle: 'bold' },
      2: { cellWidth: 24 },
      3: { cellWidth: 26 },
      4: { cellWidth: 32 },
      5: { cellWidth: 14, halign: 'center' },
      6: { cellWidth: 22, halign: 'right' },
      7: { cellWidth: 20, halign: 'right' },
      8: { cellWidth: 20, halign: 'right' },
    },
    showHead: 'everyPage',
    showFoot: 'lastPage',
    margin: { top: 32, bottom: 18, left: 14, right: 14 },
  });

  applyPageNumbers(doc, showroomName);

  const cleanDate = new Date().toISOString().split('T')[0];
  doc.save(`${showroomName.replace(/\s+/g, '_')}_Customers_Report_${cleanDate}.pdf`);
}

// ================= 2. INVENTORY PDF EXPORT =================
export function exportInventoryToPdf(
  items: InventoryItem[],
  periodLabel: string,
  showroomName: string = 'HS Traders'
) {
  // Use Landscape for wide technical vehicle tables
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  let totalAvailableUnits = 0;
  let totalSoldUnits = 0;
  let totalPurchaseValue = 0;
  let totalSellingValue = 0;

  const tableBody = items.map((item, idx) => {
    const qty = Number(item.stockCount) || 1;
    const purchaseCost = Number(item.purchasePricePKR) || 0;
    const sellingPrice = Number(item.sellingPricePKR) || 0;

    if (item.status === 'Available') totalAvailableUnits += qty;
    if (item.status === 'Sold') totalSoldUnits += qty;

    totalPurchaseValue += purchaseCost * qty;
    totalSellingValue += sellingPrice * qty;

    return [
      String(idx + 1),
      item.itemType || 'Bike',
      `${item.make} ${item.model}`,
      item.variant || '-',
      item.year || '-',
      item.chassisNumber || '-',
      item.engineNumber || '-',
      item.color || '-',
      item.status,
      item.stockBatchNumber || item.stockName || 'Unassigned',
      String(qty),
      formatPKR(purchaseCost),
      formatPKR(sellingPrice),
    ];
  });

  const startY = drawReportHeader(
    doc,
    'INVENTORY & VEHICLE STOCK AUDIT REPORT',
    showroomName,
    periodLabel,
    [
      `Total Inventory Records: ${items.length}  |  Available Units: ${totalAvailableUnits}  |  Sold Units: ${totalSoldUnits}`,
      `Total Purchase Investment: ${formatPKR(totalPurchaseValue)}  |  Total Sales Valuation: ${formatPKR(totalSellingValue)}`,
    ]
  );

  autoTable(doc, {
    startY,
    head: [
      [
        '#',
        'Type',
        'Make & Model',
        'Variant',
        'Year',
        'Chassis Number',
        'Engine Number',
        'Color',
        'Status',
        'Stock Batch',
        'Qty',
        'Cost (PKR)',
        'Price (PKR)',
      ],
    ],
    body: tableBody,
    foot: [
      [
        '',
        `Total (${items.length})`,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        String(totalAvailableUnits + totalSoldUnits),
        formatPKR(totalPurchaseValue),
        formatPKR(totalSellingValue),
      ],
    ],
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      font: 'helvetica',
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 18 },
      2: { cellWidth: 32, fontStyle: 'bold' },
      3: { cellWidth: 18 },
      4: { cellWidth: 12, halign: 'center' },
      5: { cellWidth: 36, font: 'courier' },
      6: { cellWidth: 30, font: 'courier' },
      7: { cellWidth: 16 },
      8: { cellWidth: 18, halign: 'center' },
      9: { cellWidth: 26 },
      10: { cellWidth: 10, halign: 'center' },
      11: { cellWidth: 26, halign: 'right' },
      12: { cellWidth: 26, halign: 'right' },
    },
    showHead: 'everyPage',
    showFoot: 'lastPage',
    margin: { top: 32, bottom: 18, left: 14, right: 14 },
  });

  applyPageNumbers(doc, showroomName);

  const cleanDate = new Date().toISOString().split('T')[0];
  doc.save(`${showroomName.replace(/\s+/g, '_')}_Inventory_Report_${cleanDate}.pdf`);
}

// ================= 3. INVOICES PDF EXPORT =================
export function exportInvoicesToPdf(
  sales: SaleRecord[],
  periodLabel: string,
  showroomName: string = 'HS Traders'
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  let grandTotal = 0;
  let grandPaid = 0;
  let grandBalance = 0;

  const tableBody = sales.map((sale, idx) => {
    const total = Number(sale.totalPKR) || 0;
    const paid = Number(sale.paidAmountPKR) || 0;
    const balance = Number(sale.balancePKR) || 0;

    grandTotal += total;
    grandPaid += paid;
    grandBalance += balance;

    const itemsStr = (sale.items || [])
      .map((it) => `${it.make} ${it.model}${it.chassisNumber ? ` (${it.chassisNumber})` : ''}`)
      .join('; ');

    const dateStr = sale.createdAt ? new Date(sale.createdAt).toLocaleDateString() : 'N/A';

    return [
      String(idx + 1),
      `#${sale.invoiceNumber}`,
      dateStr,
      sale.customerName || 'Walk-in',
      sale.customerPhone || 'N/A',
      itemsStr || 'Motorcycle Sale',
      sale.paymentStatus,
      sale.paymentMethod,
      formatPKR(total),
      formatPKR(paid),
      formatPKR(balance),
    ];
  });

  const startY = drawReportHeader(
    doc,
    'INVOICES & REVENUE AUDIT REPORT',
    showroomName,
    periodLabel,
    [
      `Total Invoices: ${sales.length}`,
      `Total Invoiced Amount: ${formatPKR(grandTotal)}  |  Total Paid / Collected: ${formatPKR(grandPaid)}  |  Total Outstanding: ${formatPKR(grandBalance)}`,
    ]
  );

  autoTable(doc, {
    startY,
    head: [
      [
        '#',
        'Invoice #',
        'Date',
        'Customer Name',
        'Phone',
        'Billed Items / Vehicles',
        'Payment Status',
        'Method',
        'Total (PKR)',
        'Paid (PKR)',
        'Balance (PKR)',
      ],
    ],
    body: tableBody,
    foot: [
      [
        '',
        `Total (${sales.length})`,
        '',
        '',
        '',
        '',
        '',
        '',
        formatPKR(grandTotal),
        formatPKR(grandPaid),
        formatPKR(grandBalance),
      ],
    ],
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      font: 'helvetica',
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 20, fontStyle: 'bold', font: 'courier' },
      2: { cellWidth: 18 },
      3: { cellWidth: 30, fontStyle: 'bold' },
      4: { cellWidth: 22 },
      5: { cellWidth: 68 },
      6: { cellWidth: 22, halign: 'center' },
      7: { cellWidth: 22 },
      8: { cellWidth: 24, halign: 'right' },
      9: { cellWidth: 22, halign: 'right' },
      10: { cellWidth: 22, halign: 'right' },
    },
    showHead: 'everyPage',
    showFoot: 'lastPage',
    margin: { top: 32, bottom: 18, left: 14, right: 14 },
  });

  applyPageNumbers(doc, showroomName);

  const cleanDate = new Date().toISOString().split('T')[0];
  doc.save(`${showroomName.replace(/\s+/g, '_')}_Invoices_Report_${cleanDate}.pdf`);
}

// ================= 4. INDIVIDUAL STOCK PDF EXPORT =================
export function exportIndividualStockToPdf(
  stock: StockEntry,
  inventory: InventoryItem[],
  sales: SaleRecord[],
  showroomName: string = 'HS Traders'
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Items assigned to this stock
  const stockInventory = inventory.filter(
    (inv) =>
      inv.stockId === stock.id ||
      (inv.stockBatchNumber && inv.stockBatchNumber.trim().toLowerCase() === stock.batchNumber.trim().toLowerCase())
  );

  // Sales matching this stock
  let totalRevenue = 0;
  let totalCostOfSold = 0;
  let unitsSold = 0;
  let paidForStock = 0;
  let pendingForStock = 0;

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
        const price = Number(item.pricePKR) || 0;
        const unitCost =
          Number(item.purchasePricePKR) ||
          (stock.totalQuantity > 0 ? stock.purchaseCostPKR / stock.totalQuantity : 0);
        const rev = price * qty;
        const cost = unitCost * qty;

        unitsSold += qty;
        totalRevenue += rev;
        totalCostOfSold += cost;

        const invoiceTotal = Number(s.totalPKR) || 1;
        const paidRatio = Math.min(1, Math.max(0, (Number(s.paidAmountPKR) || 0) / invoiceTotal));
        paidForStock += Math.round(rev * paidRatio);
        pendingForStock += rev - Math.round(rev * paidRatio);
      }
    });
  });

  const availableUnits = stockInventory.filter((i) => i.status === 'Available').length;
  const realizedProfit = totalRevenue - totalCostOfSold;
  const recoveryPKR = totalRevenue - stock.purchaseCostPKR;

  const startY = drawReportHeader(
    doc,
    `INDIVIDUAL STOCK AUDIT: ${stock.batchNumber}`,
    showroomName,
    stock.stockDate || 'N/A',
    [
      `Stock Name: ${stock.stockName}  |  Status: ${stock.status}  |  Supplier: ${stock.supplier || 'N/A'}`,
      `Procured: ${stock.totalQuantity} Units  |  Sold: ${unitsSold} Units  |  Available: ${availableUnits} Units`,
      `Total Investment: ${formatPKR(stock.purchaseCostPKR)}  |  Total Revenue: ${formatPKR(totalRevenue)}  |  Realized Profit: ${formatPKR(realizedProfit)}`,
      `Total Collected (Paid): ${formatPKR(paidForStock)}  |  Total Pending: ${formatPKR(pendingForStock)}  |  Recovery: ${formatPKR(recoveryPKR)}`,
    ]
  );

  // Table of inventory items in this stock
  const invBody = stockInventory.map((item, idx) => [
    String(idx + 1),
    `${item.make} ${item.model} (${item.variant || '-'})`,
    item.chassisNumber || '-',
    item.engineNumber || '-',
    item.color || '-',
    item.status,
    formatPKR(item.purchasePricePKR),
    formatPKR(item.sellingPricePKR),
  ]);

  autoTable(doc, {
    startY,
    head: [['#', 'Vehicle Model', 'Chassis Number', 'Engine Number', 'Color', 'Status', 'Cost (PKR)', 'Price (PKR)']],
    body: invBody,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      font: 'helvetica',
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 42, fontStyle: 'bold' },
      2: { cellWidth: 36, font: 'courier' },
      3: { cellWidth: 30, font: 'courier' },
      4: { cellWidth: 16 },
      5: { cellWidth: 18, halign: 'center' },
      6: { cellWidth: 24, halign: 'right' },
      7: { cellWidth: 24, halign: 'right' },
    },
    showHead: 'everyPage',
    margin: { top: 32, bottom: 18, left: 14, right: 14 },
  });

  applyPageNumbers(doc, showroomName);

  const cleanBatch = stock.batchNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`${showroomName.replace(/\s+/g, '_')}_Stock_${cleanBatch}_Report.pdf`);
}

// ================= 5. CONSOLIDATED ALL STOCKS PDF EXPORT =================
export function exportConsolidatedStocksToPdf(
  stocks: StockEntry[],
  inventory: InventoryItem[],
  sales: SaleRecord[],
  showroomName: string = 'HS Traders'
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  // Calculate stats for all stocks
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

  stocks.forEach((s) => {
    stockStatsMap.set(s.id, {
      unitsSold: 0,
      revenue: 0,
      costOfSold: 0,
      paidPKR: 0,
      outstandingPKR: 0,
    });
  });

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

  let grandProcured = 0;
  let grandSold = 0;
  let grandRemaining = 0;
  let grandInvestment = 0;
  let grandRevenue = 0;
  let grandCostOfSold = 0;
  let grandProfit = 0;
  let grandPaid = 0;
  let grandOutstanding = 0;

  const tableBody = stocks.map((stk, idx) => {
    const stats = stockStatsMap.get(stk.id) || {
      unitsSold: 0,
      revenue: 0,
      costOfSold: 0,
      paidPKR: 0,
      outstandingPKR: 0,
    };

    const remaining = Math.max(0, stk.totalQuantity - stats.unitsSold);
    const profit = stats.revenue - stats.costOfSold;
    const margin = stats.revenue > 0 ? Math.round((profit / stats.revenue) * 100) : 0;
    const recovery = stats.revenue - stk.purchaseCostPKR;

    grandProcured += stk.totalQuantity;
    grandSold += stats.unitsSold;
    grandRemaining += remaining;
    grandInvestment += stk.purchaseCostPKR;
    grandRevenue += stats.revenue;
    grandCostOfSold += stats.costOfSold;
    grandProfit += profit;
    grandPaid += stats.paidPKR;
    grandOutstanding += stats.outstandingPKR;

    return [
      String(idx + 1),
      stk.batchNumber,
      stk.stockName,
      stk.stockDate || 'N/A',
      stk.status,
      `${stk.totalQuantity} / ${stats.unitsSold} / ${remaining}`,
      formatPKR(stk.purchaseCostPKR),
      formatPKR(stats.revenue),
      formatPKR(profit),
      `${margin}%`,
      formatPKR(recovery),
      formatPKR(stats.paidPKR),
      formatPKR(stats.outstandingPKR),
    ];
  });

  const startY = drawReportHeader(
    doc,
    'CONSOLIDATED ALL STOCKS AUDIT & VALUATION REPORT',
    showroomName,
    'All Time',
    [
      `Total Stock Batches: ${stocks.length}  |  Procured: ${grandProcured}  |  Sold: ${grandSold}  |  Remaining Units: ${grandRemaining}`,
      `Total Investment: ${formatPKR(grandInvestment)}  |  Total Revenue: ${formatPKR(grandRevenue)}  |  Realized Profit: ${formatPKR(grandProfit)}`,
      `Total Paid: ${formatPKR(grandPaid)}  |  Total Outstanding: ${formatPKR(grandOutstanding)}  |  Net Cash Recovery: ${formatPKR(grandRevenue - grandInvestment)}`,
    ]
  );

  autoTable(doc, {
    startY,
    head: [
      [
        '#',
        'Batch #',
        'Stock Name',
        'Date',
        'Status',
        'Proc/Sold/Left',
        'Investment (PKR)',
        'Revenue (PKR)',
        'Profit (PKR)',
        'Margin',
        'Recovery (PKR)',
        'Paid (PKR)',
        'Outstanding (PKR)',
      ],
    ],
    body: tableBody,
    foot: [
      [
        '',
        `Total (${stocks.length})`,
        '',
        '',
        '',
        `${grandProcured} / ${grandSold} / ${grandRemaining}`,
        formatPKR(grandInvestment),
        formatPKR(grandRevenue),
        formatPKR(grandProfit),
        `${grandRevenue > 0 ? Math.round((grandProfit / grandRevenue) * 100) : 0}%`,
        formatPKR(grandRevenue - grandInvestment),
        formatPKR(grandPaid),
        formatPKR(grandOutstanding),
      ],
    ],
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      font: 'helvetica',
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 7, halign: 'center' },
      1: { cellWidth: 24, fontStyle: 'bold', font: 'courier' },
      2: { cellWidth: 32 },
      3: { cellWidth: 16 },
      4: { cellWidth: 16, halign: 'center' },
      5: { cellWidth: 24, halign: 'center' },
      6: { cellWidth: 26, halign: 'right' },
      7: { cellWidth: 26, halign: 'right' },
      8: { cellWidth: 24, halign: 'right' },
      9: { cellWidth: 14, halign: 'center' },
      10: { cellWidth: 24, halign: 'right' },
      11: { cellWidth: 24, halign: 'right' },
      12: { cellWidth: 24, halign: 'right' },
    },
    showHead: 'everyPage',
    showFoot: 'lastPage',
    margin: { top: 32, bottom: 18, left: 14, right: 14 },
  });

  applyPageNumbers(doc, showroomName);

  const cleanDate = new Date().toISOString().split('T')[0];
  doc.save(`${showroomName.replace(/\s+/g, '_')}_Consolidated_All_Stocks_Report_${cleanDate}.pdf`);
}

// ================= 6. ANALYTICS PDF-ONLY EXPORT =================
export async function exportAnalyticsToPdf(
  periodLabel: string,
  kpiData: {
    totalRevenuePKR: number;
    totalActualCostPKR: number;
    totalCogsPKR: number;
    totalExpensePKR: number;
    netProfitPKR: number;
    netMarginPercent: number;
    grossMarginPercent: number;
    totalStockValuationPKR: number;
    totalStockCostValuationPKR: number;
    totalAvailableStockUnits: number;
    totalBikesSold: number;
    salesCount: number;
  },
  topSellingModels: { model: string; count: number; totalPKR: number }[],
  expenseByCategory: { [key: string]: number },
  stockWisePerformance: any[],
  dashboardElement: HTMLElement | null,
  showroomName: string = 'HS Traders'
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Page 1: Header + Executive KPI Overview + Captured Charts
  let currentY = drawReportHeader(
    doc,
    'EXECUTIVE FINANCIAL & OPERATIONAL ANALYTICS REPORT',
    showroomName,
    periodLabel,
    [
      `Period Coverage: ${periodLabel}  |  Showroom Status: Certified Authentic`,
      `Gross Revenue: ${formatPKR(kpiData.totalRevenuePKR)}  |  Net Showroom Profit: ${formatPKR(kpiData.netProfitPKR)} (${kpiData.netMarginPercent}% Net Margin)`,
    ]
  );

  // Executive KPI Summary Table
  const kpiRows = [
    ['Gross Sales Revenue', formatPKR(kpiData.totalRevenuePKR), `${kpiData.salesCount} Invoices (${kpiData.totalBikesSold} Units Billed)`],
    ['Cost of Goods Sold (COGS)', formatPKR(kpiData.totalCogsPKR), 'Direct Vehicle Procurement Investment Cost'],
    ['Operating Showroom Expenses', formatPKR(kpiData.totalExpensePKR), 'Rent, Utilities, Staff, Hospitality & Maintenance'],
    ['Total Actual Cost (COGS + OpEx)', formatPKR(kpiData.totalActualCostPKR), 'All-inclusive showroom expenditures for period'],
    ['Net Showroom Profit', formatPKR(kpiData.netProfitPKR), `Net Margin: ${kpiData.netMarginPercent}% | Gross Margin: ${kpiData.grossMarginPercent}%`],
    ['Available Stock Valuation', formatPKR(kpiData.totalStockValuationPKR), `${kpiData.totalAvailableStockUnits} Available Units (Cost: ${formatPKR(kpiData.totalStockCostValuationPKR)})`],
  ];

  autoTable(doc, {
    startY: currentY,
    head: [['Key Performance Indicator', 'Amount (PKR)', 'Operational Details & Metrics']],
    body: kpiRows,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 60, fontStyle: 'bold' },
      1: { cellWidth: 42, halign: 'right', fontStyle: 'bold' },
      2: { cellWidth: 80 },
    },
    margin: { top: 32, bottom: 18, left: 14, right: 14 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // Render high-res visual chart capture from the DOM if available
  if (dashboardElement) {
    try {
      const canvas = await html2canvas(dashboardElement, {
        scale: 1.8,
        useCORS: true,
        logging: false,
        backgroundColor: '#0f172a',
        ignoreElements: (el) => {
          // Exclude buttons, exports, or controls from the clean capture
          return el.tagName === 'BUTTON' || el.classList.contains('no-pdf-export');
        },
      });

      const imgData = canvas.toDataURL('image/png');
      const imgWidth = pageWidth - 28;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Check remaining space on page 1
      if (currentY + imgHeight > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('Visual Dashboard Charts & Operational Breakdown', 14, currentY);
      currentY += 4;

      doc.addImage(imgData, 'PNG', 14, currentY, imgWidth, Math.min(imgHeight, 180));
      currentY += Math.min(imgHeight, 180) + 8;
    } catch (chartErr) {
      console.warn('Canvas chart capture warning:', chartErr);
    }
  }

  // Page 2: Top Selling Models & Expense Breakdown
  doc.addPage();
  currentY = 20;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Top Selling Motorcycle Models', 14, currentY);
  currentY += 4;

  const modelRows = topSellingModels.map((m, idx) => [
    `#${idx + 1}`,
    m.model,
    `${m.count} Unit(s)`,
    formatPKR(m.totalPKR),
    kpiData.totalRevenuePKR > 0 ? `${Math.round((m.totalPKR / kpiData.totalRevenuePKR) * 100)}%` : '0%',
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Rank', 'Model Name', 'Units Sold', 'Revenue (PKR)', 'Revenue Share']],
    body: modelRows.length > 0 ? modelRows : [['-', 'No models sold in this period', '-', '-', '-']],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.2 },
    headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255] },
    columnStyles: {
      0: { cellWidth: 14, halign: 'center' },
      1: { cellWidth: 70, fontStyle: 'bold' },
      2: { cellWidth: 28, halign: 'center' },
      3: { cellWidth: 40, halign: 'right' },
      4: { cellWidth: 30, halign: 'center' },
    },
    margin: { left: 14, right: 14 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Expense Breakdown Table
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Showroom Operating Expenses by Category', 14, currentY);
  currentY += 4;

  const expRows = Object.entries(expenseByCategory).map(([cat, amount]) => [
    cat,
    formatPKR(amount),
    kpiData.totalExpensePKR > 0 ? `${Math.round((amount / kpiData.totalExpensePKR) * 100)}%` : '0%',
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Expense Category', 'Total Amount (PKR)', 'Percentage of Total OpEx']],
    body: expRows.length > 0 ? expRows : [['No expenses recorded for this period', '0', '0%']],
    foot: [['Total Expenses', formatPKR(kpiData.totalExpensePKR), '100%']],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.2 },
    headStyles: { fillColor: [225, 29, 72], textColor: [255, 255, 255] },
    footStyles: { fillColor: [241, 245, 249], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 90, fontStyle: 'bold' },
      1: { cellWidth: 50, halign: 'right' },
      2: { cellWidth: 42, halign: 'center' },
    },
    margin: { left: 14, right: 14 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Stock-Wise Performance Overview
  if (stockWisePerformance && stockWisePerformance.length > 0) {
    if (currentY > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Stock Batch Performance & Profit Realization', 14, currentY);
    currentY += 4;

    const stockRows = stockWisePerformance.map((stk) => [
      stk.batchNumber,
      stk.stockName,
      `${stk.totalQuantity} / ${stk.soldUnits} / ${stk.remainingUnits}`,
      formatPKR(stk.totalInvestmentPKR),
      formatPKR(stk.totalRevenuePKR),
      formatPKR(stk.profitPKR),
      `${stk.profitMarginPercent}%`,
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Batch #', 'Stock Lot', 'Proc/Sold/Left', 'Investment', 'Revenue', 'Profit', 'Margin']],
      body: stockRows,
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: [8, 145, 178], textColor: [255, 255, 255] },
      columnStyles: {
        0: { cellWidth: 26, fontStyle: 'bold', font: 'courier' },
        1: { cellWidth: 44 },
        2: { cellWidth: 26, halign: 'center' },
        3: { cellWidth: 28, halign: 'right' },
        4: { cellWidth: 28, halign: 'right' },
        5: { cellWidth: 22, halign: 'right' },
        6: { cellWidth: 14, halign: 'center' },
      },
      margin: { left: 14, right: 14 },
    });
  }

  applyPageNumbers(doc, showroomName);

  const cleanDate = new Date().toISOString().split('T')[0];
  doc.save(`${showroomName.replace(/\s+/g, '_')}_Financial_Analytics_${cleanDate}.pdf`);
}
