'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ShowroomSettings, PendingSyncCounts } from '@/types';
import { performManualCloudSync, SyncResult } from '@/lib/syncEngine';
import { saveShowroomSettings, clearAllLocalData, clearCompleteDatabase } from '@/lib/db';
import { firebaseConfig, verifyLiveFirestoreWrite } from '@/lib/firebase';
import { updateLoginCredentials, getAuthCredentials } from '@/lib/authService';
import {
  exportDatabaseBackupJSON,
  restoreDatabaseBackupJSON,
  exportInventoryCSV,
  exportCustomersCSV,
  exportSalesCSV,
  exportExpensesCSV,
} from '@/lib/backupService';
import {
  CloudUpload,
  Database,
  Wifi,
  WifiOff,
  CheckCircle2,
  AlertCircle,
  Download,
  Upload,
  RefreshCw,
  Building2,
  FileText,
  ShieldCheck,
  Save,
  KeyRound,
  FileSpreadsheet,
  Lock,
  Mail,
  Trash2,
  AlertTriangle,
  X,
  Loader2,
} from 'lucide-react';

interface SyncCenterProps {
  settings: ShowroomSettings;
  pendingCounts: PendingSyncCounts;
  onSettingsSaved: () => void;
  onDataReset: () => void;
}

export const SyncCenter: React.FC<SyncCenterProps> = ({
  settings,
  pendingCounts,
  onSettingsSaved,
  onDataReset,
}) => {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof window !== 'undefined') return navigator.onLine;
    return true;
  });
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<{ success?: boolean; message?: string; loading?: boolean } | null>(null);

  // Settings form
  const [showroomForm, setShowroomForm] = useState<ShowroomSettings>(settings);
  const [settingsSavedMessage, setSettingsSavedMessage] = useState<boolean>(false);
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);

  // Auth credentials form
  const [currentPass, setCurrentPass] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [authMsg, setAuthMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isAuthUpdating, setIsAuthUpdating] = useState(false);

  // Backup & Import states
  const [isBackupLoading, setIsBackupLoading] = useState(false);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Restore Modal State
  const [pendingRestoreData, setPendingRestoreData] = useState<any | null>(null);
  const [restoreFileName, setRestoreFileName] = useState<string>('');
  const [restoreMode, setRestoreMode] = useState<'merge' | 'overwrite'>('merge');
  const [isRestoring, setIsRestoring] = useState(false);

  // Clear / Reset test data states
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isClearingData, setIsClearingData] = useState(false);
  const [clearSuccessMsg, setClearSuccessMsg] = useState<string | null>(null);

  // Sync settings form state when settings prop updates
  const [prevSettings, setPrevSettings] = useState(settings);
  if (prevSettings !== settings) {
    setPrevSettings(settings);
    setShowroomForm(settings);
  }

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Fetch current auth email for form default
    getAuthCredentials().then((creds) => {
      setNewEmail(creds.email);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleTriggerSync = async () => {
    setIsSyncing(true);
    const result = await performManualCloudSync();
    setIsSyncing(false);
    setLastSyncResult(result);
    if (result.success) {
      onSettingsSaved();
    }
  };

  const handleVerifyWrite = async () => {
    setVerifyStatus({ loading: true, message: 'Testing direct write and server confirmation with Cloud Database...' });
    const res = await verifyLiveFirestoreWrite();
    setVerifyStatus({ loading: false, success: res.success, message: res.message });
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      await saveShowroomSettings(showroomForm);
      setSettingsSavedMessage(true);
      onSettingsSaved();
      setTimeout(() => setSettingsSavedMessage(false), 3000);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleUpdateAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthMsg(null);

    if (newPass !== confirmPass) {
      setAuthMsg({ type: 'error', text: 'New password and confirmation password do not match.' });
      return;
    }

    setIsAuthUpdating(true);
    const res = await updateLoginCredentials(currentPass, newEmail, newPass);
    setIsAuthUpdating(false);

    if (res.success) {
      setAuthMsg({ type: 'success', text: 'Login credentials successfully updated and synced to Cloud Database!' });
      setCurrentPass('');
      setNewPass('');
      setConfirmPass('');
    } else {
      setAuthMsg({ type: 'error', text: res.error || 'Failed to update credentials.' });
    }
  };

  const handleExportJSON = async () => {
    setIsBackupLoading(true);
    try {
      await exportDatabaseBackupJSON();
    } catch (err: any) {
      alert('Failed to export database backup: ' + err.message);
    } finally {
      setIsBackupLoading(false);
    }
  };

  const handleImportJSONFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus(null);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        const json = JSON.parse(text);

        if (!json || typeof json !== 'object') {
          setImportStatus({ type: 'error', text: 'Invalid JSON file: file content is not a valid object.' });
          return;
        }

        setPendingRestoreData(json);
        setRestoreFileName(file.name);
        setRestoreMode('merge');
      } catch (err: any) {
        setImportStatus({ type: 'error', text: 'Invalid JSON backup file: ' + err.message });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteRestore = async () => {
    if (!pendingRestoreData) return;
    setIsRestoring(true);
    try {
      const res = await restoreDatabaseBackupJSON(pendingRestoreData, restoreMode);
      setIsRestoring(false);
      setPendingRestoreData(null);
      if (res.success) {
        setImportStatus({ type: 'success', text: res.message });
        onDataReset();
      } else {
        setImportStatus({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      setIsRestoring(false);
      setPendingRestoreData(null);
      setImportStatus({ type: 'error', text: 'Failed to restore: ' + err.message });
    }
  };

  const handleOpenClearModal = () => {
    setIsClearModalOpen(true);
  };

  const handleConfirmClearDatabase = async () => {
    setIsClearingData(true);
    setClearSuccessMsg(null);
    try {
      const res = await clearCompleteDatabase(true);
      setIsClearingData(false);
      setIsClearModalOpen(false);
      setClearSuccessMsg(
        `Production reset complete! Purged ${res.clearedCounts.inventory} inventory, ${res.clearedCounts.sales} sales, ${res.clearedCounts.customers} customers, and ${res.clearedCounts.expenses} expenses from local storage and Cloud Database. System is now 100% clean.`
      );
      onDataReset();
    } catch (err: any) {
      setIsClearingData(false);
      setIsClearModalOpen(false);
      setClearSuccessMsg(`Reset completed with note: ${err?.message || 'Database cleared.'}`);
      onDataReset();
    }
  };

  return (
    <div className="space-y-6">
      {/* Clear Database Success Alert */}
      {clearSuccessMsg && (
        <div className="bg-emerald-950/90 border border-emerald-700 text-emerald-100 p-4 rounded-2xl flex items-center justify-between gap-3 shadow-xl">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="text-xs font-mono">{clearSuccessMsg}</span>
          </div>
          <button
            onClick={() => setClearSuccessMsg(null)}
            className="p-1 text-emerald-400 hover:text-white rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CLOUD SYNC CONTROLS & DIAGNOSTICS SECTIONS (COMMENTED OUT AS REQUESTED)   */}
      {/* (You can easily uncomment any of these blocks below in the future)        */}
      {/* ========================================================================= */}

      {/* 
      // Top Banner - Manual Sync & Direct Server Write Verification
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-slate-800 text-slate-300 rounded-lg border border-slate-700">
              <CloudUpload className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-bold font-mono tracking-tight">Sync Center & Database Administration</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time Cloud database sync, database backup/restore, import/export, and security credentials
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleVerifyWrite}
            disabled={verifyStatus?.loading}
            className="py-2.5 px-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all"
          >
            <ShieldCheck className={`w-4 h-4 text-emerald-400 ${verifyStatus?.loading ? 'animate-spin' : ''}`} />
            <span>{verifyStatus?.loading ? 'Testing Server Write...' : 'Test Cloud Write'}</span>
          </button>

          <button
            onClick={handleTriggerSync}
            disabled={isSyncing}
            className={`py-2.5 px-5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg transition-all ${
              pendingCounts.total > 0
                ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-amber-600/25'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/25'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing Cloud...' : 'Sync to Cloud Now'}</span>
          </button>
        </div>
      </div>

      {verifyStatus && (
        <div
          className={`p-4 rounded-xl border text-xs font-mono flex items-start gap-3 shadow-md ${
            verifyStatus.loading
              ? 'bg-slate-900 border-indigo-800 text-indigo-300'
              : verifyStatus.success
              ? 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
              : 'bg-rose-950/80 border-rose-800 text-rose-200'
          }`}
        >
          {verifyStatus.loading ? (
            <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin shrink-0 mt-0.5" />
          ) : verifyStatus.success ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          )}
          <div>
            <span className="font-bold block uppercase tracking-wider text-[11px] mb-0.5">
              {verifyStatus.loading
                ? 'Running Direct Cloud Server Test...'
                : verifyStatus.success
                ? 'Cloud Write Confirmed!'
                : 'Cloud Direct Connection Warning'}
            </span>
            <p className="text-[11px] opacity-90 leading-relaxed">{verifyStatus.message}</p>
          </div>
        </div>
      )}

      // Cloud Sync Status & Logs Grid
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        // Network & Local Storage Card
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg text-slate-100 space-y-4">
          <h3 className="font-bold text-sm uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-2 flex items-center justify-between">
            <span>Offline Engine Status</span>
            {isOnline ? (
              <span className="text-emerald-400 text-xs font-mono flex items-center gap-1">
                <Wifi className="w-3.5 h-3.5" /> Online
              </span>
            ) : (
              <span className="text-amber-400 text-xs font-mono flex items-center gap-1">
                <WifiOff className="w-3.5 h-3.5" /> Offline
              </span>
            )}
          </h3>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <span className="text-slate-400">Database Engine:</span>
              <span className="font-mono font-bold text-indigo-400">Cloud DB + IndexedDB</span>
            </div>
            <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <span className="text-slate-400">Pending Inventory:</span>
              <span className="font-mono font-bold text-amber-400">{pendingCounts.inventory}</span>
            </div>
            <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <span className="text-slate-400">Pending Sales:</span>
              <span className="font-mono font-bold text-amber-400">{pendingCounts.sales}</span>
            </div>
            <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <span className="text-slate-400">Pending Customers:</span>
              <span className="font-mono font-bold text-amber-400">{pendingCounts.customers}</span>
            </div>
            <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <span className="text-slate-400">Pending Expenses:</span>
              <span className="font-mono font-bold text-amber-400">{pendingCounts.expenses}</span>
            </div>
          </div>
        </div>

        // Sync Logs
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg text-slate-100 space-y-4 md:col-span-2">
          <h3 className="font-bold text-sm uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-2">
            Cloud Synchronization Logs
          </h3>

          {lastSyncResult ? (
            <div className="space-y-3 text-xs font-mono">
              <div
                className={`p-3 rounded-xl border flex items-center gap-3 ${
                  lastSyncResult.success
                    ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
                    : 'bg-rose-950/60 border-rose-800 text-rose-200'
                }`}
              >
                {lastSyncResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                )}
                <div>
                  <span className="font-bold block">
                    {lastSyncResult.success
                      ? 'Manual Cloud Sync Completed Successfully!'
                      : 'Sync Completed with Errors'}
                  </span>
                  <span className="text-[11px] opacity-80">
                    Timestamp: {new Date(lastSyncResult.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                <div>
                  <span className="text-slate-500 text-[10px] block">INVENTORY</span>
                  <span className="font-bold text-white">
                    {lastSyncResult.syncedCounts.inventory} Synced
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">SALES</span>
                  <span className="font-bold text-white">
                    {lastSyncResult.syncedCounts.sales} Synced
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">CUSTOMERS</span>
                  <span className="font-bold text-white">
                    {lastSyncResult.syncedCounts.customers} Synced
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">EXPENSES</span>
                  <span className="font-bold text-white">
                    {lastSyncResult.syncedCounts.expenses} Synced
                  </span>
                </div>
              </div>

              {lastSyncResult.errors.length > 0 && (
                <div className="bg-rose-950/40 border border-rose-800 p-2.5 rounded-lg text-rose-300 text-[11px]">
                  <strong>Errors:</strong> {lastSyncResult.errors.join(' | ')}
                </div>
              )}

              {lastSyncResult.logs && lastSyncResult.logs.length > 0 && (
                <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl max-h-40 overflow-y-auto font-mono text-[10px] text-slate-300 space-y-1 text-left">
                  <span className="text-slate-500 block uppercase text-[9px] tracking-wider font-bold mb-1">Real-Time Cloud Sync Operations Log:</span>
                  {lastSyncResult.logs.map((log, idx) => (
                    <div key={idx} className="flex items-start gap-1.5 leading-snug">
                      <span className="text-emerald-400 shrink-0">►</span>
                      <span className="text-slate-200">{log}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 text-center text-slate-400 text-xs">
              <p>No manual sync performed in this active session.</p>
              <p className="text-[11px] text-slate-500 mt-1">
                Click &quot;Sync to Cloud Now&quot; above to push changes directly to Cloud Database.
              </p>
            </div>
          )}

          <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
            <button
              onClick={handleOpenClearModal}
              className="px-3.5 py-2 bg-rose-950/80 hover:bg-rose-900 text-rose-200 rounded-xl text-xs font-mono font-bold transition-all border border-rose-700/80 flex items-center gap-2 shadow-lg shadow-rose-950/50"
            >
              <Trash2 className="w-4 h-4 text-rose-400" /> Clear All Test Data (Production Clean)
            </button>
          </div>
        </div>
      </div>
      */}

      {/* Database Backup & Import / Export Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg text-slate-100">
        <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
          <Database className="w-5 h-5 text-indigo-400" />
          <h3 className="font-bold text-base font-mono uppercase tracking-wider">
            Database Backup, Restore & Import / Export
          </h3>
        </div>

        {importStatus && (
          <div
            className={`mb-4 p-3 rounded-xl border text-xs font-mono flex items-center gap-2 ${
              importStatus.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
                : 'bg-rose-950/80 border-rose-800 text-rose-200'
            }`}
          >
            {importStatus.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{importStatus.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          {/* Full Database Backup & Restore */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-indigo-400 font-bold">
              <Download className="w-4 h-4" />
              <span>Full Database JSON Backup & Restore</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Export a complete snapshot containing inventory, sales, customers, expenses, showroom branding, and login configuration into a single JSON file.
            </p>

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                onClick={handleExportJSON}
                disabled={isBackupLoading}
                className="py-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl flex items-center gap-2 shadow-md transition-all"
              >
                <Download className="w-4 h-4" /> Export Full Database (.json)
              </button>

              <label className="py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl flex items-center gap-2 cursor-pointer border border-slate-700 transition-all">
                <Upload className="w-4 h-4 text-emerald-400" /> Import & Restore Backup
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json"
                  onChange={handleImportJSONFile}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Export Individual Collections to CSV */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Collections to CSV</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Export specific data collections to CSV format for external analysis in Excel, Google Sheets, or accounting software.
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={exportInventoryCSV}
                className="py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-slate-200 font-mono rounded-lg border border-slate-800 text-[11px] flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5 text-indigo-400" /> Bikes CSV
              </button>
              <button
                onClick={exportSalesCSV}
                className="py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-slate-200 font-mono rounded-lg border border-slate-800 text-[11px] flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5 text-indigo-400" /> Sales CSV
              </button>
              <button
                onClick={exportCustomersCSV}
                className="py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-slate-200 font-mono rounded-lg border border-slate-800 text-[11px] flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5 text-indigo-400" /> Customers CSV
              </button>
              <button
                onClick={exportExpensesCSV}
                className="py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-slate-200 font-mono rounded-lg border border-slate-800 text-[11px] flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5 text-indigo-400" /> Expenses CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Update Login Email & Password Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg text-slate-100">
        <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-base font-mono uppercase tracking-wider">
              Update Login Email & Password Credentials
            </h3>
          </div>
        </div>

        {authMsg && (
          <div
            className={`mb-4 p-3 rounded-xl border text-xs font-mono flex items-center gap-2 ${
              authMsg.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
                : 'bg-rose-950/80 border-rose-800 text-rose-200'
            }`}
          >
            {authMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{authMsg.text}</span>
          </div>
        )}

        <form onSubmit={handleUpdateAuth} className="space-y-4 text-xs max-w-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 mb-1">Current Password *</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={currentPass}
                  onChange={(e) => setCurrentPass(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">New Login Email *</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="admin@bikeshowroom.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-white font-mono"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 mb-1">New Password *</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="New password (min 4 chars)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Confirm New Password *</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-white font-mono"
                />
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isAuthUpdating}
              className={`py-2.5 px-6 rounded-xl font-bold flex items-center gap-2 transition-all ${
                isAuthUpdating
                  ? 'bg-amber-700 text-white cursor-wait opacity-90'
                  : 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/30'
              }`}
            >
              {isAuthUpdating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Updating Credentials...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Update Login Credentials</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Showroom Configuration Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg text-slate-100">
        <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-base font-mono uppercase tracking-wider">
              Showroom & Invoice Print Branding
            </h3>
          </div>
          {settingsSavedMessage && (
            <span className="text-emerald-400 text-xs font-mono flex items-center gap-1 bg-emerald-950 px-2.5 py-1 rounded border border-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5" /> Settings Saved!
            </span>
          )}
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 mb-1">Showroom Title / Business Name *</label>
              <input
                type="text"
                value={showroomForm.showroomName}
                onChange={(e) => setShowroomForm({ ...showroomForm, showroomName: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Tagline / Subtitle</label>
              <input
                type="text"
                value={showroomForm.tagline}
                onChange={(e) => setShowroomForm({ ...showroomForm, tagline: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 mb-1">Street Address</label>
              <input
                type="text"
                value={showroomForm.address}
                onChange={(e) => setShowroomForm({ ...showroomForm, address: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">City & Country</label>
              <input
                type="text"
                value={showroomForm.city}
                onChange={(e) => setShowroomForm({ ...showroomForm, city: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-slate-400 mb-1">Primary Phone</label>
              <input
                type="text"
                value={showroomForm.phonePrimary}
                onChange={(e) => setShowroomForm({ ...showroomForm, phonePrimary: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Secondary Phone</label>
              <input
                type="text"
                value={showroomForm.phoneSecondary}
                onChange={(e) => setShowroomForm({ ...showroomForm, phoneSecondary: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Tax NTN Number</label>
              <input
                type="text"
                value={showroomForm.ntnNumber}
                onChange={(e) => setShowroomForm({ ...showroomForm, ntnNumber: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Sales Tax STRN Number</label>
              <input
                type="text"
                value={showroomForm.strnNumber}
                onChange={(e) => setShowroomForm({ ...showroomForm, strnNumber: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Invoice Print Terms & Conditions</label>
            <textarea
              rows={3}
              value={showroomForm.invoiceTerms}
              onChange={(e) => setShowroomForm({ ...showroomForm, invoiceTerms: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white leading-relaxed font-sans"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSavingSettings}
              className={`py-2.5 px-6 rounded-xl font-bold flex items-center gap-2 transition-all ${
                isSavingSettings
                  ? 'bg-indigo-700 text-white cursor-wait opacity-90'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
              }`}
            >
              {isSavingSettings ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Settings...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Showroom Branding</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Restore Database Confirmation & Options Modal */}
      {pendingRestoreData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-indigo-700/80 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 text-white">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-950 text-indigo-400 border border-indigo-800 rounded-xl shrink-0">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-indigo-200 font-mono">
                    Restore Database Backup
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    File: <span className="font-mono text-slate-200">{restoreFileName}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPendingRestoreData(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Summary */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5">
              <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block font-mono">
                Detected Backup Contents:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs font-mono">
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-lg font-bold text-indigo-400">
                    {Array.isArray(pendingRestoreData.inventory)
                      ? pendingRestoreData.inventory.length
                      : Array.isArray(pendingRestoreData.bikes)
                      ? pendingRestoreData.bikes.length
                      : 0}
                  </div>
                  <div className="text-[10px] text-slate-400">Motorcycles</div>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-lg font-bold text-emerald-400">
                    {Array.isArray(pendingRestoreData.sales) ? pendingRestoreData.sales.length : 0}
                  </div>
                  <div className="text-[10px] text-slate-400">Sales / Invoices</div>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-lg font-bold text-amber-400">
                    {Array.isArray(pendingRestoreData.customers) ? pendingRestoreData.customers.length : 0}
                  </div>
                  <div className="text-[10px] text-slate-400">Customers</div>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-lg font-bold text-rose-400">
                    {Array.isArray(pendingRestoreData.expenses) ? pendingRestoreData.expenses.length : 0}
                  </div>
                  <div className="text-[10px] text-slate-400">Expenses</div>
                </div>
              </div>
            </div>

            {/* Restore Mode Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block font-mono">
                Select Restore Mode:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRestoreMode('merge')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    restoreMode === 'merge'
                      ? 'bg-indigo-950/80 border-indigo-500 text-indigo-100 ring-1 ring-indigo-500'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold text-xs font-mono text-indigo-300">Merge with Existing</div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Adds imported records to current database without deleting existing items.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setRestoreMode('overwrite')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    restoreMode === 'overwrite'
                      ? 'bg-rose-950/80 border-rose-500 text-rose-100 ring-1 ring-rose-500'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold text-xs font-mono text-rose-300">Clean & Replace (Overwrite)</div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Wipes current data first, then restores exact backup snapshot.
                  </div>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                disabled={isRestoring}
                onClick={() => setPendingRestoreData(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-all border border-slate-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isRestoring}
                onClick={handleExecuteRestore}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold font-mono transition-all flex items-center gap-2 shadow-lg shadow-indigo-900/50 disabled:opacity-50"
              >
                {isRestoring ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Restoring Records...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Execute Restore</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Production Clear Confirmation Modal */}
      {isClearModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-rose-800/80 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-white">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-rose-950 text-rose-400 border border-rose-800 rounded-xl shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-rose-200 font-mono">
                  Clear All Test & Demo Data?
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  This will permanently delete all records across your system, including:
                </p>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs font-mono">
              <div className="flex items-center gap-2 text-slate-300">
                <span className="text-rose-400">✗</span> All Motorcycle Inventory items
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <span className="text-rose-400">✗</span> All POS Sales Records & Invoices
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <span className="text-rose-400">✗</span> All Customer profiles & ledger history
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <span className="text-rose-400">✗</span> All Expense & Shop utility logs
              </div>
              <div className="flex items-center gap-2 text-amber-300 pt-1 border-t border-slate-800/60 font-semibold">
                <span>🔥</span> Wipes both Local Offline Cache and Live Cloud Database
              </div>
            </div>

            <div className="text-[11px] text-slate-400">
              After this operation, your system will be completely empty (0 records) and ready for live showroom entry.
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                disabled={isClearingData}
                onClick={() => setIsClearModalOpen(false)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-all border border-slate-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isClearingData}
                onClick={handleConfirmClearDatabase}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold font-mono transition-all flex items-center gap-2 shadow-lg shadow-rose-900/50 disabled:opacity-50"
              >
                {isClearingData ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Wiping Database...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Yes, Permanently Clear All</span>
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
