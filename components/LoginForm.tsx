'use client';

import React, { useState } from 'react';
import { loginUser } from '@/lib/authService';
import { Bike, Lock, Mail, ShieldCheck, AlertCircle } from 'lucide-react';

interface LoginFormProps {
  onLoginSuccess: () => void;
  showroomName?: string;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onLoginSuccess,
  showroomName = 'Motorcycle Showroom',
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await loginUser(email, password, rememberMe);
      if (res.success) {
        onLoginSuccess();
      } else {
        setError(res.error || 'Authentication failed.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('An error occurred while logging in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans text-slate-100">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-indigo-950/40 relative overflow-hidden">
        {/* Decorative Top Accent */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-amber-500 to-emerald-500" />

        {/* Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center p-3 bg-indigo-950/80 border border-indigo-800/80 rounded-2xl text-indigo-400 mb-3 shadow-lg shadow-indigo-950/50">
            <Bike className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold font-mono tracking-tight text-white">
            {showroomName}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Enterprise Showroom POS & Cloud Inventory Engine
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 bg-rose-950/80 border border-rose-800 text-rose-200 text-xs p-3 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Login Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@bikeshowroom.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-2.5 text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-2.5 text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-0"
              />
              <span>Remember this session</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all uppercase tracking-wider text-xs"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Authenticating...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" /> Secure Showroom Login
              </span>
            )}
          </button>
        </form>

        <div className="mt-6 border-t border-slate-800/80 pt-4 text-center text-[11px] text-slate-500">
          Powered by Realtime Cloud DB & Offline Engine
        </div>
      </div>
    </div>
  );
};
