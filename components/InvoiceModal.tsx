'use client';

import React from 'react';
import { SaleRecord, ShowroomSettings } from '@/types';
import { formatPKR, numberToWordsPKR } from '@/lib/currency';
import { Printer, X, CheckCircle, Shield, FileText, Bike, Phone, MapPin, Building2 } from 'lucide-react';

interface InvoiceModalProps {
  sale: SaleRecord | null;
  settings: ShowroomSettings;
  onClose: () => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({ sale, settings, onClose }) => {
  if (!sale) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = new Date(sale.createdAt).toLocaleDateString('en-PK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto no-print-backdrop">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        
        {/* Modal Controls Bar (Hidden during print) */}
        <div className="no-print bg-slate-800/90 px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-950/80 text-emerald-400 border border-emerald-700/50 rounded-lg">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Sales Invoice Generated</h3>
              <p className="text-xs text-slate-400">Invoice #{sale.invoiceNumber} • PKR Currency</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition-all shadow-lg shadow-indigo-600/30"
            >
              <Printer className="w-4 h-4" />
              <span>Print Invoice</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Invoice Container */}
        <div className="p-6 sm:p-8 bg-white text-slate-900 overflow-y-auto font-sans print-area flex-1">
          {/* Invoice Header */}
          <div className="border-b-2 border-slate-900 pb-6 mb-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded bg-slate-900 text-white flex items-center justify-center font-bold">
                    <Bike className="w-5 h-5 text-indigo-400" />
                  </div>
                  <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">
                    {settings.showroomName || 'PAK VELOCITY MOTORS'}
                  </h1>
                </div>
                <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">
                  {settings.tagline || 'AUTHORIZED MOTORCYCLE DEALERSHIP'}
                </p>
                <div className="mt-2 text-xs text-slate-600 space-y-0.5">
                  <p className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>{settings.address}, {settings.city}</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>Tel: {settings.phonePrimary} {settings.phoneSecondary ? `| ${settings.phoneSecondary}` : ''}</span>
                  </p>
                  <div className="flex gap-4 pt-1 font-mono text-[11px] text-slate-700">
                    <span>NTN #: {settings.ntnNumber || '4019283-7'}</span>
                    <span>STRN #: {settings.strnNumber || '32-77-8890-001-99'}</span>
                  </div>
                </div>
              </div>

              {/* Invoice Number Stamp */}
              <div className="bg-slate-100 border border-slate-300 p-4 rounded-xl text-right min-w-[200px]">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                  OFFICIAL SALES RECEIPT
                </span>
                <span className="text-xl font-extrabold text-slate-900 font-mono block my-1">
                  #{sale.invoiceNumber}
                </span>
                <span className="text-xs text-slate-600 block">{formattedDate}</span>
                <span
                  className={`inline-block mt-2 px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                    sale.paymentStatus === 'Paid'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : sale.paymentStatus === 'Partial'
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}
                >
                  STATUS: {sale.paymentStatus}
                </span>
              </div>
            </div>
          </div>

          {/* Customer Information Grid */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 border-b border-slate-200 pb-1">
              BUYER & CUSTOMER INFORMATION
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div>
                <span className="text-slate-500 text-xs block">Customer Full Name:</span>
                <span className="font-bold text-slate-900 text-base">{sale.customerName}</span>
              </div>
              <div>
                <span className="text-slate-500 text-xs block">National ID / CNIC #:</span>
                <span className="font-mono font-bold text-slate-900">
                  {sale.customerCnic || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 text-xs block">Mobile Phone #:</span>
                <span className="font-mono font-bold text-slate-900">
                  {sale.customerPhone || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 text-xs block">Residential / Business Address:</span>
                <span className="text-slate-800">{sale.customerAddress || 'Karachi, Pakistan'}</span>
              </div>
            </div>
          </div>

          {/* Vehicle & Item Specifications Table */}
          <div className="mb-6">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              VEHICLE & ITEM SPECIFICATIONS
            </h2>
            <div className="border border-slate-300 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-900 text-white uppercase text-[11px] font-mono">
                  <tr>
                    <th className="p-3">Vehicle / Item Description</th>
                    <th className="p-3">Chassis / Frame #</th>
                    <th className="p-3">Engine Number</th>
                    <th className="p-3 text-center">Color / Year</th>
                    <th className="p-3 text-right">Rate (PKR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sale.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-3 font-semibold text-slate-900">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{item.make} {item.model}</span>
                          {item.itemType && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300">
                              {item.itemType}
                            </span>
                          )}
                        </div>
                        {item.variant && (
                          <span className="block text-xs font-normal text-slate-600 mt-0.5">
                            {item.variant}
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-mono font-bold text-indigo-900 bg-indigo-50/50">
                        {item.chassisNumber || 'N/A'}
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-800">
                        {item.engineNumber || 'N/A'}
                      </td>
                      <td className="p-3 text-center">
                        <span className="font-medium text-slate-800">{item.color || 'Std'}</span>
                        <span className="text-slate-500 text-xs block">Model {item.year}</span>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        {formatPKR(item.pricePKR)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Registration & Warranty Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 text-xs">
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center gap-3">
              <Shield className="w-5 h-5 text-indigo-600 shrink-0" />
              <div>
                <span className="font-bold text-indigo-950 block">Showroom Warranty:</span>
                <span className="text-indigo-800">
                  {sale.warrantyMonths ? `${sale.warrantyMonths} Months Manufacturer Warranty` : 'Standard Showroom Policy'}
                </span>
              </div>
            </div>
            <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl flex items-center gap-3">
              <FileText className="w-5 h-5 text-slate-600 shrink-0" />
              <div>
                <span className="font-bold text-slate-950 block">Registration Option:</span>
                <span className="text-slate-700">{sale.registrationStatus}</span>
              </div>
            </div>
          </div>

          {/* Financial Totals Calculation in PKR */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-end border-t border-b border-slate-300 py-4 mb-6">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                AMOUNT IN WORDS (PKR):
              </span>
              <p className="text-xs italic font-semibold text-slate-800 bg-amber-50 border border-amber-200 p-2.5 rounded-lg">
                &quot;{numberToWordsPKR(sale.totalPKR)}&quot;
              </p>
              <div className="mt-3 text-xs text-slate-600 space-y-1">
                <p>
                  <span className="font-semibold text-slate-800">Payment Mode:</span>{' '}
                  {sale.paymentMethod}
                </p>
                {sale.accountNumber && (
                  <p>
                    <span className="font-semibold text-slate-800">Account No:</span>{' '}
                    <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300">
                      {sale.accountNumber}
                    </span>
                  </p>
                )}
                {sale.notes && (
                  <p>
                    <span className="font-semibold text-slate-800">Notes / References:</span>{' '}
                    {sale.notes}
                  </p>
                )}
              </div>
            </div>

            {/* Financial Summary Box */}
            <div className="bg-slate-900 text-white rounded-xl p-4 font-mono space-y-2 text-sm">
              <div className="flex justify-between text-xs text-slate-300">
                <span>Subtotal Rate:</span>
                <span>{formatPKR(sale.subtotalPKR)}</span>
              </div>
              {sale.discountPKR > 0 && (
                <div className="flex justify-between text-xs text-emerald-400">
                  <span>Trade Discount:</span>
                  <span>- {formatPKR(sale.discountPKR)}</span>
                </div>
              )}
              {sale.taxPKR > 0 && (
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Tax / Reg Fee:</span>
                  <span>+ {formatPKR(sale.taxPKR)}</span>
                </div>
              )}
              <div className="border-t border-slate-700 pt-2 flex justify-between font-bold text-base text-white">
                <span>Grand Total:</span>
                <span className="text-indigo-300 text-lg">{formatPKR(sale.totalPKR)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-300 pt-1 border-t border-slate-800">
                <span>Amount Paid:</span>
                <span className="text-emerald-400 font-bold">{formatPKR(sale.paidAmountPKR)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-300">
                <span>Remaining Balance:</span>
                <span className={sale.balancePKR > 0 ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                  {formatPKR(sale.balancePKR)}
                </span>
              </div>
            </div>
          </div>

          {/* Footer Terms & Signatures */}
          <div className="text-[11px] text-slate-600 space-y-2">
            <p className="font-bold uppercase text-slate-700">Terms & Conditions:</p>
            <p className="whitespace-pre-line text-slate-500 leading-relaxed">
              {settings.invoiceTerms ||
                '1. All motorcycle purchases are non-refundable after registration.\n2. Engine and chassis numbers must be verified by the buyer before taking delivery.\n3. Showroom registration takes 7-10 working days.'}
            </p>

            <div className="pt-10 flex justify-between items-end">
              <div className="text-center w-48">
                <div className="border-b border-slate-400 mb-1 h-8" />
                <span className="text-slate-700 font-semibold block">Buyer Signature</span>
              </div>
              <div className="text-center w-48">
                <div className="border-b border-slate-400 mb-1 h-8" />
                <span className="text-slate-700 font-semibold block">Authorized Showroom Stamp</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
