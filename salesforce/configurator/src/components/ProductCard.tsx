import { motion } from 'framer-motion';
import { Zap, Package, Sparkles, Lock } from 'lucide-react';
import type { Product } from '../types';
import { useStore } from '../store';
import { useProducts, useLivePrice, computeDefaultAttributes } from '../hooks/useProducts';

interface Props {
  product: Product;
  isNew?: boolean;
  isBlocked?: boolean;
  blockedReason?: string;
}

const PRICE_SUFFIX: Record<string, { label: string; className: string }> = {
  monthly: { label: '/mo', className: 'text-blue-400' },
  onetime: { label: 'one-time', className: 'text-purple-400' },
  yearly: { label: '/yr', className: 'text-green-400' },
};

export default function ProductCard({ product, isNew, isBlocked, blockedReason }: Props) {
  const { setSelectedProduct, selectedAttributes } = useStore();
  const { attributes, overrides } = useProducts();
  const liveDefaults = computeDefaultAttributes(
    product.code,
    product.attributeCodes,
    attributes,
    overrides,
  );
  const attrs = selectedAttributes[product.code] ?? liveDefaults;
  const price = useLivePrice(product.code, product.id, attrs, product.basePrice);
  const suffix = PRICE_SUFFIX[product.pricingType];

  return (
    <motion.button
      onClick={isBlocked ? undefined : () => setSelectedProduct(product, liveDefaults)}
      whileHover={isBlocked ? {} : { scale: 1.015, y: -2 }}
      whileTap={isBlocked ? {} : { scale: 0.985 }}
      className={`w-full text-left rounded-2xl overflow-hidden group transition-colors duration-200 ${
        isBlocked
          ? 'bg-syn-card/50 border border-syn-border/40 cursor-not-allowed opacity-50'
          : 'bg-syn-card border border-syn-border hover:border-syn-border-bright card-glow'
      }`}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={product.imageUrl}
          alt={product.name}
          className={`w-full h-full object-cover transition-transform duration-500 ${isBlocked ? 'grayscale' : 'group-hover:scale-105'}`}
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&q=80&auto=format&fit=crop';
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-syn-card via-syn-card/10 to-transparent" />

        {/* Blocked overlay */}
        {isBlocked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40 backdrop-blur-[1px]">
            <div className="w-9 h-9 rounded-full bg-black/60 border border-white/10 flex items-center justify-center">
              <Lock size={16} className="text-white/70" />
            </div>
            {blockedReason && (
              <span className="text-[10px] text-white/60 text-center px-3 leading-tight max-w-[120px]">
                {blockedReason}
              </span>
            )}
          </div>
        )}

        {!isBlocked && isNew && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg shadow-emerald-500/40 z-10"
          >
            <Sparkles size={9} />
            New
          </motion.div>
        )}

        {!isBlocked && !isNew && product.featured && (
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-syn-orange text-white text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-lg shadow-syn-orange/30">
            <Zap size={9} />
            Popular
          </div>
        )}

        {product.isBundle && (
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1 bg-syn-purple text-white text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-lg shadow-syn-purple/30">
            <Package size={9} />
            Bundle
          </div>
        )}

        <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-sm text-syn-muted text-[10px] font-mono px-1.5 py-0.5 rounded">
          {product.code}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className={`font-semibold text-sm leading-snug mb-0.5 truncate transition-colors ${isBlocked ? 'text-syn-muted' : 'text-syn-text group-hover:text-white'}`}>
          {product.name}
        </h3>
        <p className="text-syn-muted text-xs line-clamp-1 mb-3">
          {product.description}
        </p>

        <div className="flex items-baseline gap-1.5">
          <span className={`text-xl font-bold ${isBlocked ? 'text-syn-muted' : 'text-syn-text'}`}>
            ${price.toLocaleString()}
          </span>
          <span className={`text-xs font-medium ${isBlocked ? 'text-syn-muted' : suffix.className}`}>
            {suffix.label}
          </span>
        </div>
      </div>
    </motion.button>
  );
}
