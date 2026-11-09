import { create } from 'zustand';
import type { Category, Product, CartItem, SelectedOptional } from '../types';

type ActiveView = 'catalog' | 'offer';

interface AppState {
  // ── Catalog navigation ──────────────────────────────────────────────────
  activeCategory: Category | null;
  /** Only the ID is stored — derive the full product from the live products list */
  selectedProductId: string | null;
  selectedAttributes: Record<string, Record<string, string>>;

  setCategory: (category: Category | null) => void;
  setSelectedProduct: (product: Product | null, defaultAttrs?: Record<string, string>) => void;
  setAttributeValue: (productCode: string, attributeCode: string, value: string) => void;

  // ── Offer / Cart ────────────────────────────────────────────────────────
  activeView: ActiveView;
  cart: CartItem[];

  /** Open the offer view, optionally pre-adding a product from the catalog. */
  openOffer: (item?: { product: Product; selectedAttributes: Record<string, string> }) => void;
  closeoffer: () => void;

  addToCart: (product: Product, selectedAttributes: Record<string, string>) => void;
  removeFromCart: (productId: string) => void;
  updateCartItemAttributes: (productId: string, attributeCode: string, value: string) => void;
  setCartItemQuantity: (productId: string, quantity: number) => void;
  /** Add an optional component to a bundle already in the cart. */
  addOptionalToBundle: (bundleProductId: string, optional: Product, selectedAttributes: Record<string, string>) => void;
  /** Remove a previously selected optional component from a bundle. */
  removeOptionalFromBundle: (bundleProductId: string, optionalProductId: string) => void;
  /** Update a single attribute value on an optional bundle component. */
  setOptionalAttributes: (bundleProductId: string, optionalProductId: string, attrCode: string, value: string) => void;
  /**
   * Remove the listed individual products and add a bundle in their place.
   * Used by the BundleSuggestionBanner "Switch to bundle" action.
   */
  swapWithBundle: (removeProductIds: string[], bundleProduct: Product) => void;
  clearCart: () => void;
}

export const useStore = create<AppState>((set) => ({
  // ── Catalog ──────────────────────────────────────────────────────────────
  activeCategory: null,
  selectedProductId: null,
  selectedAttributes: {},

  setCategory: (category) =>
    set({ activeCategory: category, selectedProductId: null }),

  setSelectedProduct: (product, defaultAttrs = {}) =>
    set((state) => {
      if (!product) return { selectedProductId: null };
      const existing = state.selectedAttributes[product.code];
      if (existing) return { selectedProductId: product.id };
      return {
        selectedProductId: product.id,
        selectedAttributes: {
          ...state.selectedAttributes,
          [product.code]: defaultAttrs,
        },
      };
    }),

  setAttributeValue: (productCode, attributeCode, value) =>
    set((state) => ({
      selectedAttributes: {
        ...state.selectedAttributes,
        [productCode]: {
          ...state.selectedAttributes[productCode],
          [attributeCode]: value,
        },
      },
    })),

  // ── Offer / Cart ─────────────────────────────────────────────────────────
  activeView: 'catalog',
  cart: [],

  openOffer: (item) =>
    set((state) => {
      if (!item) return { activeView: 'offer', selectedProductId: null };

      const existing = state.cart.find((c) => c.productId === item.product.id);
      const newCart = existing
        ? state.cart
        : [
            ...state.cart,
            {
              productId: item.product.id,
              product: item.product,
              selectedAttributes: item.selectedAttributes,
              quantity: 1,
            },
          ];

      return {
        activeView: 'offer',
        selectedProductId: null,
        cart: newCart,
      };
    }),

  closeoffer: () => set({ activeView: 'catalog' }),

  addToCart: (product, selectedAttributes) =>
    set((state) => {
      const exists = state.cart.some((c) => c.productId === product.id);
      if (exists) return state;
      return {
        cart: [
          ...state.cart,
          { productId: product.id, product, selectedAttributes, quantity: 1 },
        ],
      };
    }),

  removeFromCart: (productId) =>
    set((state) => ({
      cart: state.cart.filter((c) => c.productId !== productId),
    })),

  updateCartItemAttributes: (productId, attributeCode, value) =>
    set((state) => ({
      cart: state.cart.map((item) =>
        item.productId === productId
          ? {
              ...item,
              selectedAttributes: {
                ...item.selectedAttributes,
                [attributeCode]: value,
              },
            }
          : item,
      ),
    })),

  setCartItemQuantity: (productId, quantity) =>
    set((state) => ({
      cart: state.cart.map((item) =>
        item.productId === productId ? { ...item, quantity: Math.max(1, quantity) } : item,
      ),
    })),

  addOptionalToBundle: (bundleProductId, optional, selectedAttributes) =>
    set((state) => ({
      cart: state.cart.map((item) => {
        if (item.productId !== bundleProductId) return item;
        const existing = item.selectedOptionals ?? [];
        if (existing.some((o) => o.productId === optional.id)) return item;
        const entry: SelectedOptional = { productId: optional.id, product: optional, selectedAttributes };
        return { ...item, selectedOptionals: [...existing, entry] };
      }),
    })),

  removeOptionalFromBundle: (bundleProductId, optionalProductId) =>
    set((state) => ({
      cart: state.cart.map((item) => {
        if (item.productId !== bundleProductId) return item;
        return {
          ...item,
          selectedOptionals: (item.selectedOptionals ?? []).filter(
            (o) => o.productId !== optionalProductId,
          ),
        };
      }),
    })),

  setOptionalAttributes: (bundleProductId, optionalProductId, attrCode, value) =>
    set((state) => ({
      cart: state.cart.map((item) => {
        if (item.productId !== bundleProductId) return item;
        return {
          ...item,
          selectedOptionals: (item.selectedOptionals ?? []).map((o) =>
            o.productId === optionalProductId
              ? { ...o, selectedAttributes: { ...o.selectedAttributes, [attrCode]: value } }
              : o,
          ),
        };
      }),
    })),

  swapWithBundle: (removeProductIds, bundleProduct) =>
    set((state) => {
      const filtered = state.cart.filter((c) => !removeProductIds.includes(c.productId));
      const alreadyInCart = filtered.some((c) => c.productId === bundleProduct.id);
      if (alreadyInCart) return { cart: filtered };
      return {
        cart: [...filtered, { productId: bundleProduct.id, product: bundleProduct, selectedAttributes: {}, quantity: 1 }],
      };
    }),

  clearCart: () => set({ cart: [] }),
}));
