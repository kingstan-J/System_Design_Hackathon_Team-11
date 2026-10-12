import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Clock, AlertTriangle, CheckCircle2, ShieldCheck, ArrowRight, RotateCcw } from 'lucide-react';

export default function ReservationModal({ isOpen, onClose, reservation, onReleased, onProceedToPayment }) {
  if (!isOpen || !reservation) return null;

  const [timeLeft, setTimeLeft] = useState(120);
  const [releasing, setReleasing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const updateCountdown = () => {
      const remainingMs = new Date(reservation.expiresAt).getTime() - new Date().getTime();
      const seconds = Math.max(0, Math.floor(remainingMs / 1000));
      setTimeLeft(seconds);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [reservation.expiresAt]);

  const handleRelease = async () => {
    try {
      setReleasing(true);
      setError(null);
      await axios.post(`/api/reservations/${reservation.reservationId}/release`);
      onReleased();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to release reservation.');
    } finally {
      setReleasing(false);
    }
  };

  const isExpired = timeLeft <= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="glass-panel w-full max-w-lg rounded-2xl p-6 sm:p-8 border border-slate-700/80 shadow-2xl relative space-y-6">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
              {reservation.status}
            </span>
            <h2 className="text-2xl font-black text-white font-['Outfit'] mt-1">Inventory Reserved</h2>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* Reservation Details Card */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3 text-xs">
          <div className="flex justify-between items-center pb-2 border-b border-slate-800">
            <span className="text-slate-400">Reservation Identifier:</span>
            <span className="font-mono text-cyan-300 font-bold">{reservation.reservationId}</span>
          </div>
          <div className="flex justify-between items-center pb-2 border-b border-slate-800">
            <span className="text-slate-400">Locked Flash Sale Price:</span>
            <span className="font-mono text-white text-sm font-black">${reservation.unitPrice?.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center pb-2 border-b border-slate-800">
            <span className="text-slate-400">Reserved Quantity:</span>
            <span className="font-mono text-slate-200 font-semibold">{reservation.quantity} Unit(s)</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Idempotency Key:</span>
            <span className="font-mono text-slate-400 truncate max-w-[200px]">{reservation.idempotencyKey}</span>
          </div>
        </div>

        {/* Expiry Countdown Clock */}
        <div className={`p-4 rounded-xl border flex items-center justify-between ${
          isExpired
            ? 'bg-rose-950/30 border-rose-800/80 text-rose-300'
            : timeLeft < 30
            ? 'bg-amber-950/30 border-amber-800/80 text-amber-300 animate-pulse'
            : 'bg-cyan-950/30 border-cyan-800/80 text-cyan-300'
        }`}>
          <div className="flex items-center space-x-2">
            <Clock className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-bold text-sm">
                {isExpired ? 'Reservation Expired' : 'Reservation Expires In'}
              </p>
              <p className="text-[11px] opacity-80">
                {isExpired 
                  ? 'Inventory will be returned to pool by background worker' 
                  : 'Complete payment before TTL expires to secure order'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="font-mono text-2xl font-black">
              {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={handleRelease}
            disabled={releasing || isExpired}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-rose-950/80 text-slate-300 hover:text-rose-300 border border-slate-800 hover:border-rose-800 text-xs font-semibold transition disabled:opacity-50 flex items-center justify-center space-x-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>{releasing ? 'Releasing...' : 'Release Stock'}</span>
          </button>

          <button
            type="button"
            onClick={() => onProceedToPayment(reservation)}
            disabled={isExpired}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-cyan-500/20 transition disabled:opacity-50 flex items-center justify-center space-x-1.5"
          >
            <span>Proceed to Checkout</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
