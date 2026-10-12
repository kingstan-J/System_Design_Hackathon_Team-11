import React from 'react';
import { Zap, ShieldCheck, User as UserIcon, LogOut, PlusCircle, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ onOpenAuth, onOpenAdminCreate, searchQuery, setSearchQuery }) {
  const { user, isAdmin, logout } = useAuth();

  return (
    <header className="border-b border-slate-800/80 bg-slate-900/70 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <div className="flex items-center space-x-3 shrink-0">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-rose-500 p-0.5 glow-cyan">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Zap className="h-5 w-5 text-cyan-400 fill-cyan-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl font-black tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-sky-300 to-rose-400 font-['Outfit']">
                SALESTORM
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/60">
                Flash Scale
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block">SYSCRAFTERS 2026 Concurrency Architecture</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex-1 max-w-md hidden md:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search products, phones, wearables..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-9 pr-4 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
            />
          </div>
        </div>

        {/* User Controls */}
        <div className="flex items-center space-x-3">
          {isAdmin && (
            <button
              onClick={onOpenAdminCreate}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/30 text-xs font-semibold transition"
            >
              <PlusCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Add Product</span>
            </button>
          )}

          {user ? (
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700">
                <div className={`h-2 w-2 rounded-full ${isAdmin ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`}></div>
                <div className="text-left">
                  <p className="text-xs font-semibold text-white leading-none">{user.name}</p>
                  <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                    {user.role} • {user.email}
                  </p>
                </div>
              </div>
              <button
                onClick={logout}
                title="Log Out"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/80 hover:text-rose-400 text-slate-400 border border-slate-700 transition"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-xs shadow-md shadow-cyan-500/20 transition"
            >
              <UserIcon className="h-4 w-4" />
              <span>Log In / Sign Up</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
