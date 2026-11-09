export interface AttributeValue {
  value: string;
  label: string;
}

export interface Attribute {
  code: string;
  label: string;
  isPriceImpacting: boolean;
  values: AttributeValue[];
}

export interface AttributePriceOverride {
  productCode: string;
  attributeCode: string;
  attributeValue: string;
  overridePrice: number;
}

export type PricingType = 'monthly' | 'onetime' | 'yearly';

export interface Product {
  id: string;
  code: string;
  name: string;
  description: string;
  categoryCode: string;
  basePrice: number;
  pricingType: PricingType;
  attributeCodes: string[];
  imageUrl: string;
  brand?: 'Samsung' | 'Apple';
  isBundle: boolean;
  bundleComponentCodes?: string[];
  /** Subset of bundleComponentCodes that live in optional groups (MinBundleComponents = 0) */
  bundleOptionalComponentCodes?: string[];
  /** Max number of optional components the user may select for this bundle (from MaxBundleComponents). */
  bundleMaxOptionalComponents?: number;
  featured?: boolean;
}

export interface Category {
  id?: string;
  code: string;
  name: string;
  icon: string;
  description: string;
  gradient: string;
  accentColor: string;
}

export interface Catalog {
  id: string;
  name: string;
  description: string;
}

export interface SelectedOptional {
  productId: string;
  product: Product;
  /** Attribute values configured for this optional component. */
  selectedAttributes: Record<string, string>;
}

export type Audience = 'Business' | 'Consumer' | 'Both';

export type RequestPricingType = 'flat' | 'volume-tier' | 'bundle';

export interface VolumeTier {
  fromQuantity: number;
  /** Inclusive upper bound; null for the last, open-ended tier. */
  toQuantity: number | null;
  discountPct: number;
}

export interface RequestProduct {
  id: string;
  code: string;
  name: string;
  description: string;
  audience: Audience;
  unitPrice: number | null;
  tiers: VolumeTier[];
  billing: Billing;
}

export type Billing = 'monthly' | 'one-time';

export interface RequestBundleComponent {
  product: RequestProduct;
  quantity: number;
  isOptional: boolean;
}

export interface RequestBundle {
  product: RequestProduct;
  components: RequestBundleComponent[];
}

export interface ConfigurationRequest {
  id: string;
  requestId: string;
  channel: string;
  pricingType: RequestPricingType;
  audience: Audience;
  summary: string;
  rawRequest: string;
  assumptions: string[];
  createdDate: string;
}

export interface RequestOffer {
  request: ConfigurationRequest;
  /** Stand-alone products; bundle components live under `bundle`. */
  products: RequestProduct[];
  bundle: RequestBundle | null;
}

export interface CartItem {
  /** Unique key within the cart — productId (one item per product for now) */
  productId: string;
  product: Product;
  selectedAttributes: Record<string, string>;
  /** How many units of this product. Default 1. */
  quantity: number;
  /** Optional bundle components the user picked to include in this bundle item. */
  selectedOptionals?: SelectedOptional[];
}
