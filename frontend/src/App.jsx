import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Zap, Database, Server, Activity, ShieldCheck, 
  Layers, RefreshCw, CheckCircle2, Filter, AlertCircle 
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import AuthModal from './components/AuthModal';
import FlashSaleBanner from './components/FlashSaleBanner';
import ProductCard from './components/ProductCard';
import AdminProductModal from './components/AdminProductModal';
import ReservationModal from './components/ReservationModal';

function MainCatalog() {
  const { user, isAdmin } = useAuth();
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [health, setHealth] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  
  // Modals & Active Workflows
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isAdminCreateOpen, setIsAdminCreateOpen] = useState(false);
  const [activeReservation, setActiveReservation] = useState(null);
  const [isReservationOpen, setIsReservationOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg, type = 'info') => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchCatalogAndTelemetry = async () => {
    try {
      setLoading(true);
      const [productsRes, salesRes, healthRes, metricsRes] = await Promise.all([
        axios.get('/api/products'),
        axios.get('/api/sales'),
        axios.get('/api/health'),
        axios.get('/api/metrics'),
      ]);

      setProducts(productsRes.data.products || []);
      setSales(salesRes.data.sales || []);
      setHealth(healthRes.data);
      setMetrics(metricsRes.data);
    } catch (err) {
      console.error('Failed to sync catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalogAndTelemetry();
    const interval = setInterval(fetchCatalogAndTelemetry, 10000);
    return () => clearInterval(interval);
  }, []);

  const activeFlashSale = sales.find((s) => s.computedStatus === 'ACTIVE' || s.status === 'ACTIVE');
  const flashSaleProduct = products.find((p) => p.flashSale && p.flashSale.id === activeFlashSale?._id) 
    || products.find((p) => p.name === 'Quantum HyperPhone 15 Pro');

  const categories = ['ALL', 'Smartphones', 'Audio', 'Wearables', 'Peripherals'];

  const filteredProducts = products.filter((p) => {
    const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleProductReserve = async (product) => {
    if (!user) {
      setIsAuthOpen(true);
      return;
    }

    try {
      // Deterministic idempotency key for this customer session & product, or timestamped unique key
      const idempotencyKey = `user_res_${user.id}_${product._id}_${Date.now()}`;
      
      const res = await axios.post('/api/reservations', {
        productId: product._id,
        quantity: 1,
        idempotencyKey,
      });

      setActiveReservation(res.data.reservation);
      setIsReservationOpen(true);
      fetchCatalogAndTelemetry(); // Immediate sync of decremented available stock
      showToast('Inventory unit reserved successfully!', 'success');
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to reserve stock.';
      if (err.response?.status === 409) {
        showToast('⚡ FLASH SALE ITEM IS OUT OF STOCK!', 'error');
      } else {
        showToast(errMsg, 'error');
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenAdminCreate={() => setIsAdminCreateOpen(true)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className={`fixed top-20 right-6 z-50 p-4 rounded-xl shadow-2xl border text-xs font-bold animate-in fade-in slide-in-from-top-4 flex items-center space-x-2 ${
          toastMessage.type === 'error'
            ? 'bg-rose-950/90 text-rose-300 border-rose-800'
            : 'bg-emerald-950/90 text-emerald-300 border-emerald-800'
        }`}>
          {toastMessage.type === 'error' ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          <span>{toastMessage.msg}</span>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Active Flash Sale Hero Banner */}
        {activeFlashSale && flashSaleProduct && (
          <FlashSaleBanner
            sale={activeFlashSale}
            product={flashSaleProduct}
            onReserveClick={handleProductReserve}
          />
        )}

        {/* Category Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 sm:pb-0">
            <Filter className="h-4 w-4 text-slate-500 mr-1 shrink-0" />
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-3 text-xs text-slate-400">
            <span>Showing <strong className="text-white">{filteredProducts.length}</strong> items</span>
            <button
              onClick={fetchCatalogAndTelemetry}
              disabled={loading}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:text-white transition"
              title="Refresh Catalog"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Product Catalog Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white font-['Outfit']">Catalog Offerings</h2>
            <span className="text-xs text-slate-400">Authoritative stock directly synced from MongoDB</span>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="glass-panel rounded-2xl p-12 text-center border border-slate-800 space-y-3">
              <AlertCircle className="h-8 w-8 text-slate-500 mx-auto" />
              <p className="text-sm text-slate-300">No products match your current search or category filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product._id}
                  product={product}
                  onSelect={handleProductReserve}
                />
              ))}
            </div>
          )}
        </div>

        {/* Telemetry Diagnostics Matrix */}
        <div className="glass-panel rounded-xl p-6 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Activity className="h-4 w-4 text-cyan-400" />
              <span>Real-Time System Telemetry & Cluster State</span>
            </h3>
            <span className="text-[11px] text-emerald-400 font-mono">
              MongoDB State: {health?.database?.state || 'connected'} ({health?.database?.readyState ?? 1})
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
              <span className="text-slate-400 block">Active MongoDB Database</span>
              <span className="font-mono text-cyan-300 font-semibold">{health?.database?.dbName || 'salestorm'}</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
              <span className="text-slate-400 block">Node.js Heap Allocation</span>
              <span className="font-mono text-white font-semibold">{metrics?.memory?.heapUsedMb ?? '--'} MB</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
              <span className="text-slate-400 block">Current User Role</span>
              <span className="font-mono text-amber-300 font-semibold">{user ? `${user.role} (${user.email})` : 'Anonymous Guest'}</span>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        SALESTORM Flash Sale Management System — Phase 3 Verified (SYSCRAFTERS 2026)
      </footer>

      {/* Modals */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      <AdminProductModal
        isOpen={isAdminCreateOpen}
        onClose={() => setIsAdminCreateOpen(false)}
        onCreated={fetchCatalogAndTelemetry}
      />
      <ReservationModal
        isOpen={isReservationOpen}
        onClose={() => setIsReservationOpen(false)}
        reservation={activeReservation}
        onReleased={() => {
          showToast('Reservation released. Stock returned to inventory.', 'info');
          fetchCatalogAndTelemetry();
        }}
        onProceedToPayment={(res) => {
          alert(`Proceeding to Simulated Payment for Reservation ${res.reservationId}. Ready for Phase 4!`);
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainCatalog />
    </AuthProvider>
  );
}
