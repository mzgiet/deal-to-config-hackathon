/**
 * Salesforce LDS GraphQL + SOQL REST client.
 *
 * Auth strategy:
 *   Uses @salesforce/sdk-data's createDataSDK() which automatically handles
 *   Salesforce authentication for all launch contexts — App Launcher, direct URL,
 *   embedded, etc. No manual token injection needed.
 *
 *   Falls back to direct fetch (no auth) for local `npm run dev`.
 */

import { createDataSDK } from '@salesforce/sdk-data';
import type { Attribute } from '../types';
import type { Category } from '../types';
import type { Catalog } from '../types';
import type {
  Audience,
  Billing,
  ConfigurationRequest,
  RequestBundle,
  RequestOffer,
  RequestPricingType,
  RequestProduct,
  VolumeTier,
} from '../types';

// UIBundle apps are served from the App domain (*.my.salesforce.app), which
// matches neither force.com nor salesforce.com — missing it here silently drops
// the app into the unauthenticated dev fallback and every query returns nothing.
const SF_HOST_SUFFIXES = ['.force.com', '.salesforce.com', '.salesforce.app'];

export const IS_SF =
  typeof window !== 'undefined' &&
  SF_HOST_SUFFIXES.some((suffix) => window.location.hostname.endsWith(suffix));

const GRAPHQL_ENDPOINT = '/services/data/v66.0/graphql';
// Cache the SDK promise — "each call creates a new instance"
let _sdkPromise: ReturnType<typeof createDataSDK> | null = null;
function getSDK() {
  if (!_sdkPromise) _sdkPromise = createDataSDK();
  return _sdkPromise;
}

async function gql<T>(query: string): Promise<T> {
  if (IS_SF) {
    const sdk = await getSDK();
    if (!sdk.graphql) throw new Error('GraphQL not available in DataSDK for this surface.');
    const response = await sdk.graphql<T>({ query });
    if (response.errors?.length) throw new Error(response.errors[0].message);
    return response.data;
  }

  // Local dev fallback
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`SF GraphQL ${res.status}: ${res.statusText}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data;
}

// ── Products ────────────────────────────────────────────────────────────────

export interface SFProduct {
  Id: string;
  Name: { value: string };
  ProductCode: { value: string };
  Description: { value: string | null };
  Type: { value: string | null };
  HeroImageUrl__c: { value: string | null } | null;
  Brand__c: { value: string | null } | null;
}

export interface SFPricebookEntry {
  Id: string;
  UnitPrice: { value: number };
  IsActive: { value: boolean };
  Product2Id: { value: string };
  ProductSellingModel: { SellingModelType: { value: string } } | null;
}

const PRODUCTS_QUERY = `{
  uiapi { query {
    Product2(
      where: { IsActive: { eq: true } }
      first: 200
      orderBy: { ProductCode: { order: ASC } }
    ) {
      edges { node {
        Id
        Name { value }
        ProductCode { value }
        Description { value }
        Type { value }
        HeroImageUrl__c { value }
        Brand__c { value }
      }}
    }
  }}
}`;

interface ProductsData {
  uiapi: { query: { Product2: { edges: { node: SFProduct }[] } } };
}

export async function fetchSFProducts(): Promise<SFProduct[]> {
  const data = await gql<ProductsData>(PRODUCTS_QUERY);
  return data.uiapi.query.Product2.edges.map((e) => e.node);
}

// ── Attribute Price Overrides ────────────────────────────────────────────────

const ADJUSTMENTS_QUERY = `{
  uiapi { query {
    AttributeBasedAdjustment(
      where: { AdjustmentType: { eq: "Override" } }
      first: 200
    ) {
      edges { node {
        Id
        AdjustmentValue { value }
        AttributeBasedAdjRuleId { value }
        Product { ProductCode { value } }
      }}
    }
  }}
}`;

const CONDITIONS_QUERY = `{
  uiapi { query {
    AttributeAdjustmentCondition(first: 200) {
      edges { node {
        AttributeBasedAdjRuleId { value }
        StringValue { value }
        AttributeDefinition { DeveloperName { value } }
      }}
    }
  }}
}`;

interface AdjustmentsData {
  uiapi: { query: { AttributeBasedAdjustment: { edges: { node: {
    Id: string;
    AdjustmentValue: { value: number };
    AttributeBasedAdjRuleId: { value: string };
    Product: { ProductCode: { value: string } };
  }}[] } } };
}

interface ConditionsData {
  uiapi: { query: { AttributeAdjustmentCondition: { edges: { node: {
    AttributeBasedAdjRuleId: { value: string };
    StringValue: { value: string };
    AttributeDefinition: { DeveloperName: { value: string } };
  }}[] } } };
}

export interface SFAttributeOverride {
  productCode: string;
  attributeCode: string;
  attributeValue: string;
  overridePrice: number;
}

export async function fetchSFAttributeOverrides(): Promise<SFAttributeOverride[]> {
  const [adjData, condData] = await Promise.all([
    gql<AdjustmentsData>(ADJUSTMENTS_QUERY),
    gql<ConditionsData>(CONDITIONS_QUERY),
  ]);

  const adjustments = adjData.uiapi.query.AttributeBasedAdjustment.edges.map((e) => e.node);
  const conditions = condData.uiapi.query.AttributeAdjustmentCondition.edges.map((e) => e.node);

  const condByRuleId = new Map(
    conditions.map((c) => [c.AttributeBasedAdjRuleId.value, c]),
  );

  const overrides: SFAttributeOverride[] = [];
  for (const adj of adjustments) {
    const cond = condByRuleId.get(adj.AttributeBasedAdjRuleId.value);
    if (!cond || !cond.StringValue.value) continue;
    overrides.push({
      productCode: adj.Product.ProductCode.value,
      attributeCode: cond.AttributeDefinition.DeveloperName.value,
      attributeValue: cond.StringValue.value,
      overridePrice: adj.AdjustmentValue.value,
    });
  }
  return overrides;
}

// ── PricebookEntries ─────────────────────────────────────────────────────────

const PRICES_QUERY = `{
  uiapi { query {
    PricebookEntry(
      where: { IsActive: { eq: true } }
      first: 300
      orderBy: { Product2: { ProductCode: { order: ASC } } }
    ) {
      edges { node {
        Id
        UnitPrice { value }
        IsActive { value }
        Product2Id { value }
        ProductSellingModel { SellingModelType { value } }
      }}
    }
  }}
}`;

interface PricesData {
  uiapi: { query: { PricebookEntry: { edges: { node: SFPricebookEntry }[] } } };
}

export async function fetchSFPrices(): Promise<SFPricebookEntry[]> {
  const data = await gql<PricesData>(PRICES_QUERY);
  return data.uiapi.query.PricebookEntry.edges.map((e) => e.node);
}

// ── Attribute Definitions + Picklist Values ──────────────────────────────────

const ATTR_DEFS_QUERY = `{
  uiapi { query {
    AttributeDefinition(
      where: { IsActive: { eq: true } }
      first: 50
    ) {
      edges { node {
        Id
        DeveloperName { value }
        Label { value }
        DataType { value }
        PicklistId { value }
      }}
    }
  }}
}`;

const ATTR_PICKLISTS_QUERY = `{
  uiapi { query {
    AttributePicklist(first: 50) {
      edges { node {
        Id
        AttributePicklistValues(
          orderBy: { Sequence: { order: ASC } }
          first: 50
        ) {
          edges { node {
            Value { value }
            IsDefault { value }
          }}
        }
      }}
    }
  }}
}`;

interface AttrDefsData {
  uiapi: { query: { AttributeDefinition: { edges: { node: {
    Id: string;
    DeveloperName: { value: string };
    Label: { value: string };
    DataType: { value: string };
    PicklistId: { value: string | null };
  }}[] } } };
}

interface AttrPicklistsData {
  uiapi: { query: { AttributePicklist: { edges: { node: {
    Id: string;
    AttributePicklistValues: { edges: { node: {
      Value: { value: string };
      IsDefault: { value: boolean };
    }}[] };
  }}[] } } };
}

export async function fetchSFAttributes(): Promise<Record<string, Attribute>> {
  const [defsData, picklistsData] = await Promise.all([
    gql<AttrDefsData>(ATTR_DEFS_QUERY),
    gql<AttrPicklistsData>(ATTR_PICKLISTS_QUERY),
  ]);

  const picklistById = new Map(
    picklistsData.uiapi.query.AttributePicklist.edges.map((e) => [
      e.node.Id,
      e.node.AttributePicklistValues.edges.map((v) => ({
        value: v.node.Value.value,
        label: v.node.Value.value,
      })),
    ]),
  );

  const result: Record<string, Attribute> = {};
  for (const edge of defsData.uiapi.query.AttributeDefinition.edges) {
    const node = edge.node;
    const code = node.DeveloperName.value;
    const values = node.PicklistId.value
      ? (picklistById.get(node.PicklistId.value) ?? [])
      : [];
    result[code] = {
      code,
      label: node.Label.value,
      isPriceImpacting: false,
      values,
    };
  }
  return result;
}

// ── Product → Attribute codes (GraphQL) ─────────────────────────────────────

const PRODUCT_ATTR_DEFS_QUERY = `{
  uiapi { query {
    ProductAttributeDefinition(
      where: { Status: { eq: "Active" } }
      first: 200
    ) {
      edges { node {
        Product2 { ProductCode { value } }
        AttributeDefinition { DeveloperName { value } }
        IsPriceImpacting { value }
        Sequence { value }
      }}
    }
  }}
}`;

interface ProductAttrDefsData {
  uiapi: { query: { ProductAttributeDefinition: { edges: { node: {
    Product2: { ProductCode: { value: string } };
    AttributeDefinition: { DeveloperName: { value: string } };
    IsPriceImpacting: { value: boolean };
    Sequence: { value: number };
  }}[] } } };
}

export async function fetchSFProductAttributeCodes(): Promise<
  Record<string, { code: string; isPriceImpacting: boolean }[]>
> {
  const data = await gql<ProductAttrDefsData>(PRODUCT_ATTR_DEFS_QUERY);
  const result: Record<string, { code: string; isPriceImpacting: boolean }[]> = {};
  for (const edge of data.uiapi.query.ProductAttributeDefinition.edges) {
    const node = edge.node;
    const productCode = node.Product2?.ProductCode?.value;
    const attrCode = node.AttributeDefinition?.DeveloperName?.value;
    if (!productCode || !attrCode) continue;
    if (!result[productCode]) result[productCode] = [];
    result[productCode].push({
      code: attrCode,
      isPriceImpacting: node.IsPriceImpacting?.value ?? false,
    });
  }
  return result;
}

// ── Bundle Components (ProductRelatedComponent via GraphQL) ──────────────────

const BUNDLE_COMPONENTS_QUERY = `{
  uiapi { query {
    ProductRelatedComponent(first: 200) {
      edges { node {
        ParentProduct { ProductCode { value } }
        ChildProduct { ProductCode { value } }
        ProductComponentGroupId { value }
      }}
    }
  }}
}`;

const COMPONENT_GROUPS_QUERY = `{
  uiapi { query {
    ProductComponentGroup(first: 100) {
      edges { node {
        Id
        ParentProductId { value }
        MinBundleComponents { value }
        MaxBundleComponents { value }
      }}
    }
  }}
}`;

interface BundleComponentsData {
  uiapi: { query: { ProductRelatedComponent: { edges: { node: {
    ParentProduct: { ProductCode: { value: string } };
    ChildProduct: { ProductCode: { value: string } };
    ProductComponentGroupId: { value: string | null } | null;
  }}[] } } };
}

interface ComponentGroupsData {
  uiapi: { query: { ProductComponentGroup: { edges: { node: {
    Id: string;
    ParentProductId: { value: string };
    MinBundleComponents: { value: number };
    MaxBundleComponents: { value: number };
  }}[] } } };
}

export interface SFBundleComponents {
  /** parentProductCode → all childProductCodes[] */
  bundleComponents: Record<string, string[]>;
  /** parentProductCode → childProductCodes[] that are in optional groups (Min=0) */
  optionalComponentCodes: Record<string, string[]>;
  /**
   * parentProductCode → max total optional components allowed (sum of MaxBundleComponents
   * across all optional groups for that parent).
   * Example: BUN-004 has one optional group with Max=1 → maxOptionalByBundle['BUN-004'] = 1
   */
  maxOptionalByBundle: Record<string, number>;
}

/**
 * Returns bundle component maps including which codes are optional (Min=0 group)
 * and the max selectable count per bundle.
 */
export async function fetchSFBundleComponents(): Promise<SFBundleComponents> {
  const [prcData, groupData] = await Promise.all([
    gql<BundleComponentsData>(BUNDLE_COMPONENTS_QUERY),
    gql<ComponentGroupsData>(COMPONENT_GROUPS_QUERY),
  ]);

  // Build a map of groupId → { isOptional, max, parentId }
  const groupInfo = new Map(
    groupData.uiapi.query.ProductComponentGroup.edges.map((e) => [
      e.node.Id,
      {
        isOptional: e.node.MinBundleComponents.value === 0,
        max: e.node.MaxBundleComponents.value,
        parentProductId: e.node.ParentProductId.value,
      },
    ]),
  );

  const optionalGroupIds = new Set(
    [...groupInfo.entries()].filter(([, v]) => v.isOptional).map(([id]) => id),
  );

  const bundleComponents: Record<string, string[]> = {};
  const optionalComponentCodes: Record<string, string[]> = {};

  for (const edge of prcData.uiapi.query.ProductRelatedComponent.edges) {
    const parentCode = edge.node.ParentProduct?.ProductCode?.value;
    const childCode = edge.node.ChildProduct?.ProductCode?.value;
    const groupId = edge.node.ProductComponentGroupId?.value;
    if (!parentCode || !childCode) continue;

    if (!bundleComponents[parentCode]) bundleComponents[parentCode] = [];
    bundleComponents[parentCode].push(childCode);

    if (groupId && optionalGroupIds.has(groupId)) {
      if (!optionalComponentCodes[parentCode]) optionalComponentCodes[parentCode] = [];
      optionalComponentCodes[parentCode].push(childCode);
    }
  }

  // Sum MaxBundleComponents across all optional groups per parent product ID
  // We need to map parentProductId → parentProductCode for the result key
  // Build a reverse map: parentProductCode via PRC data
  const parentIdToCode: Record<string, string> = {};
  for (const edge of prcData.uiapi.query.ProductRelatedComponent.edges) {
    const parentCode = edge.node.ParentProduct?.ProductCode?.value;
    const groupId = edge.node.ProductComponentGroupId?.value;
    if (parentCode && groupId) {
      const info = groupInfo.get(groupId);
      if (info) parentIdToCode[info.parentProductId] = parentCode;
    }
  }

  const maxOptionalByBundle: Record<string, number> = {};
  for (const [, info] of groupInfo) {
    if (!info.isOptional) continue;
    const parentCode = parentIdToCode[info.parentProductId];
    if (!parentCode) continue;
    maxOptionalByBundle[parentCode] = (maxOptionalByBundle[parentCode] ?? 0) + info.max;
  }

  return { bundleComponents, optionalComponentCodes, maxOptionalByBundle };
}

// ── Product Disqualification rules ───────────────────────────────────────────

const DISQUALIFICATIONS_QUERY = `{
  uiapi { query {
    ProductDisqualification(first: 200) {
      edges { node {
        ParentProductId { value }
        ProductId { value }
        Reason { value }
      }}
    }
  }}
}`;

interface DisqualificationsData {
  uiapi: { query: { ProductDisqualification: { edges: { node: {
    ParentProductId: { value: string };
    ProductId: { value: string };
    Reason: { value: string };
  }}[] } } };
}

export interface SFDisqualification {
  parentProductId: string;
  productId: string;
  reason: string;
}

export async function fetchSFDisqualifications(): Promise<SFDisqualification[]> {
  const data = await gql<DisqualificationsData>(DISQUALIFICATIONS_QUERY);
  return data.uiapi.query.ProductDisqualification.edges.map((e) => ({
    parentProductId: e.node.ParentProductId.value,
    productId: e.node.ProductId.value,
    reason: e.node.Reason.value,
  }));
}

// ── Category Disqualification rules ─────────────────────────────────────────

const CATEGORY_DISQUAL_QUERY = `{
  uiapi { query {
    ProductCategoryDisqual(first: 50) {
      edges { node {
        CategoryId { value }
        Reason { value }
      }}
    }
  }}
}`;

interface CategoryDisqualData {
  uiapi: { query: { ProductCategoryDisqual: { edges: { node: {
    CategoryId: { value: string };
    Reason: { value: string };
  }}[] } } };
}

export interface SFCategoryDisqual {
  categoryId: string;
  reason: string;
}

export async function fetchSFCategoryDisqual(): Promise<SFCategoryDisqual[]> {
  const data = await gql<CategoryDisqualData>(CATEGORY_DISQUAL_QUERY);
  return data.uiapi.query.ProductCategoryDisqual.edges.map((e) => ({
    categoryId: e.node.CategoryId.value,
    reason: e.node.Reason.value,
  }));
}

// ── Categories ───────────────────────────────────────────────────────────────

const CATEGORIES_QUERY = `{
  uiapi { query {
    ProductCategory(
      orderBy: { SortOrder: { order: ASC } }
      first: 50
    ) {
      edges { node {
        Id
        Name { value }
        Description { value }
        SortOrder { value }
      }}
    }
  }}
}`;

interface CategoriesData {
  uiapi: { query: { ProductCategory: { edges: { node: {
    Id: string;
    Name: { value: string };
    Description: { value: string | null };
    SortOrder: { value: number | null };
  }}[] } } };
}

const CATEGORY_UI: Record<string, { code: string; icon: string; gradient: string; accentColor: string }> = {
  'Mobile Services': { code: 'MOB', icon: '📱', gradient: 'from-blue-900 to-blue-700', accentColor: '#3b82f6' },
  'Internet':        { code: 'INT', icon: '🌐', gradient: 'from-cyan-900 to-cyan-700', accentColor: '#06b6d4' },
  'Television':      { code: 'TV',  icon: '📺', gradient: 'from-purple-900 to-purple-700', accentColor: '#a855f7' },
  'Smartphones':     { code: 'PHN', icon: '📲', gradient: 'from-slate-900 to-slate-700', accentColor: '#64748b' },
  'Additional Services': { code: 'ADD', icon: '⚡', gradient: 'from-amber-900 to-amber-700', accentColor: '#f59e0b' },
  'Bundles':         { code: 'BUN', icon: '🎁', gradient: 'from-orange-900 to-orange-700', accentColor: '#f97316' },
};

export async function fetchSFCategories(): Promise<Category[]> {
  const data = await gql<CategoriesData>(CATEGORIES_QUERY);
  const seen = new Set<string>();
  return data.uiapi.query.ProductCategory.edges
    .map((e) => e.node)
    .filter((node) => {
      const ui = CATEGORY_UI[node.Name.value];
      if (!ui || seen.has(ui.code)) return false;
      seen.add(ui.code);
      return true;
    })
    .map((node) => {
      const ui = CATEGORY_UI[node.Name.value]!;
      return {
        id: node.Id,
        code: ui.code,
        name: node.Name.value,
        icon: ui.icon,
        description: node.Description.value ?? '',
        gradient: ui.gradient,
        accentColor: ui.accentColor,
      };
    });
}

// ── Catalogs ─────────────────────────────────────────────────────────────────

const CATALOGS_QUERY = `{
  uiapi { query {
    ProductCatalog(first: 10) {
      edges { node {
        Id
        Name { value }
        Description { value }
      }}
    }
  }}
}`;

interface CatalogsData {
  uiapi: { query: { ProductCatalog: { edges: { node: {
    Id: string;
    Name: { value: string };
    Description: { value: string | null };
  }}[] } } };
}

export async function fetchSFCatalogs(): Promise<Catalog[]> {
  const data = await gql<CatalogsData>(CATALOGS_QUERY);
  return data.uiapi.query.ProductCatalog.edges.map((e) => ({
    id: e.node.Id,
    name: e.node.Name.value,
    description: e.node.Description.value ?? '',
  }));
}

// ── Sales Copilot request (?requestId=) ──────────────────────────────────────

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;

/** Variables come back empty on the UIBundle surface, so the id is inlined after this check. */
export function isValidRequestId(requestId: string): boolean {
  return REQUEST_ID_PATTERN.test(requestId);
}

const requestOfferQuery = (requestId: string) => `{
  uiapi { query {
    SalesCopilot_Request__c(where: { Request_Id__c: { eq: "${requestId}" } }, first: 1) {
      edges { node {
        Id
        Request_Id__c { value }
        Channel__c { value }
        Pricing_Type__c { value }
        Audience__c { value }
        Summary__c { value }
        Raw_Request__c { value }
        Assumptions__c { value }
        CreatedDate { value }
      }}
    }
    Product2(
      where: { SalesCopilot_Request__r: { Request_Id__c: { eq: "${requestId}" } } }
      first: 50
      orderBy: { ProductCode: { order: ASC } }
    ) {
      edges { node {
        Id
        Name { value }
        ProductCode { value }
        Description { value }
        Audience__c { value }
        Type { value }
      }}
    }
    PricebookEntry(
      where: { and: [
        { IsActive: { eq: true } }
        { Product2: { SalesCopilot_Request__r: { Request_Id__c: { eq: "${requestId}" } } } }
      ] }
      first: 50
    ) {
      edges { node {
        Product2Id { value }
        UnitPrice { value }
        ProductSellingModel { SellingModelType { value } }
      }}
    }
    ProductRelatedComponent(
      where: { ParentProduct: { SalesCopilot_Request__r: { Request_Id__c: { eq: "${requestId}" } } } }
      first: 50
      orderBy: { Sequence: { order: ASC } }
    ) {
      edges { node {
        ParentProductId { value }
        ChildProductId { value }
        Quantity { value }
        IsComponentRequired { value }
      }}
    }
    PriceAdjustmentTier(
      where: { Product2: { SalesCopilot_Request__r: { Request_Id__c: { eq: "${requestId}" } } } }
      first: 200
      orderBy: { LowerBound: { order: ASC } }
    ) {
      edges { node {
        Product2Id { value }
        TierValue { value }
        LowerBound { value }
        UpperBound { value }
      }}
    }
  }}
}`;

interface RequestOfferData {
  uiapi: { query: {
    SalesCopilot_Request__c: { edges: { node: {
      Id: string;
      Request_Id__c: { value: string };
      Channel__c: { value: string | null };
      Pricing_Type__c: { value: string | null };
      Audience__c: { value: string | null };
      Summary__c: { value: string | null };
      Raw_Request__c: { value: string | null };
      Assumptions__c: { value: string | null };
      CreatedDate: { value: string };
    }}[] };
    Product2: { edges: { node: {
      Id: string;
      Name: { value: string };
      ProductCode: { value: string };
      Description: { value: string | null };
      Audience__c: { value: string | null };
      Type: { value: string | null };
    }}[] };
    PricebookEntry: { edges: { node: {
      Product2Id: { value: string };
      UnitPrice: { value: number };
      ProductSellingModel: { SellingModelType: { value: string } } | null;
    }}[] };
    ProductRelatedComponent: { edges: { node: {
      ParentProductId: { value: string };
      ChildProductId: { value: string };
      Quantity: { value: number | null };
      IsComponentRequired: { value: boolean };
    }}[] };
    PriceAdjustmentTier: { edges: { node: {
      Product2Id: { value: string };
      TierValue: { value: number };
      LowerBound: { value: number };
      UpperBound: { value: number | null };
    }}[] };
  }};
}

const SF_ID_PATTERN = /^[A-Za-z0-9]{15,18}$/;

/** Bundle components reused from the catalog belong to an earlier request, so they are read by id. */
const catalogProductsQuery = (productIds: string[]) => {
  const ids = productIds.map((id) => `"${id}"`).join(', ');
  return `{
  uiapi { query {
    Product2(where: { Id: { in: [${ids}] } }, first: 50) {
      edges { node {
        Id
        Name { value }
        ProductCode { value }
        Description { value }
        Audience__c { value }
        Type { value }
      }}
    }
    PricebookEntry(
      where: { and: [{ IsActive: { eq: true } } { Product2Id: { in: [${ids}] } }] }
      first: 50
    ) {
      edges { node {
        Product2Id { value }
        UnitPrice { value }
        ProductSellingModel { SellingModelType { value } }
      }}
    }
  }}
}`;
};

type CatalogProductsData = {
  uiapi: { query: Pick<RequestOfferData['uiapi']['query'], 'Product2' | 'PricebookEntry'> };
};

const AUDIENCES: Audience[] = ['Business', 'Consumer', 'Both'];
const REQUEST_PRICING_TYPES: RequestPricingType[] = ['flat', 'volume-tier', 'bundle'];

function toAudience(value: string | null): Audience {
  return AUDIENCES.find((a) => a === value) ?? 'Both';
}

export interface CreatedQuote {
  quoteId: string;
  quoteUrl: string;
  grandTotal: number | null;
}

/** Places a priced Quote through the Sales Copilot endpoint; required bundle components are added server-side. */
export async function createSFQuote(requestId: string, addOns: string[]): Promise<CreatedQuote> {
  const sdk = IS_SF ? await getSDK() : null;
  if (IS_SF && !sdk?.fetch) throw new Error('REST calls are not available in DataSDK for this surface.');
  const doFetch: typeof fetch = sdk?.fetch ? (input, init) => sdk.fetch!(input, init) : fetch;
  const res = await doFetch('/services/apexrest/salescopilot/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId, addOns }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.status !== 'created') {
    throw new Error(json?.error ?? `Quote request failed (${res.status})`);
  }
  return { quoteId: json.quoteId, quoteUrl: json.quoteUrl, grandTotal: json.grandTotal ?? null };
}

/** Returns null when no request with that id exists. */
export async function fetchSFRequestOffer(requestId: string): Promise<RequestOffer | null> {
  if (!isValidRequestId(requestId)) {
    throw new Error(`"${requestId}" is not a valid request id.`);
  }
  const data = await gql<RequestOfferData>(requestOfferQuery(requestId));
  const q = data.uiapi.query;
  const node = q.SalesCopilot_Request__c.edges[0]?.node;
  if (!node) return null;

  const request: ConfigurationRequest = {
    id: node.Id,
    requestId: node.Request_Id__c.value,
    channel: node.Channel__c.value ?? 'api',
    pricingType:
      REQUEST_PRICING_TYPES.find((t) => t === node.Pricing_Type__c.value) ?? 'flat',
    audience: toAudience(node.Audience__c.value),
    summary: node.Summary__c.value ?? '',
    rawRequest: node.Raw_Request__c.value ?? '',
    assumptions: (node.Assumptions__c.value ?? '')
      .split('\n')
      .map((a) => a.trim())
      .filter(Boolean),
    createdDate: node.CreatedDate.value,
  };

  const requestProductIds = new Set(q.Product2.edges.map(({ node }) => node.Id));
  const catalogIds = [
    ...new Set(
      q.ProductRelatedComponent.edges
        .map(({ node }) => node.ChildProductId.value)
        .filter((id) => !requestProductIds.has(id) && SF_ID_PATTERN.test(id)),
    ),
  ];
  const catalog = catalogIds.length
    ? (await gql<CatalogProductsData>(catalogProductsQuery(catalogIds))).uiapi.query
    : { Product2: { edges: [] }, PricebookEntry: { edges: [] } };
  const productNodes = [...q.Product2.edges, ...catalog.Product2.edges];
  const entryNodes = [...q.PricebookEntry.edges, ...catalog.PricebookEntry.edges];

  const priceByProductId = new Map(
    entryNodes.map((e) => [e.node.Product2Id.value, e.node.UnitPrice.value]),
  );
  const billingByProductId = new Map<string, Billing>(
    entryNodes.map((e) => [
      e.node.Product2Id.value,
      e.node.ProductSellingModel?.SellingModelType.value === 'OneTime' ? 'one-time' : 'monthly',
    ]),
  );

  const tiersByProductId = new Map<string, VolumeTier[]>();
  for (const { node: tier } of q.PriceAdjustmentTier.edges) {
    const productId = tier.Product2Id.value;
    const tiers = tiersByProductId.get(productId) ?? [];
    tiers.push({
      fromQuantity: tier.LowerBound.value,
      toQuantity: tier.UpperBound.value,
      discountPct: tier.TierValue.value,
    });
    tiersByProductId.set(productId, tiers);
  }

  const allProducts = productNodes.map(({ node: p }) => ({
    isBundle: p.Type.value === 'Bundle',
    product: {
      id: p.Id,
      code: p.ProductCode.value,
      name: p.Name.value,
      description: p.Description.value ?? '',
      audience: toAudience(p.Audience__c.value),
      unitPrice: priceByProductId.get(p.Id) ?? null,
      tiers: tiersByProductId.get(p.Id) ?? [],
      billing: billingByProductId.get(p.Id) ?? 'one-time',
      fromCatalog: !requestProductIds.has(p.Id),
    } satisfies RequestProduct,
  }));
  const productById = new Map(allProducts.map(({ product }) => [product.id, product]));

  const bundleProduct = allProducts.find((p) => p.isBundle)?.product ?? null;
  const bundle: RequestBundle | null = bundleProduct && {
    product: bundleProduct,
    components: q.ProductRelatedComponent.edges
      .filter(({ node: c }) => c.ParentProductId.value === bundleProduct.id)
      .flatMap(({ node: c }) => {
        const product = productById.get(c.ChildProductId.value);
        return product
          ? [{ product, quantity: c.Quantity.value ?? 1, isOptional: !c.IsComponentRequired.value }]
          : [];
      }),
  };
  const componentIds = new Set(bundle?.components.map((c) => c.product.id));
  const products = allProducts
    .filter(({ isBundle, product }) => !isBundle && !componentIds.has(product.id))
    .map(({ product }) => product);

  return { request, products, bundle };
}
