import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Category } from '../types';

interface Props {
  category: Category;
  productCount: number;
  onClick: () => void;
}

export default function CategoryCard({ category, productCount, onClick }: Props) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.015, y: -2 }}
      whileTap={{ scale: 0.985 }}
      className="w-full text-left bg-syn-card border border-syn-border rounded-2xl p-6 transition-colors duration-200 group relative overflow-hidden card-glow"
    >
      {/* Subtle gradient overlay on hover */}
      <div className="absolute inset-0 bg-syn-gradient-card opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl" />

      {/* Top accent line */}
      <div
        className="absolute top-0 left-6 right-6 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `linear-gradient(90deg, transparent, ${category.accentColor}80, transparent)` }}
      />

      <div className="relative z-10">
        {/* Icon container */}
        <div className="w-12 h-12 rounded-xl bg-syn-surface border border-syn-border group-hover:border-syn-border-bright flex items-center justify-center text-2xl mb-5 transition-colors duration-200">
          {category.icon}
        </div>

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-syn-text font-semibold text-base leading-snug mb-1 group-hover:text-white transition-colors">
              {category.name}
            </h3>
            <p className="text-syn-secondary text-sm leading-relaxed line-clamp-2">
              {category.description}
            </p>
          </div>
          <ArrowRight
            size={16}
            className="text-syn-muted group-hover:text-syn-orange shrink-0 mt-0.5 transition-all duration-200 group-hover:translate-x-1"
          />
        </div>

        <div className="mt-5 pt-4 border-t border-syn-border flex items-center justify-between">
          <span className="text-syn-muted text-xs">{productCount} products</span>
          <div className="flex gap-1">
            {[...Array(Math.min(productCount, 6))].map((_, i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full transition-opacity duration-200"
                style={{
                  background: category.accentColor,
                  opacity: 0.3 + (i / Math.min(productCount, 6)) * 0.7,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </motion.button>
  );
}
