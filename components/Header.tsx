'use client';

import React, { useState, useEffect } from 'react';
import {
  Bike,
  Wifi,
  WifiOff,
  ShoppingBag,
  Package,
  Receipt,
  DollarSign,
  Users,
  BarChart3,
  Settings,
  LogOut,
  User,
} from 'lucide-react';
import { PendingSyncCounts } from '@/types';
import { logoutUser } from '@/lib/authService';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pendingCounts: PendingSyncCounts;
  onSyncComplete: () => void;
  showroomName: string;
  userEmail?: string;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  pendingCounts,
  onSyncComplete,
  showroomName,
  userEmail = 'admin@bikeshowroom.com',
  onLogout,
}) => {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof window !== 'undefined') return navigator.onLine;
    return true;
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleLogoutClick = async () => {
    await logoutUser();
    if (onLogout) onLogout();
  };

  const tabs = [
    { id: 'pos', label: 'Quick POS', icon: ShoppingBag, color: 'text-emerald-400' },
    { id: 'inventory', label: 'Bike Inventory', icon: Package, color: 'text-blue-400' },
    { id: 'sales', label: 'Invoices & Sales', icon: Receipt, color: 'text-indigo-400' },
    { id: 'expenses', label: 'Expenses', icon: DollarSign, color: 'text-amber-400' },
    { id: 'customers', label: 'Customers', icon: Users, color: 'text-purple-400' },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, color: 'text-rose-400' },
    { id: 'sync', label: 'Sync & Settings', icon: Settings, color: 'text-slate-400' },
  ];

  return (
    <header className="no-print bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Showroom Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Bike className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg leading-tight tracking-tight text-white font-mono">
                  {showroomName || 'Pak Velocity Motors'}
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] uppercase font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800/80 rounded-full">
                  Realtime Cloud POS
                </span>
              </div>
              <p className="text-xs text-slate-400">PKR Currency • Realtime Cloud Engine</p>
            </div>
          </div>

          {/* Network Status, User Email & Actions */}
          <div className="flex items-center gap-3">
            {/* Online / Offline Status Badge */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                isOnline
                  ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
                  : 'bg-amber-950/60 text-amber-400 border-amber-800/60'
              }`}
            >
              <span className="relative flex h-2 w-2">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isOnline ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    isOnline ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
              </span>
              {isOnline ? (
                <span className="flex items-center gap-1">
                  <Wifi className="w-3 h-3" /> Online
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <WifiOff className="w-3 h-3" /> Offline
                </span>
              )}
            </div>

            {/* User Badge & Logout */}
            <div className="hidden lg:flex items-center gap-2 bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-xl text-xs">
              <User className="w-3.5 h-3.5 text-indigo-400" />
              <span className="font-mono text-[11px] text-slate-300 max-w-[140px] truncate">{userEmail}</span>
            </div>

            <button
              onClick={handleLogoutClick}
              title="Logout session"
              className="p-2 bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-300 border border-slate-700 rounded-xl transition-all"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Module Navigation Tabs */}
        <nav className="flex space-x-1 overflow-x-auto scrollbar-none border-t border-slate-800/80 py-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-slate-800 text-white shadow-md border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon className={`w-4 h-4 ${tab.color}`} />
                <span>{tab.label}</span>
                {tab.id === 'sync' && pendingCounts.total > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
