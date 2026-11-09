public with sharing class SalesCopilotCatalogService {

    private static final String BILLING_ONE_TIME = 'one-time';
    private static final String SELLING_MODEL_TYPE_ONE_TIME = 'OneTime';
    private static final Map<String, String> BILLING_BY_TERM_UNIT = new Map<String, String>{
        'Months' => 'monthly',
        'Annual' => 'yearly'
    };
    private static final Map<String, String> ADJUSTMENT_BY_TIER_TYPE = new Map<String, String>{
        SalesCopilotConstants.TIER_TYPE_PERCENTAGE => 'percent',
        'AdjustmentAmount' => 'amount',
        'Override' => 'override'
    };

    public class CatalogResponse {
        public String status;
        public String error;
        public String audience;
        public Decimal maxDiscountWithoutApprovalPct = SalesCopilotConstants.MAX_DISCOUNT_WITHOUT_APPROVAL;
        public List<CatalogProduct> products = new List<CatalogProduct>();
        public transient Integer statusCode;
    }

    public class CatalogProduct {
        public String productId;
        public String name;
        public String productCode;
        public String type;
        public String audience;
        public String description;
        public String sellingModel;
        public String billing;
        public Decimal listPrice;
        public List<VolumeTier> volumeTiers = new List<VolumeTier>();
        public List<Component> components = new List<Component>();
        public List<String> includedIn = new List<String>();
    }

    public class VolumeTier {
        public Decimal fromQuantity;
        public Decimal toQuantity;
        public String adjustment;
        public Decimal value;
    }

    public class Component {
        public String productId;
        public String name;
        public Decimal quantity;
        public Boolean required;
        public String billing;
        public Decimal listPrice;
    }

    public static CatalogResponse getCatalog(String audienceParam) {
        final CatalogResponse response = new CatalogResponse();
        final String audience = toAudience(audienceParam);
        if (String.isNotBlank(audienceParam) && audience == null) {
            response.status = SalesCopilotConstants.STATUS_FAILED;
            response.error = 'audience must be Business or Consumer (b2b / b2c also accepted)';
            response.statusCode = SalesCopilotConstants.HTTP_BAD_REQUEST;
            return response;
        }
        response.audience = audience;

        final Map<Id, CatalogProduct> productsById = new Map<Id, CatalogProduct>();
        final Set<String> seenNames = new Set<String>();
        for (PricebookEntry entry : SalesCopilotSelector.getSellableEntries(SalesCopilotSelector.getStandardPricebookId())) {
            if (seenNames.add(entry.Product2.Name.toLowerCase())) {
                productsById.put(entry.Product2Id, toProduct(entry));
            }
        }

        for (PriceAdjustmentTier tier : SalesCopilotSelector.getTiersByProductIds(productsById.keySet())) {
            final VolumeTier volumeTier = new VolumeTier();
            volumeTier.fromQuantity = tier.LowerBound;
            volumeTier.toQuantity = tier.UpperBound;
            volumeTier.adjustment = ADJUSTMENT_BY_TIER_TYPE.get(tier.TierType) ?? tier.TierType;
            volumeTier.value = tier.TierValue;
            productsById.get(tier.Product2Id).volumeTiers.add(volumeTier);
        }

        for (ProductRelatedComponent link : SalesCopilotSelector.getComponentsByParentIds(productsById.keySet())) {
            final CatalogProduct bundle = productsById.get(link.ParentProductId);
            final CatalogProduct child = productsById.get(link.ChildProductId);
            final Component component = new Component();
            component.productId = link.ChildProductId;
            component.name = link.ChildProduct?.Name;
            component.quantity = link.Quantity;
            component.required = link.IsComponentRequired;
            component.billing = child?.billing;
            component.listPrice = child?.listPrice;
            bundle.components.add(component);
            child?.includedIn.add(bundle.name);
        }

        for (CatalogProduct product : productsById.values()) {
            if (isSoldTo(product.audience, audience)) {
                response.products.add(product);
            }
        }
        response.status = SalesCopilotConstants.STATUS_FOUND;
        response.statusCode = SalesCopilotConstants.HTTP_OK;
        return response;
    }

    private static CatalogProduct toProduct(PricebookEntry entry) {
        final CatalogProduct product = new CatalogProduct();
        product.productId = entry.Product2Id;
        product.name = entry.Product2.Name;
        product.productCode = entry.Product2.ProductCode;
        product.type = entry.Product2.Type ?? 'Simple';
        product.audience = entry.Product2.Audience__c ?? SalesCopilotConstants.AUDIENCE_BOTH;
        product.description = entry.Product2.Description;
        product.sellingModel = entry.ProductSellingModel?.Name;
        product.billing = toBilling(entry.ProductSellingModel);
        product.listPrice = entry.UnitPrice;
        return product;
    }

    private static String toBilling(ProductSellingModel model) {
        if (model == null || model.SellingModelType == SELLING_MODEL_TYPE_ONE_TIME) {
            return BILLING_ONE_TIME;
        }
        return BILLING_BY_TERM_UNIT.get(model.PricingTermUnit) ?? model.PricingTermUnit;
    }

    // Same rule as the quote segment check: Both and unset products are sold to everyone.
    private static Boolean isSoldTo(String productAudience, String customerAudience) {
        return customerAudience == null
            || productAudience == SalesCopilotConstants.AUDIENCE_BOTH
            || productAudience == customerAudience;
    }

    private static String toAudience(String value) {
        if (String.isBlank(value)) {
            return null;
        }
        final String key = value.trim().toLowerCase();
        for (String audience : new List<String>{ SalesCopilotConstants.AUDIENCE_BUSINESS, SalesCopilotConstants.AUDIENCE_CONSUMER }) {
            if (audience.toLowerCase() == key) {
                return audience;
            }
        }
        final String mapped = SalesCopilotConstants.AUDIENCE_BY_AVAILABILITY.get(key);
        return mapped == SalesCopilotConstants.AUDIENCE_BOTH ? null : mapped;
    }
}
