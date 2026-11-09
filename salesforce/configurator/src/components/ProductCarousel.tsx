import { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight, Lock, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Product } from '../types';
import { useStore } from '../store';
import { useProducts, useLivePrice, computeDefaultAttributes, useCartRules } from '../hooks/useProducts';

interface Props {
  products: Product[];
}

interface ItemProps {
  product: Product;
  isActive: boolean;
  isBlocked?: boolean;
  blockedReason?: string;
}

function CarouselItem({ product, isActive, isBlocked, blockedReason }: ItemProps) {
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

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex-none w-72 md:w-80 lg:w-96"
    >
      <button
        onClick={isBlocked ? undefined : () => setSelectedProduct(product, liveDefaults)}
        className={`w-full text-left rounded-2xl overflow-hidden group transition-all duration-300 ${
          isBlocked
            ? 'bg-syn-card/50 border border-syn-border/40 cursor-not-allowed opacity-50'
            : isActive
            ? 'bg-syn-card border-syn-border-bright shadow-xl shadow-black/30 scale-[1.01]'
            : 'bg-syn-card border-syn-border opacity-80 hover:opacity-100 hover:border-syn-border-bright'
        } border`}
      >
        {/* Image */}
        <div className="relative aspect-square overflow-hidden bg-syn-surface">
          <img
            src={product.imageUrl}
            alt={product.name}
            className={`w-full h-full object-cover transition-transform duration-700 ${isBlocked ? 'grayscale' : 'group-hover:scale-105'}`}
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=600&q=80&auto=format&fit=crop';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-syn-card/90 via-transparent to-transparent" />

          {isBlocked && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40 backdrop-blur-[1px]">
              <div className="w-10 h-10 rounded-full bg-black/60 border border-white/10 flex items-center justify-center">
                <Lock size={18} className="text-white/70" />
              </div>
              {blockedReason && (
                <span className="text-[11px] text-white/60 text-center px-4 leading-tight max-w-[160px]">
                  {blockedReason}
                </span>
              )}
            </div>
          )}

          {!isBlocked && product.brand && (
            <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1 rounded-lg">
              {product.brand}
            </div>
          )}

          {!isBlocked && product.featured && (
            <div className="absolute top-3 right-3 flex items-center gap-1 bg-syn-orange text-white text-[10px] font-bold px-2 py-1 rounded-lg shadow-lg shadow-syn-orange/40">
              <Zap size={9} />
              Popular
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-5">
          <div className="text-syn-muted text-[10px] font-mono mb-1">{product.code}</div>
          <h3 className={`font-bold text-xl mb-2 leading-tight ${isBlocked ? 'text-syn-muted' : 'text-syn-text'}`}>
            {product.name}
          </h3>
          <p className="text-syn-secondary text-sm line-clamp-2 mb-4 leading-relaxed">
            {product.description}
          </p>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-bold ${isBlocked ? 'text-syn-muted' : 'text-syn-text'}`}>
              ${price.toLocaleString()}
            </span>
            <span className="text-sm text-purple-400">one-time</span>
          </div>
        </div>
      </button>
    </motion.div>
  );
}

export default function ProductCarousel({ products }: Props) {
  const { cart } = useStore();
  const { products: allProducts } = useProducts();
  const { blockedProductIds, blockedReasons } = useCartRules(cart, allProducts);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    align: 'center',
    containScroll: 'trimSnaps',
  });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(true);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on('select', onSelect);
    onSelect();
  }, [emblaApi, onSelect]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-6">
      {/* Heading */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-xl font-bold text-syn-text mb-0.5">Smartphones</h2>
        <p className="text-syn-secondary text-sm">
          Samsung Galaxy &amp; Apple iPhone — swipe to explore, click to configure
        </p>
      </motion.div>

      {/* Carousel */}
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-4 touch-pan-y select-none">
          {products.map((product, index) => (
            <CarouselItem
              key={product.code}
              product={product}
              isActive={index === selectedIndex}
              isBlocked={blockedProductIds.has(product.id)}
              blockedReason={blockedReasons.get(product.id)}
            />
          ))}
        </div>
      </div>

      {/* Dots + arrows */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={scrollPrev}
          disabled={!canScrollPrev}
          className="w-9 h-9 rounded-full bg-syn-card border border-syn-border hover:border-syn-border-bright text-syn-secondary hover:text-syn-text flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={16} />
        </button>

        <div className="flex items-center gap-1.5">
          {products.map((_, i) => (
            <button
              key={i}
              onClick={() => emblaApi?.scrollTo(i)}
              className={`rounded-full transition-all duration-300 ${
                i === selectedIndex
                  ? 'w-6 h-2 bg-syn-orange'
                  : 'w-2 h-2 bg-syn-border hover:bg-syn-border-bright'
              }`}
            />
          ))}
        </div>

        <button
          onClick={scrollNext}
          disabled={!canScrollNext}
          className="w-9 h-9 rounded-full bg-syn-card border border-syn-border hover:border-syn-border-bright text-syn-secondary hover:text-syn-text flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
