import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import {
  IS_SF,
  fetchSFProducts,
  fetchSFPrices,
  fetchSFAttributeOverrides,
  fetchSFAttributes,
  fetchSFProductAttributeCodes,
  fetchSFCategories,
  fetchSFCatalogs,
  fetchSFBundleComponents,
  fetchSFDisqualifications,
  fetchSFCategoryDisqual,
} from '../lib/sfGraphQL';
import type { Product, PricingType, AttributePriceOverride, CartItem } from '../types';

const POLL_INTERVAL_MS = 30_000;

// ── Category inference ───────────────────────────────────────────────────────

const CODE_PREFIX_MAP: Record<string, string> = {
  MOB: 'MOB',
  INT: 'INT',
  TV: 'TV',
  PHN: 'PHN',
  ADD: 'ADD',
  BUN: 'BUN',
};

function inferCategoryCode(productCode: string): string {
  const prefix = productCode.split('-')[0]?.toUpperCase() ?? '';
  return CODE_PREFIX_MAP[prefix] ?? 'ADD';
}

function inferPricingType(
  sellingModelType: string | null | undefined,
  fallback: PricingType,
): PricingType {
  if (!sellingModelType) return fallback;
  if (sellingModelType === 'OneTime') return 'onetime';
  if (sellingModelType === 'TermDefined') return 'yearly';
  return 'monthly';
}

const CATEGORY_DEFAULT_IMAGES: Record<string, string> = {
  MOB: 'https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=600&q=80&auto=format&fit=crop',
  INT: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=600&q=80&auto=format&fit=crop',
  TV: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829e1?w=600&q=80&auto=format&fit=crop',
  PHN: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&q=80&auto=format&fit=crop',
  ADD: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&q=80&auto=format&fit=crop',
  BUN: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80&auto=format&fit=crop',
};

// ── Main hook ────────────────────────────────────────────────────────────────

export function useProducts(categoryCode?: string) {
  const prevIdsRef = useRef<Set<string>>(new Set());
  const [newProductIds, setNewProductIds] = useState<Set<string>>(new Set());

  const productsQuery = useQuery({
    queryKey: ['sf-products'],
    queryFn: fetchSFProducts,
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: POLL_INTERVAL_MS * 0.8,
    enabled: IS_SF,
    retry: 2,
  });

  const pricesQuery = useQuery({
    queryKey: ['sf-prices'],
    queryFn: fetchSFPrices,
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: POLL_INTERVAL_MS * 0.8,
    enabled: IS_SF,
    retry: 2,
  });

  const attrOverridesQuery = useQuery({
    queryKey: ['sf-attr-overrides'],
    queryFn: fetchSFAttributeOverrides,
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: POLL_INTERVAL_MS * 0.8,
    enabled: IS_SF,
    retry: 2,
  });

  const attrDefsQuery = useQuery({
    queryKey: ['sf-attr-defs'],
    queryFn: fetchSFAttributes,
    staleTime: 5 * 60_000, // attribute definitions rarely change
    enabled: IS_SF,
    retry: 2,
  });

  const productAttrCodesQuery = useQuery({
    queryKey: ['sf-product-attr-codes'],
    queryFn: fetchSFProductAttributeCodes,
    staleTime: 5 * 60_000,
    enabled: IS_SF,
    retry: 2,
  });

  const bundleComponentsQuery = useQuery({
    queryKey: ['sf-bundle-components'],
    queryFn: fetchSFBundleComponents,
    staleTime: 10 * 60_000,
    enabled: IS_SF,
    retry: 2,
  });

  const disqualificationsQuery = useQuery({
    queryKey: ['sf-disqualifications'],
    queryFn: fetchSFDisqualifications,
    staleTime: 10 * 60_000,
    enabled: IS_SF,
    retry: 2,
  });

  const categoryDisqualQuery = useQuery({
    queryKey: ['sf-category-disqual'],
    queryFn: fetchSFCategoryDisqual,
    staleTime: 10 * 60_000,
    enabled: IS_SF,
    retry: 2,
  });

  const categoriesQuery = useQuery({
    queryKey: ['sf-categories'],
    queryFn: fetchSFCategories,
    staleTime: 10 * 60_000,
    enabled: IS_SF,
    retry: 2,
  });

  const catalogsQuery = useQuery({
    queryKey: ['sf-catalogs'],
    queryFn: fetchSFCatalogs,
    staleTime: 10 * 60_000,
    enabled: IS_SF,
    retry: 2,
  });


  // Detect newly appeared products after a successful refetch
  useEffect(() => {
    if (!productsQuery.data) return;
    const currentIds = new Set(productsQuery.data.map((p) => p.Id));
    const fresh = [...currentIds].filter((id) => !prevIdsRef.current.has(id));

    if (fresh.length > 0) {
      const freshSet = new Set(fresh);
      setNewProductIds(freshSet);
      // Clear "New" badge after 15 seconds
      const t = setTimeout(() => setNewProductIds(new Set()), 15_000);
      prevIdsRef.current = currentIds;
      return () => clearTimeout(t);
    }
    prevIdsRef.current = currentIds;
  }, [productsQuery.data]);

  // Build merged product list from live SF data
  const { products, bundleSuggestionsMap } = (() => {
    if (!productsQuery.data) return { products: [] as Product[], bundleSuggestionsMap: {} as Record<string, Product[]> };

    const sfPrices = pricesQuery.data ?? [];

    const merged = productsQuery.data
      .filter((sfP) => sfP.ProductCode?.value)
      .map((sfP): Product => {
        const code = sfP.ProductCode.value;
        const catCode = inferCategoryCode(code);

        const pbeEntry = sfPrices.find(
          (p) => p.Product2Id.value === sfP.Id && p.IsActive.value,
        );
        const basePrice = pbeEntry?.UnitPrice.value ?? 0;
        const pricingType = inferPricingType(
          pbeEntry?.ProductSellingModel?.SellingModelType?.value,
          'monthly',
        );

        const liveAttrCodes = productAttrCodesQuery.data?.[code];
        const attributeCodes = liveAttrCodes ? liveAttrCodes.map((a) => a.code) : [];

        const isBundle = sfP.Type?.value === 'Bundle';
        const bundleData = bundleComponentsQuery.data;

        return {
          id: sfP.Id,
          code,
          name: sfP.Name.value,
          description: sfP.Description?.value ?? '',
          categoryCode: catCode,
          basePrice,
          pricingType,
          attributeCodes,
          imageUrl: sfP.HeroImageUrl__c?.value ?? CATEGORY_DEFAULT_IMAGES[catCode] ?? '',
          brand: sfP.Brand__c?.value as 'Samsung' | 'Apple' | undefined,
          isBundle,
          bundleComponentCodes: bundleData?.bundleComponents[code],
          bundleOptionalComponentCodes: bundleData?.optionalComponentCodes[code],
          bundleMaxOptionalComponents: bundleData?.maxOptionalByBundle[code],
          featured: undefined,
        };
      });

    // Build reverse map: productCode → bundles that contain it (for suggestion banner)
    const map: Record<string, Product[]> = {};
    for (const p of merged) {
      if (p.isBundle && p.bundleComponentCodes) {
        for (const childCode of p.bundleComponentCodes) {
          if (!map[childCode]) map[childCode] = [];
          map[childCode].push(p);
        }
      }
    }

    return {
      products: categoryCode ? merged.filter((p) => p.categoryCode === categoryCode) : merged,
      bundleSuggestionsMap: map,
    };
  })();

  const liveOverrides: AttributePriceOverride[] = attrOverridesQuery.data ?? [];

  const liveAttributes = attrDefsQuery.data ?? {};

  // Enrich isPriceImpacting from ProductAttributeDefinition data
  if (productAttrCodesQuery.data) {
    for (const attrList of Object.values(productAttrCodesQuery.data)) {
      for (const { code, isPriceImpacting } of attrList) {
        if (isPriceImpacting && liveAttributes[code]) {
          liveAttributes[code] = { ...liveAttributes[code], isPriceImpacting: true };
        }
      }
    }
  }

  const liveCategories = categoriesQuery.data ?? [];

  const liveCatalogs = catalogsQuery.data ?? [];

  return {
    products,
    bundleSuggestionsMap,
    overrides: liveOverrides,
    attributes: liveAttributes,
    categories: liveCategories,
    catalogs: liveCatalogs,
    isLoading: productsQuery.isLoading,
    isFetching: productsQuery.isFetching,
    isError: productsQuery.isError,
    /** True while product disqualification / category disqual rules are still loading */
    isLoadingRules: disqualificationsQuery.isLoading || categoryDisqualQuery.isLoading,
    lastUpdatedAt: productsQuery.dataUpdatedAt,
    newProductIds,
    isLive: IS_SF,
  };
}

// ── Pure helper — compute default attributes from live SF data ────────────────
/**
 * Given a product and live data (attributes + overrides), returns the initial
 * attribute selection: first picklist value that has a price override in SF,
 * or the first picklist value if no overrides are configured.
 * Pure function — no hooks, safe to call anywhere.
 */
import type { Attribute, AttributePriceOverride as APO } from '../types';

export function computeDefaultAttributes(
  productCode: string,
  attributeCodes: string[],
  liveAttributes: Record<string, Attribute>,
  liveOverrides: APO[],
): Record<string, string> {
  const defaults: Record<string, string> = {};
  for (const attrCode of attributeCodes) {
    const attr = liveAttributes[attrCode];
    if (!attr || attr.values.length === 0) continue;

    // Find the first value that has a price override configured in SF
    const configuredValues = liveOverrides
      .filter((o) => o.productCode === productCode && o.attributeCode === attrCode)
      .map((o) => o.attributeValue);

    const firstConfigured = attr.values.find((v) => configuredValues.includes(v.value));
    defaults[attrCode] = firstConfigured?.value ?? attr.values[0].value;
  }
  return defaults;
}

// ── Shared price resolution — single source of truth ──────────────────────────
/**
 * Resolves the effective per-unit price for a product given its selected attributes.
 * Precedence: attribute-based override → live PricebookEntry (in-org only) → fallback.
 *
 * Pure — no hooks — safe to call from inside .reduce()/.map() over an arbitrary-length
 * list. Every price computation in the app (single product, cart line, cart total)
 * MUST go through this function; three near-identical copies of this logic used to
 * drift out of sync with each other, which is how the override-vs-live-price and the
 * cart-subtotal bugs happened.
 */
export function resolveEffectivePrice(
  productCode: string,
  productId: string,
  fallbackPrice: number,
  selectedAttrs: Record<string, string>,
  overrides: AttributePriceOverride[],
  sfPrices: Awaited<ReturnType<typeof fetchSFPrices>> | undefined,
): number {
  for (const [attrCode, attrValue] of Object.entries(selectedAttrs)) {
    const override = overrides.find(
      (o) =>
        o.productCode === productCode &&
        o.attributeCode === attrCode &&
        o.attributeValue === attrValue,
    );
    if (override) return override.overridePrice;
  }

  if (sfPrices && IS_SF) {
    const entry = sfPrices.find(
      (p) => p.Product2Id.value === productId && p.IsActive.value,
    );
    if (entry) return entry.UnitPrice.value;
  }

  return fallbackPrice;
}

// Convenience hook for a single product's live price (uses cached query data)
export function useLivePrice(
  productCode: string,
  productId: string,
  selectedAttrs: Record<string, string>,
  fallbackPrice = 0,
): number {
  const queryClient = useQueryClient();

  const sfPrices = queryClient.getQueryData<
    Awaited<ReturnType<typeof fetchSFPrices>>
  >(['sf-prices']);

  const sfAttrOverrides = queryClient.getQueryData<
    Awaited<ReturnType<typeof fetchSFAttributeOverrides>>
  >(['sf-attr-overrides']);

  return resolveEffectivePrice(
    productCode,
    productId,
    fallbackPrice,
    selectedAttrs,
    sfAttrOverrides ?? [],
    sfPrices,
  );
}

// ── Cart total (sum of live prices for all items) ─────────────────────────────
/**
 * Computes the total price for a list of cart items from the React Query cache.
 * Same resolution logic as useLivePrice, aggregated — no hook-call-in-loop issues.
 *
 * When `pricingType` is provided, only contributions of THAT pricing type are summed —
 * both the item's own price (if `item.product.pricingType` matches) and each optional's
 * price (if `opt.product.pricingType` matches), independently of one another. This is
 * required because a bundle's optional add-on can have a different pricing type than
 * the bundle itself (e.g. a one-time phone attached to a monthly plan) — without this,
 * the one-time cost silently gets summed into the monthly subtotal.
 */
export function useCartTotal(cart: CartItem[], pricingType?: PricingType): number {
  const queryClient = useQueryClient();

  const sfPrices = queryClient.getQueryData<
    Awaited<ReturnType<typeof fetchSFPrices>>
  >(['sf-prices']);

  const sfAttrOverrides = queryClient.getQueryData<
    Awaited<ReturnType<typeof fetchSFAttributeOverrides>>
  >(['sf-attr-overrides']);

  const overrides: AttributePriceOverride[] = sfAttrOverrides ?? [];

  return cart.reduce((total, item) => {
    const qty = item.quantity ?? 1;
    let lineTotal = 0;

    if (pricingType === undefined || item.product.pricingType === pricingType) {
      const itemPrice = resolveEffectivePrice(
        item.product.code,
        item.product.id,
        item.product.basePrice,
        item.selectedAttributes,
        overrides,
        sfPrices,
      );
      lineTotal += itemPrice * qty;
    }

    for (const opt of item.selectedOptionals ?? []) {
      if (pricingType !== undefined && opt.product.pricingType !== pricingType) continue;
      const optPrice = resolveEffectivePrice(
        opt.product.code,
        opt.productId,
        opt.product.basePrice,
        opt.selectedAttributes ?? {},
        overrides,
        sfPrices,
      );
      lineTotal += optPrice * qty;
    }

    return total + lineTotal;
  }, 0);
}

// ── Cart rules — blocked products / categories based on SF rules ─────────────

export interface CartRules {
  /** SF Product2 IDs that are blocked (disqualified) given current cart */
  blockedProductIds: Set<string>;
  /** Product category codes (MOB, TV, …) that are saturated — no more from this category */
  blockedCategoryIds: Set<string>;
  /** Reason text keyed by product id */
  blockedReasons: Map<string, string>;
  /**
   * Max allowed quantity per product id.
   * Products in a ProductCategoryDisqual category are capped at 1.
   * Everything else defaults to 10 (no SF constraint).
   */
  maxQuantityFor: (productId: string) => number;
}

/**
 * Computes which products are blocked for addition given the current cart contents.
 * Reads from React Query cache — no extra network calls; rules are fetched once by
 * the useProducts hook in App.tsx on mount.
 *
 * Rules applied:
 *  1. ProductDisqualification  — if a bundle is in the cart, its disqualified product IDs are blocked.
 *  2. ProductCategoryDisqual   — if any product from a category is in the cart, no more from that category.
 */
export function useCartRules(cart: CartItem[], allProducts: Product[]): CartRules {
  const queryClient = useQueryClient();

  const disqualifications = queryClient.getQueryData<
    Awaited<ReturnType<typeof fetchSFDisqualifications>>
  >(['sf-disqualifications']) ?? [];

  const categoryDisquals = queryClient.getQueryData<
    Awaited<ReturnType<typeof fetchSFCategoryDisqual>>
  >(['sf-category-disqual']) ?? [];

  const categories = queryClient.getQueryData<
    Awaited<ReturnType<typeof fetchSFCategories>>
  >(['sf-categories']) ?? [];

  const cartProductIds = new Set(cart.map((item) => item.product.id));
  const blockedProductIds = new Set<string>();
  const blockedCategoryIds = new Set<string>();
  const blockedReasons = new Map<string, string>();

  // Rule 1 — ProductDisqualification (bundle exclusions)
  for (const disqual of disqualifications) {
    if (cartProductIds.has(disqual.parentProductId)) {
      blockedProductIds.add(disqual.productId);
      if (!blockedReasons.has(disqual.productId)) {
        blockedReasons.set(disqual.productId, disqual.reason || 'Included in bundle already in cart');
      }
    }
  }

  // Rule 2 — ProductCategoryDisqual (one-per-category limits)
  for (const catDisqual of categoryDisquals) {
    // Map SF CategoryId to our category code via fetched categories
    const category = categories.find((c) => c.id === catDisqual.categoryId);
    if (!category) continue;
    const hasInCart = cart.some((item) => item.product.categoryCode === category.code);
    if (hasInCart) {
      blockedCategoryIds.add(category.code);
      // Block every product in that category that is NOT already in the cart
      for (const product of allProducts) {
        if (product.categoryCode === category.code && !cartProductIds.has(product.id)) {
          blockedProductIds.add(product.id);
          if (!blockedReasons.has(product.id)) {
            blockedReasons.set(product.id, catDisqual.reason || `Only one ${category.name} product allowed`);
          }
        }
      }
    }
  }

  // Build max-quantity map: products in a category-disqual'd category → max 1
  const cappedProductIds = new Set<string>();
  for (const catDisqual of categoryDisquals) {
    const category = categories.find((c) => c.id === catDisqual.categoryId);
    if (!category) continue;
    for (const product of allProducts) {
      if (product.categoryCode === category.code) cappedProductIds.add(product.id);
    }
  }

  const maxQuantityFor = (productId: string): number =>
    cappedProductIds.has(productId) ? 1 : 10;

  return { blockedProductIds, blockedCategoryIds, blockedReasons, maxQuantityFor };
}
