import { motion } from 'framer-motion';
import { useStore } from '../store';
import CategoryCard from './CategoryCard';
import { useProducts } from '../hooks/useProducts';

export default function CategoryGrid() {
  const { setCategory } = useStore();
  const { categories, products } = useProducts();

  const totalProducts = products.length;

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold text-syn-text mb-1.5">
          Product Catalog <span className="gradient-text">2026</span>
        </h1>
        <p className="text-syn-secondary text-sm">
          {totalProducts} products across {categories.length} categories — powered by Salesforce Revenue Cloud
        </p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((category, index) => {
          const count = products.filter((p) => p.categoryCode === category.code).length;
          return (
            <motion.div
              key={category.code}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.07, duration: 0.35 }}
            >
              <CategoryCard
                category={category}
                productCount={count}
                onClick={() => setCategory(category)}
              />
            </motion.div>
          );
        })}
      </div>

      {/* Footer note */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-8 flex items-center gap-2 text-syn-muted text-xs"
      >
        <div className="w-1.5 h-1.5 rounded-full bg-syn-success animate-pulse" />
        Live data from Revenue Cloud
      </motion.div>
    </div>
  );
}
