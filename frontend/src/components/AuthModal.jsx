import React, { useState } from 'react';
import { X, Lock, Mail, User, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AuthModal({ isOpen, onClose }) {
  const { login, register } = useAuth();
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('CUSTOMER');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegisterMode) {
        await register(name, email, password, role);
      } else {
        await login(email, password);
      }
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (targetRole) => {
    setIsRegisterMode(false);
    if (targetRole === 'ADMIN') {
      setEmail('admin@salestorm.io');
      setPassword('Admin@123');
    } else {
      setEmail('customer@salestorm.io');
      setPassword('Customer@123');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="glass-panel w-full max-w-md rounded-2xl p-6 border border-slate-700/80 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Title */}
        <div className="text-center space-y-1 mb-6">
          <h2 className="text-2xl font-black text-white font-['Outfit']">
            {isRegisterMode ? 'Create SALESTORM Account' : 'Welcome to SALESTORM'}
          </h2>
          <p className="text-xs text-slate-400">
            {isRegisterMode 
              ? 'Register to participate in live high-concurrency flash sales' 
              : 'Sign in to access your reservations, orders, and privileges'}
          </p>
        </div>

        {/* Quick-fill Seed Credentials for Hackathon Judges */}
        <div className="mb-5 p-3 rounded-xl bg-slate-900/80 border border-cyan-500/20 space-y-2">
          <p className="text-[11px] font-semibold text-cyan-300 flex items-center space-x-1">
            <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" />
            <span>Hackathon Quick-Fill Credentials:</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickFill('ADMIN')}
              className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px] font-medium border border-slate-700 text-left transition"
            >
              👑 Fill Admin (Admin@123)
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('CUSTOMER')}
              className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 text-[11px] font-medium border border-slate-700 text-left transition"
            >
              👤 Fill Customer (Customer@123)
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-300 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegisterMode && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Mercer"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="email"
                required
                placeholder="name@salestorm.io"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {isRegisterMode && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="CUSTOMER">CUSTOMER (Standard Purchaser)</option>
                <option value="ADMIN">ADMIN (System Operator)</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-sm shadow-lg shadow-cyan-500/20 transition disabled:opacity-50"
          >
            {loading ? 'Processing...' : isRegisterMode ? 'Complete Registration' : 'Sign In'}
          </button>
        </form>

        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => {
              setIsRegisterMode(!isRegisterMode);
              setError(null);
            }}
            className="text-xs text-cyan-400 hover:text-cyan-300 transition"
          >
            {isRegisterMode 
              ? 'Already have an account? Sign in here' 
              : "Don't have an account? Register now"}
          </button>
        </div>
      </div>
    </div>
  );
}
