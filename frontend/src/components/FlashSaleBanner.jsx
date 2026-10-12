import React, { useState, useEffect } from 'react';
import { Flame, Clock, ShieldCheck, Zap } from 'lucide-react';

export default function FlashSaleBanner({ sale, product, onReserveClick }) {
  if (!sale || !product) return null;

  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const calculateTime = () => {
      const difference = new Date(sale.endTime).getTime() - new Date().getTime();
      if (difference > 0) {
        setTimeLeft({
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        });
      } else {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
      }
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000);
    return () => clearInterval(timer);
  }, [sale.endTime]);

  const availableStock = product.inventory?.available ?? sale.configuredStock;
  const totalStock = product.inventory?.total ?? sale.configuredStock;
  const stockPercentage = Math.round((availableStock / totalStock) * 100);

  return (
    <div className="relative overflow-hidden rounded-2xl p-6 sm:p-8 bg-gradient-to-r from-rose-950/70 via-slate-900/90 to-cyan-950/70 border border-rose-500/30 shadow-2xl glow-rose">
      <div className="absolute top-0 right-0 translate-x-12 -translate-y-12 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6">
        {/* Left Information */}
        <div className="space-y-4 max-w-2xl text-center lg:text-left">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold tracking-wide uppercase animate-pulse">
            <Flame className="h-4 w-4 text-rose-400 fill-rose-400" />
            <span>Live Hackathon Flash Sale Event</span>
          </div>

          <div>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight font-['Outfit']">
              {sale.name}
            </h2>
            <p className="text-sm text-slate-300 mt-1">
              Featuring <strong className="text-white">{product.name}</strong>. Highly competitive inventory allocation with zero overselling protection.
            </p>
          </div>

          {/* Pricing & Stock Bar */}
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-black text-rose-400 font-['Outfit']">
                ${sale.flashSalePrice.toFixed(2)}
              </span>
              <span className="text-base text-slate-500 line-through">
                ${product.price.toFixed(2)}
              </span>
              <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-xs font-bold">
                SAVE ${(product.price - sale.flashSalePrice).toFixed(0)}
              </span>
            </div>

            <div className="w-full sm:w-64 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Stock Availability:</span>
                <span className="font-mono font-bold text-white">
                  {availableStock} / {totalStock} Units
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden border border-slate-700">
                <div
                  className="h-full bg-gradient-to-r from-rose-500 to-amber-400 transition-all duration-500"
                  style={{ width: `${stockPercentage}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Countdown & Action */}
        <div className="flex flex-col items-center space-y-4 shrink-0">
          <div className="text-center">
            <p className="text-xs text-slate-400 flex items-center justify-center space-x-1.5 mb-2 font-medium">
              <Clock className="h-4 w-4 text-cyan-400" />
              <span>Flash Sale Ends In:</span>
            </p>
            <div className="flex items-center space-x-2">
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 min-w-[60px] text-center">
                <span className="block text-2xl font-black text-white font-mono">
                  {String(timeLeft.hours).padStart(2, '0')}
                </span>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Hours</span>
              </div>
              <span className="text-xl font-bold text-slate-600">:</span>
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 min-w-[60px] text-center">
                <span className="block text-2xl font-black text-white font-mono">
                  {String(timeLeft.minutes).padStart(2, '0')}
                </span>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Mins</span>
              </div>
              <span className="text-xl font-bold text-slate-600">:</span>
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 min-w-[60px] text-center">
                <span className="block text-2xl font-black text-rose-400 font-mono">
                  {String(timeLeft.seconds).padStart(2, '0')}
                </span>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Secs</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onReserveClick(product)}
            disabled={availableStock <= 0}
            className="w-full px-8 py-3.5 rounded-xl bg-gradient-to-r from-rose-500 via-red-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-white font-extrabold text-sm tracking-wide shadow-xl shadow-rose-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            <Zap className="h-4 w-4 fill-white" />
            <span>{availableStock > 0 ? 'FLASH RESERVE NOW' : 'OUT OF STOCK'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
