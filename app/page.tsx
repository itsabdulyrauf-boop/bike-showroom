'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/Header';
import { QuickPOS } from '@/components/QuickPOS';
import { InventoryManager } from '@/components/InventoryManager';
import { SalesHistory } from '@/components/SalesHistory';
import { ExpenseTracker } from '@/components/ExpenseTracker';
import { CustomerManager } from '@/components/CustomerManager';
import { AnalyticsDashboard } from '@/components/AnalyticsDashboard';
import { SyncCenter } from '@/components/SyncCenter';
import { InvoiceModal } from '@/components/InvoiceModal';
import { LoginForm } from '@/components/LoginForm';
import { SaleRecord, ShowroomSettings, PendingSyncCounts } from '@/types';
import { seedInitialDataIfEmpty, getShowroomSettings, getPendingSyncCounts } from '@/lib/db';
import { getStoredSessionUser, getAuthCredentials } from '@/lib/authService';
import { INITIAL_SHOWROOM_SETTINGS } from '@/lib/sampleData';
import { getFirebaseAnalytics } from '@/lib/firebase';
import { syncAllDataWithFirebase } from '@/lib/syncEngine';

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const session = getStoredSessionUser();
      return !!session;
    }
    return false;
  });

  const [currentUserEmail, setCurrentUserEmail] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const session = getStoredSessionUser();
      return session?.email || 'admin@bikeshowroom.com';
    }
    return 'admin@bikeshowroom.com';
  });

  const [activeTab, setActiveTab] = useState<string>('pos');
  const [settings, setSettings] = useState<ShowroomSettings>(INITIAL_SHOWROOM_SETTINGS);
  const [pendingCounts, setPendingCounts] = useState<PendingSyncCounts>({
    inventory: 0,
    sales: 0,
    customers: 0,
    expenses: 0,
    total: 0,
  });
  const [selectedSaleForInvoice, setSelectedSaleForInvoice] = useState<SaleRecord | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [dataVersion, setDataVersion] = useState<number>(0);

  const refreshState = useCallback(async () => {
    try {
      const st = await getShowroomSettings();
      setSettings(st);
      const counts = await getPendingSyncCounts();
      setPendingCounts(counts);

      const creds = await getAuthCredentials();
      if (creds && creds.email) {
        setCurrentUserEmail(creds.email);
      }
    } catch (err) {
      console.error('Failed to refresh DB state:', err);
    }
  }, []);

  const handleDataReset = useCallback(async () => {
    setDataVersion((prev) => prev + 1);
    await refreshState();
  }, [refreshState]);

  useEffect(() => {
    let isMounted = true;

    // Hard fallback: never let initialization block for more than 1.5 seconds under any network conditions
    const safetyTimer = setTimeout(() => {
      if (isMounted) {
        setIsInitializing(false);
      }
    }, 1500);

    // Initialize Firebase Analytics on client
    getFirebaseAnalytics().catch(() => {});

    seedInitialDataIfEmpty()
      .then(() => Promise.all([getShowroomSettings(), getPendingSyncCounts(), getAuthCredentials()]))
      .then(([st, counts, creds]) => {
        if (isMounted) {
          clearTimeout(safetyTimer);
          setSettings(st);
          setPendingCounts(counts);
          if (creds && creds.email) {
            setCurrentUserEmail(creds.email);
          }
          setIsInitializing(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load initial DB state:', err);
        if (isMounted) {
          clearTimeout(safetyTimer);
          setIsInitializing(false);
        }
      });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
    };
  }, []);

  // Automatic synchronization whenever internet connection is restored or periodically
  useEffect(() => {
    if (!isAuthenticated) return;

    let isSubscribed = true;

    const performBackgroundSync = async () => {
      if (typeof window === 'undefined' || !navigator.onLine) return;
      try {
        const res = await syncAllDataWithFirebase();
        if (isSubscribed) {
          await refreshState();
          if (
            res.syncedCounts.inventory > 0 ||
            res.syncedCounts.sales > 0 ||
            res.syncedCounts.customers > 0 ||
            res.syncedCounts.expenses > 0
          ) {
            setDataVersion((prev) => prev + 1);
          }
        }
      } catch (err) {
        console.warn('[Auto-Sync] Background sync note:', err);
      }
    };

    // Run once when authenticated & online
    performBackgroundSync();

    const handleOnline = () => {
      console.log('[Auto-Sync] Device online. Uploading pending records to Firebase...');
      performBackgroundSync();
    };

    window.addEventListener('online', handleOnline);

    // Periodic auto-sync every 35 seconds to ensure continuous live cloud backup
    const intervalId = setInterval(performBackgroundSync, 35000);

    return () => {
      isSubscribed = false;
      window.removeEventListener('online', handleOnline);
      clearInterval(intervalId);
    };
  }, [isAuthenticated, refreshState]);

  const handleSaleComplete = (sale: SaleRecord) => {
    setSelectedSaleForInvoice(sale);
    refreshState();
  };

  const handleLoginSuccess = async () => {
    const session = getStoredSessionUser();
    if (session) {
      setCurrentUserEmail(session.email);
    }
    setIsAuthenticated(true);

    // 1. Immediately refresh local state and bump data version so cached data displays instantly
    await refreshState();
    setDataVersion((prev) => prev + 1);

    // 2. If online, immediately pull remote records and upload local data to Firebase
    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        const res = await syncAllDataWithFirebase();
        await refreshState();
        if (
          res.syncedCounts.inventory > 0 ||
          res.syncedCounts.sales > 0 ||
          res.syncedCounts.customers > 0 ||
          res.syncedCounts.expenses > 0
        ) {
          setDataVersion((prev) => prev + 1);
        }
      } catch (err) {
        console.warn('[Login Sync] Initial cloud fetch note:', err);
      }
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white font-sans">
        <div className="flex flex-col items-center gap-3 font-mono">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-300">Initializing Cloud Database Engine & Showroom DB...</p>
        </div>
      </div>
    );
  }

  // Render Login screen if user is not logged in
  if (!isAuthenticated) {
    return (
      <LoginForm
        onLoginSuccess={handleLoginSuccess}
        showroomName={settings.showroomName}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white pb-12">
      {/* Header Bar */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingCounts={pendingCounts}
        onSyncComplete={refreshState}
        showroomName={settings.showroomName}
        userEmail={currentUserEmail}
        onLogout={handleLogout}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {activeTab === 'pos' && (
          <QuickPOS key={`pos-${dataVersion}`} onSaleComplete={handleSaleComplete} settings={settings} />
        )}

        {activeTab === 'inventory' && <InventoryManager key={`inv-${dataVersion}`} />}

        {activeTab === 'sales' && (
          <SalesHistory key={`sales-${dataVersion}`} onSelectSale={(sale) => setSelectedSaleForInvoice(sale)} />
        )}

        {activeTab === 'expenses' && <ExpenseTracker key={`exp-${dataVersion}`} />}

        {activeTab === 'customers' && <CustomerManager key={`cust-${dataVersion}`} />}

        {activeTab === 'analytics' && <AnalyticsDashboard key={`analytics-${dataVersion}`} />}

        {activeTab === 'sync' && (
          <SyncCenter
            key={`sync-${dataVersion}`}
            settings={settings}
            pendingCounts={pendingCounts}
            onSettingsSaved={refreshState}
            onDataReset={handleDataReset}
          />
        )}
      </main>

      {/* Invoice Modal Overlay */}
      <InvoiceModal
        sale={selectedSaleForInvoice}
        settings={settings}
        onClose={() => setSelectedSaleForInvoice(null)}
        onInvoiceUpdated={() => {
          setDataVersion((prev) => prev + 1);
          refreshState();
        }}
      />
    </div>
  );
}
