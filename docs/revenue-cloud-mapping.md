# Revenue Cloud: what a configuration actually needs

Research notes on which Salesforce records a rep's request turns into. Sources
are the Salesforce Revenue Cloud documentation (loaded into Context Builder);
links are at the end. This covers Revenue Cloud Advanced / Revenue Lifecycle
Management, not legacy Salesforce CPQ.

The goal: know what to ask the sales rep, and what is a default or a one-off
org setting.

---

## Summary

- The rep only needs to provide: **product name, price, discount threshold and
  size, bundle contents** (if there is a bundle).
- Contract v1 does not carry: **selling model**, **which product a discount
  applies to**, **upper bound of a tier**, **bundle composition**, **bundle
  discount**. Contract v2 (section 6) adds them.
- **B2B/B2C has no dedicated field in Revenue Cloud.**
- Biggest demo risk: **decision tables must be refreshed after data changes**,
  otherwise the configurator shows the price without the discount.

---

## 1. Minimum record chain for one priced product

| # | Object | Required | Notes |
|---|---|---|---|
| 1 | **ProductSellingModel** (PSM) | type: One Time / Term-Defined / Evergreen; for Term and Evergreen `PricingTerm` and `PricingTermUnit`; Status = Active | Shared across products, i.e. an org setting. Cannot go back to Draft once active [A][B] |
| 2 | **Product2** | `Name`, `ProductCode`, `IsActive = true` | Product Type "None" = simple, "Bundle" = bundle [D][I] |
| 3 | **ProductSellingModelOption** | `Product2Id`, `ProductSellingModelId`; prorate policy for Term/Evergreen | One product can have several selling models [A][B] |
| 4 | **Pricebook2** | Standard Price Book or a custom one | All products in a bundle must be in the same price book [C] |
| 5 | **PricebookEntry** | `Pricebook2Id`, `Product2Id`, `ProductSellingModelId`, `UnitPrice`, `IsActive = true` | The selling model cannot be changed after the entry is created [B][C] |
| 6 | **Catalog → Category → product assignment** | catalog with a code and type Sales | Not documented as required for selling, but it is how the configurator finds products. Worth doing [E] |

## 2. Volume discounts (tiers)

- **PriceAdjustmentSchedule**: a ready-made "Standard Price Adjustment Tier"
  exists. Use it rather than creating a new one [F][G].
  - `AdjustmentMethod`:
    - **Range**: one discount for the whole quantity within a band,
    - **Slab**: a different discount for each successive "slice" of quantity.
  - Default is Range.
- **PriceAdjustmentTier**: one record per band [G].
  - **Fields:**
    - product and its selling model (a tier belongs to the product, not the
      price book),
    - schedule,
    - type: Percentage / Amount / Override,
    - value,
    - `LowerBound` and `UpperBound` (both inclusive; upper may be empty),
    - effective dates.
  - **Bands must not overlap or leave gaps.**
  - The schedule must be deactivated before adding tiers, then reactivated.
  - After changes, **refresh the "Volume Discount Entries" decision table** [H].
- **Example:** "10% above 500" becomes a 0–499 band at 0% and a 500+ band at
  10%. Strictly, "more than 500" means a lower bound of **501**.

## 3. Bundles

- **A bundle is its own Product2** with type Bundle. It needs its own selling
  model and price book entry. Its components must be in the same price book
  [C][I][L].
- **Static or configurable?** Static ("Configure During Sale: Not Allowed") is
  much simpler and is enough for "A + B together" [I][J][K].
  - Components are added on the Structure tab (needs the ARC Access permission).
  - Relationship: "Bundle to Bundle Component Relationship".
- **Component settings:**
  - optionally "Price includes component", i.e. the component price is
    included in the bundle price,
  - "Include by default": on,
  - "Allow quantity changes": off.
- **A bundle discount** is a `BundleBasedAdjustment` on the ready-made
  "Standard Bundle Based Adjustment" schedule. Type: percentage, amount or
  override [L].
- **A volume discount on a bundle** is an ordinary tier on the bundle product.
  This is an inference, not confirmed in the documentation.

## 4. One-off org setup (not per request)

**Pricing** [M][N]:
- Salesforce Pricing enabled,
- Context Service with a context definition (SalesTransactionContext),
- decision tables: Price Book Entries, Volume Discount Entries, Bundle Based
  Adjustment Entries, active and **refreshed after data changes**,
- a **pricing procedure** with Pricing Setting, List Price and Volume Discount
  elements. **The discount schedule ID is hard-coded in it**, so every
  configuration should use one shared, ready-made schedule.

**Catalog and products:**
- a catalog with categories,
- selling models (PSM) and a prorate policy,
- a price book.

**Permissions:** Manage Product Catalog, ARC Access, Salesforce Pricing (Design
Time and Run Time).

## 5. Who provides what

| Information | Source | Default / notes |
|---|---|---|
| Product name | **rep** | |
| Product code (SKU) | default | generated from the name |
| Unit price | **rep** | |
| Currency | default | org currency |
| Selling model | default | one-time; only asked when the rep says "subscription / monthly / yearly", then the term too |
| Prorate policy | org | one shared policy |
| Price book | default | Standard or one demo price book |
| Catalog / category | org | one demo category |
| Discount threshold and size | **rep** | type: percentage |
| Which product the discount applies to | default | all products, or the bundle |
| Range or Slab | default | Range |
| Bundle contents | **rep** | component quantity: 1 |
| Bundle price | default | sum of components, or a separate price (then we ask) |
| Static / configurable bundle | default | static |
| Bundle discount | rep | optional |
| Effective dates | default | from today, open-ended |
| B2B / B2C | **?** | no field in Revenue Cloud |

## 6. Gaps in contract v1 and the v2 proposal

Gaps in v1:

1. no selling model (or term for subscriptions),
2. no indication of which product a discount belongs to (`pricing` is global),
3. tiers only have `from`; `to` and type (percentage / amount) are missing,
4. no bundle structure or bundle price,
5. no bundle discount,
6. `availability` has no Revenue Cloud equivalent.

Minimal extension (v2, a superset of v1):

```json
"extracted": {
  "products": [{
    "name": "Product A", "basePrice": 10, "currency": "USD",
    "sellingModel": "one-time | term | evergreen",
    "term": { "length": 12, "unit": "month" }
  }],
  "pricing": {
    "type": "volume-tier",
    "appliesTo": "Product A",
    "tiers": [{ "from": 500, "to": null, "discountPct": 10 }]
  },
  "bundle": {
    "name": "A + B Bundle",
    "components": [{ "product": "Product A", "qty": 1 }],
    "discountPct": null
  },
  "availability": "B2B"
}
```

`term` only for `term` / `evergreen`. `bundle` is `null` when there is no bundle.

## 7. Not yet verified (check on the sandbox with `describe`)

- exact field names, and which are required, on ProductRelatedComponent,
  ProductComponentGroup, PriceAdjustmentTier, PriceAdjustmentSchedule and
  BundleBasedAdjustment (the object reference returned 403; the description
  above comes from the UI guides),
- whether a Standard Price Book entry must exist before a custom one,
- whether a product must be in a catalog category for the configurator to see it,
- exact Range behaviour for "above N",
- how to model B2B / B2C.

---

## Sources

- [A] Manage Product Selling Model: https://help.salesforce.com/s/articleView?id=ind.product_catalog_product_selling_model.htm&language=en_US&type=5
- [B] Products and Price Book Entries (Migration): https://help.salesforce.com/s/articleView?id=ind.rev_asset_migration_pricebookentries_and_products.htm&language=en_US&type=5
- [C] Define Prices in Price Books: https://help.salesforce.com/s/articleView?id=ind.pricing_define_prices_in_price_books.htm&language=en_US&type=5
- [D] Create Simple Products: https://help.salesforce.com/s/articleView?id=ind.product_catalog_create_simple_products.htm&language=en_US&type=5
- [E] Assign Products to Catalog Categories: https://help.salesforce.com/s/articleView?id=ind.product_catalog_assign_products_to_catalog_cat_and_subcategories.htm&language=en_US&type=5
- [F] Create and Manage Price Adjustment Schedules: https://help.salesforce.com/s/articleView?id=ind.pricing_create_price_adjustment_schedules.htm&language=en_US&type=5
- [G] Create Price Adjustment Tiers for Volume Discounts: https://help.salesforce.com/s/articleView?id=ind.pricing_create_price_adjustment_tiers_volume_discounts.htm&language=en_US&type=5
- [H] Calculate Volume or Tiered Discounts with Cumulative Pricing: https://help.salesforce.com/s/articleView?id=ind.pricing_calculate_volume_or_tiered_discounts_with_cumulative_pricing.htm&language=en_US&type=5
- [I] Create Bundled Products: https://help.salesforce.com/s/articleView?id=ind.product_catalog_create_bundled_products.htm&language=en_US&type=5
- [J] Add Components to a Static Product Bundle: https://help.salesforce.com/s/articleView?id=ind.product_catalog_add_components_to_a_static_product_bundle.htm&language=en_US&type=5
- [K] Product Relationship Management: https://help.salesforce.com/s/articleView?id=ind.product_catalog_product_relationships.htm&language=en_US&type=5
- [L] Create Bundle Based Adjustments: https://help.salesforce.com/s/articleView?id=ind.pricing_create_bundle_based_adjustments.htm&language=en_US&type=5
- [M] Prerequisites to Build Pricing Procedures: https://help.salesforce.com/s/articleView?id=ind.pricing_get_ready_to_build_pricing_procedures.htm&language=en_US&type=5
- [N] Simple Pricing Procedure Example: https://help.salesforce.com/s/articleView?id=ind.pricing_simple_pricing_procedure_example.htm&language=en_US&type=5
