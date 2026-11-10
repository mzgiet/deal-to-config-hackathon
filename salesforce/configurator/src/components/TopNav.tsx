import { ChevronLeft, Layers, ShoppingCart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store';
import { useProducts } from '../hooks/useProducts';

export default function TopNav() {
  const { activeCategory, setCategory, cart, openOffer } = useStore();
  const { catalogs, categories } = useProducts();

  return (
    <nav className="sticky top-0 z-50 glass border-b border-syn-border shrink-0">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-4">

        {/* Synechron logo mark */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-syn-gradient flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm tracking-tight">S</span>
          </div>
          <div className="leading-none">
            <div className="text-syn-text font-semibold text-sm tracking-wider">SYNECHRON</div>
            <div className="text-syn-muted text-[10px] tracking-widest uppercase">Telco Catalog</div>
          </div>
        </div>

        <div className="w-px h-7 bg-syn-border mx-1" />

        {/* Catalog tag */}
        <div className="flex items-center gap-2">
          <Layers size={13} className="text-syn-muted" />
          {catalogs.map((cat) => (
            <span
              key={cat.id}
              className="text-xs font-medium text-syn-secondary bg-syn-card border border-syn-border px-2.5 py-1 rounded-full"
            >
              {cat.name}
            </span>
          ))}
        </div>

        {/* Breadcrumb / back navigation */}
        {activeCategory && (
          <>
            <div className="w-px h-7 bg-syn-border mx-1" />
            <button
              onClick={() => setCategory(null)}
              className="flex items-center gap-1.5 text-syn-secondary hover:text-syn-text text-sm transition-colors group"
            >
              <ChevronLeft
                size={15}
                className="group-hover:-translate-x-0.5 transition-transform duration-150"
              />
              <span>Categories</span>
            </button>

            <span className="text-syn-border">/</span>

            <div className="flex items-center gap-1.5">
              <span className="text-base leading-none">{activeCategory.icon}</span>
              <span className="text-syn-text text-sm font-medium">{activeCategory.name}</span>
            </div>
          </>
        )}

        {/* ── Right side ─────────────────────────────────────────────────── */}
        <div className="ml-auto flex items-center gap-2">
          {/* Category quick-jump pills (only when in a category) */}
          {activeCategory && (
            <div className="flex items-center gap-1 mr-2">
              {categories.map((cat) => (
                <button
                  key={cat.code}
                  onClick={() => setCategory(cat)}
                  title={cat.name}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-base transition-all duration-150 ${
                    cat.code === activeCategory.code
                      ? 'bg-syn-card-hover ring-1 ring-syn-border-bright'
                      : 'text-syn-muted hover:bg-syn-card hover:text-syn-secondary'
                  }`}
                >
                  {cat.icon}
                </button>
              ))}
            </div>
          )}

          {/* ── Animated Review Cart button ─────────────────────────────── */}
          <AnimatePresence>
            {cart.length > 0 && (
              <motion.button
                key="review-cart"
                initial={{ opacity: 0, scale: 0.8, x: 12 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8, x: 12 }}
                transition={{ type: 'spring', damping: 18, stiffness: 320 }}
                onClick={() => openOffer()}
                className="relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-syn-accent text-syn-on-accent overflow-hidden group"
              >
                {/* Subtle shimmer sweep on hover */}
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />

                <ShoppingCart size={14} className="relative z-10 shrink-0" />
                <span className="relative z-10">Review Cart</span>

                {/* Count badge — pulses */}
                <motion.span
                  key={cart.length}
                  initial={{ scale: 1.4 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 10, stiffness: 400 }}
                  className="relative z-10 flex items-center justify-center w-5 h-5 rounded-full bg-white/20 text-[11px] font-bold leading-none"
                >
                  {cart.length}
                </motion.span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </nav>
  );
}
