import { motion } from 'framer-motion';
import type { Product } from '../types';
import ProductCard from './ProductCard';
import { useStore } from '../store';
import { useProducts, useCartRules } from '../hooks/useProducts';

interface Props {
  products: Product[];
  newProductIds?: Set<string>;
}

export default function ProductGrid({ products, newProductIds }: Props) {
  const { cart } = useStore();
  const { products: allProducts } = useProducts();
  const { blockedProductIds, blockedReasons } = useCartRules(cart, allProducts);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {products.map((product, index) => (
          <motion.div
            key={product.code}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06, duration: 0.3 }}
          >
            <ProductCard
              product={product}
              isNew={newProductIds?.has(product.id)}
              isBlocked={blockedProductIds.has(product.id)}
              blockedReason={blockedReasons.get(product.id)}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
