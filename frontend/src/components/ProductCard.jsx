import React from 'react';
import { ShoppingCart, Flame, ShieldAlert, Check } from 'lucide-react';

export default function ProductCard({ product, onSelect }) {
  const isFlash = Boolean(product.flashSale);
  const availableStock = product.inventory?.available ?? 0;
  const isOutOfStock = availableStock <= 0;

  return (
    <div className="glass-card rounded-2xl overflow-hidden border border-slate-800 hover:border-slate-700 transition flex flex-col group relative">
      {/* Product Image & Badges */}
      <div className="relative aspect-video w-full bg-slate-900 overflow-hidden">
        <img
          src={product.imageUrl}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
          onError={(e) => {
            e.target.src = 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=600&q=80';
          }}
        />

        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <span className="px-2 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-md text-[10px] font-semibold text-slate-300 border border-slate-700">
            {product.category}
          </span>
          {isFlash && (
            <span className="px-2 py-0.5 rounded-md bg-rose-500/90 backdrop-blur-md text-[10px] font-bold text-white flex items-center space-x-1 shadow-md">
              <Flame className="h-3 w-3 fill-white" />
              <span>FLASH SALE</span>
            </span>
          )}
        </div>

        <div className="absolute bottom-3 right-3">
          <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold backdrop-blur-md border ${
            isOutOfStock
              ? 'bg-rose-950/90 text-rose-300 border-rose-800'
              : 'bg-emerald-950/90 text-emerald-300 border-emerald-800'
          }`}>
            {isOutOfStock ? 'Sold Out' : `${availableStock} in Stock`}
          </span>
        </div>
      </div>

      {/* Product Details */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div>
          <h3 className="font-bold text-base text-white group-hover:text-cyan-400 transition font-['Outfit']">
            {product.name}
          </h3>
          <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">
            {product.description}
          </p>
        </div>

        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Price</span>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-lg font-black text-white font-['Outfit']">
                ${(isFlash ? product.flashSale.flashSalePrice : product.price).toFixed(2)}
              </span>
              {isFlash && (
                <span className="text-xs text-slate-500 line-through">
                  ${product.price.toFixed(2)}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => onSelect(product)}
            disabled={isOutOfStock}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
              isOutOfStock
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : isFlash
                ? 'bg-rose-500 hover:bg-rose-400 text-white shadow-md shadow-rose-500/20'
                : 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
            }`}
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            <span>{isOutOfStock ? 'Unavailable' : isFlash ? 'Reserve' : 'Purchase'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
