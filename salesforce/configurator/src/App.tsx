import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from './store';
import TopNav from './components/TopNav';
import CategoryGrid from './components/CategoryGrid';
import ProductGrid from './components/ProductGrid';
import ProductCarousel from './components/ProductCarousel';
import ProductDetailDrawer from './components/ProductDetailDrawer';
import LiveStatusBar from './components/LiveStatusBar';
import OfferPage from './components/OfferPage';
import RequestPage from './components/RequestPage';
import { useProducts } from './hooks/useProducts';
import { getRequestIdFromUrl } from './hooks/useRequestOffer';

const pageVariants = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
};

export default function App() {
  const requestId = getRequestIdFromUrl();
  return requestId ? <RequestPage requestId={requestId} /> : <CatalogApp />;
}

function CatalogApp() {
  const { activeCategory, selectedProductId, setSelectedProduct, activeView } = useStore();

  // One hook call — filter locally so selectedProduct always has fresh bundle data
  const { products: allProducts, newProductIds, isFetching, lastUpdatedAt, isLive } = useProducts();

  const products = activeCategory
    ? allProducts.filter((p) => p.categoryCode === activeCategory.code)
    : allProducts;

  const selectedProduct = selectedProductId
    ? allProducts.find((p) => p.id === selectedProductId) ?? null
    : null;

  return (
    <AnimatePresence mode="wait">
      {/* ── Offer Configurator view ─────────────────────────────────────────── */}
      {activeView === 'offer' ? (
        <OfferPage key="offer" />
      ) : (
        /* ── Catalog view ───────────────────────────────────────────────────── */
        <motion.div
          key="catalog"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="min-h-screen flex flex-col"
        >
          <TopNav />

          <main className="flex-1 overflow-hidden">
            <AnimatePresence mode="wait">
              {!activeCategory ? (
                <motion.div
                  key="categories"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.28 }}
                >
                  <CategoryGrid />
                </motion.div>
              ) : activeCategory.code === 'PHN' ? (
                <motion.div
                  key="carousel"
                  {...pageVariants}
                  transition={{ duration: 0.3 }}
                >
                  <ProductCarousel products={products} />
                </motion.div>
              ) : (
                <motion.div
                  key={`grid-${activeCategory.code}`}
                  {...pageVariants}
                  transition={{ duration: 0.3 }}
                >
                  <ProductGrid products={products} newProductIds={newProductIds} />
                </motion.div>
              )}
            </AnimatePresence>
          </main>

          <LiveStatusBar
            isLive={isLive}
            isFetching={isFetching}
            lastUpdatedAt={lastUpdatedAt}
          />

          <AnimatePresence>
            {selectedProduct && (
              <ProductDetailDrawer
                key="detail"
                product={selectedProduct}
                onClose={() => setSelectedProduct(null)}
              />
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
