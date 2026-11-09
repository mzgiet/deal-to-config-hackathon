public with sharing class SalesCopilotRequestWrapper {

    public String requestId;
    public String rawRequest;
    public String summary;
    public String channel;
    public String availability;
    public String pricingType;
    public String appliesTo;
    public List<String> assumptions = new List<String>();
    public List<ProductLine> products = new List<ProductLine>();
    public List<Tier> tiers = new List<Tier>();
    public String bundleName;
    public Decimal bundleDiscountPct;
    public List<BundleComponent> bundleComponents = new List<BundleComponent>();

    public class ProductLine {
        public String name;
        public Decimal basePrice;
        public String currencyCode;
        public String sellingModel;

        public String getSellingModelKey() {
            return String.isBlank(sellingModel) ? SalesCopilotConstants.DEFAULT_SELLING_MODEL : sellingModel.toLowerCase();
        }
    }

    public class BundleComponent {
        public String productName;
        public Decimal quantity;
        public Boolean isOptional;
    }

    public class Tier {
        public Integer fromQuantity;
        public Decimal discountPct;
    }

    public class InvalidRequestException extends Exception {
    }

    // ─── Parsing ─────────────────────────────────────────────────────────────
    // `from` is reserved in Apex, so the contract is read untyped instead of JSON.deserialize.

    public static SalesCopilotRequestWrapper parse(String body) {
        if (String.isBlank(body)) {
            throw new InvalidRequestException('The request body is empty');
        }
        final Map<String, Object> root = toMap(deserialize(body), 'The request');
        final Map<String, Object> extracted = childMap(root, 'extracted');
        final Map<String, Object> pricing = childMap(extracted, 'pricing');
        final Map<String, Object> bundle = childMap(extracted, 'bundle');

        final SalesCopilotRequestWrapper wrapper = new SalesCopilotRequestWrapper();
        wrapper.requestId = text(root, 'requestId');
        wrapper.rawRequest = text(root, 'rawRequest');
        wrapper.summary = text(root, 'summary');
        wrapper.channel = text(childMap(root, 'source'), 'channel');
        wrapper.availability = text(extracted, 'availability');
        wrapper.pricingType = text(pricing, 'type');
        wrapper.appliesTo = text(pricing, 'appliesTo');

        for (Object item : childList(root, 'assumptions')) {
            wrapper.assumptions.add(String.valueOf(item));
        }
        for (Object item : childList(extracted, 'products')) {
            wrapper.products.add(toProductLine(toMap(item, 'Each product')));
        }
        for (Object item : childList(pricing, 'tiers')) {
            wrapper.tiers.add(toTier(toMap(item, 'Each discount tier')));
        }
        wrapper.tiers.sort(new TierComparator());

        wrapper.bundleName = text(bundle, 'name');
        wrapper.bundleDiscountPct = toDecimal(bundle.get('discountPct'), 'bundle.discountPct');
        for (Object item : childList(bundle, 'components')) {
            wrapper.bundleComponents.add(toBundleComponent(toMap(item, 'Each bundle component')));
        }

        if (String.isBlank(wrapper.requestId)) {
            throw new InvalidRequestException('requestId is missing');
        }
        return wrapper;
    }

    private static Object deserialize(String body) {
        try {
            return JSON.deserializeUntyped(body);
        } catch (JSONException e) {
            throw new InvalidRequestException('The request is not valid JSON');
        }
    }

    private static ProductLine toProductLine(Map<String, Object> source) {
        final ProductLine line = new ProductLine();
        line.name = text(source, 'name');
        line.basePrice = toDecimal(source.get('basePrice'), 'basePrice');
        line.currencyCode = text(source, 'currency');
        line.sellingModel = text(source, 'sellingModel');
        return line;
    }

    private static BundleComponent toBundleComponent(Map<String, Object> source) {
        final BundleComponent component = new BundleComponent();
        component.productName = text(source, 'product');
        component.quantity = toDecimal(source.get('qty'), 'Bundle component qty');
        component.isOptional = source.get('optional') == true;
        return component;
    }

    private static Tier toTier(Map<String, Object> source) {
        final Decimal fromQuantity = toDecimal(source.get('from'), 'Tier "from"');
        if (fromQuantity != null && fromQuantity != fromQuantity.round(System.RoundingMode.DOWN)) {
            throw new InvalidRequestException('Tier "from" must be a whole quantity, got ' + fromQuantity);
        }
        final Tier tier = new Tier();
        tier.fromQuantity = fromQuantity?.intValue();
        tier.discountPct = toDecimal(source.get('discountPct'), 'discountPct');
        return tier;
    }

    private static Map<String, Object> toMap(Object value, String label) {
        if (!(value instanceof Map<String, Object>)) {
            throw new InvalidRequestException(label + ' must be a JSON object');
        }
        return (Map<String, Object>) value;
    }

    private static Map<String, Object> childMap(Map<String, Object> source, String key) {
        final Object value = source.get(key);
        return value == null ? new Map<String, Object>() : toMap(value, key);
    }

    private static List<Object> childList(Map<String, Object> source, String key) {
        final Object value = source.get(key);
        if (value == null) {
            return new List<Object>();
        }
        if (!(value instanceof List<Object>)) {
            throw new InvalidRequestException(key + ' must be a list');
        }
        return (List<Object>) value;
    }

    private static String text(Map<String, Object> source, String key) {
        final Object value = source.get(key);
        return value == null ? null : String.valueOf(value).trim();
    }

    private static Decimal toDecimal(Object value, String label) {
        if (value == null) {
            return null;
        }
        try {
            return Decimal.valueOf(String.valueOf(value));
        } catch (TypeException e) {
            throw new InvalidRequestException(label + ' must be a number, got "' + value + '"');
        }
    }

    private class TierComparator implements Comparator<Tier> {
        public Integer compare(Tier left, Tier right) {
            final Integer leftFrom = left.fromQuantity == null ? 0 : left.fromQuantity;
            final Integer rightFrom = right.fromQuantity == null ? 0 : right.fromQuantity;
            return leftFrom - rightFrom;
        }
    }

    // ─── Validation ──────────────────────────────────────────────────────────

    public List<String> validate(String orgCurrency) {
        final List<String> errors = new List<String>();
        validateProducts(orgCurrency, errors);
        validatePricing(errors);
        if (!SalesCopilotConstants.AUDIENCE_BY_AVAILABILITY.containsKey(getAvailabilityKey())) {
            errors.add('availability must be B2B, B2C or both, got "' + availability + '"');
        }
        return errors;
    }

    private void validateProducts(String orgCurrency, List<String> errors) {
        if (products.isEmpty()) {
            errors.add('The request has no products');
        }
        final Set<String> names = new Set<String>();
        for (ProductLine line : products) {
            final String label = String.isBlank(line.name) ? 'A product' : '"' + line.name + '"';
            if (String.isBlank(line.name)) {
                errors.add('A product has no name');
            } else if (!names.add(line.name.toLowerCase())) {
                errors.add(label + ' appears twice');
            }
            if (line.basePrice == null || line.basePrice < 0) {
                errors.add(label + ' needs a unit price of 0 or more');
            }
            if (String.isNotBlank(line.currencyCode) && !line.currencyCode.equalsIgnoreCase(orgCurrency)) {
                errors.add(
                    label + ': currency ' + line.currencyCode + ' is not enabled in Salesforce; use ' + orgCurrency
                );
            }
            if (!SalesCopilotConstants.SELLING_MODEL_NAME_BY_KEY.containsKey(line.getSellingModelKey())) {
                errors.add(
                    label + ': sellingModel must be one of ' + SalesCopilotConstants.SELLING_MODEL_NAME_BY_KEY.keySet() +
                    ', got "' + line.sellingModel + '"'
                );
            }
        }
    }

    private void validateBundle(List<String> errors) {
        if (!tiers.isEmpty() || (bundleDiscountPct != null && bundleDiscountPct != 0)) {
            errors.add('Bundle discounts are not supported yet; remove the tiers and bundle.discountPct');
        }
        final Set<String> productNames = new Set<String>();
        for (ProductLine line : products) {
            if (String.isNotBlank(line.name)) {
                productNames.add(line.name.toLowerCase());
            }
        }
        final Set<String> componentNames = new Set<String>();
        Integer requiredCount = 0;
        for (BundleComponent component : bundleComponents) {
            if (String.isBlank(component.productName) || !productNames.contains(component.productName.toLowerCase())) {
                errors.add('Bundle component "' + component.productName + '" is not one of the products');
            } else if (!componentNames.add(component.productName.toLowerCase())) {
                errors.add('Bundle component "' + component.productName + '" appears twice');
            }
            if (component.quantity != null && component.quantity <= 0) {
                errors.add('Bundle component "' + component.productName + '" needs qty of 1 or more');
            }
            if (!component.isOptional) {
                requiredCount++;
            }
        }
        if (!bundleComponents.isEmpty() && requiredCount == 0) {
            errors.add('A bundle needs at least one required component');
        }
    }

    private void validatePricing(List<String> errors) {
        if (!SalesCopilotConstants.PRICING_TYPES.contains(pricingType)) {
            errors.add('pricing.type must be flat, volume-tier or bundle, got "' + pricingType + '"');
            return;
        }
        if (pricingType == SalesCopilotConstants.PRICING_BUNDLE) {
            validateBundle(errors);
            return;
        }
        if (pricingType == SalesCopilotConstants.PRICING_FLAT && !tiers.isEmpty()) {
            errors.add('Flat pricing has no discounts; use volume-tier or remove the tiers');
        }
        if (pricingType == SalesCopilotConstants.PRICING_VOLUME_TIER) {
            validateTiers(errors);
        }
        if (String.isNotBlank(appliesTo) && getDiscountedProducts().isEmpty()) {
            errors.add('pricing.appliesTo names "' + appliesTo + '", which is not one of the products');
        }
    }

    private void validateTiers(List<String> errors) {
        if (tiers.isEmpty()) {
            errors.add('Volume pricing needs at least one discount tier');
        }
        Integer previousFrom;
        for (Tier tier : tiers) {
            if (tier.fromQuantity == null || tier.fromQuantity < 1) {
                errors.add('Every tier needs "from" of 1 or more');
            } else if (tier.fromQuantity == previousFrom) {
                errors.add('Two tiers start at ' + tier.fromQuantity);
            }
            if (tier.discountPct == null || tier.discountPct <= 0 || tier.discountPct > 100) {
                errors.add('Tier from ' + tier.fromQuantity + ' needs a discount between 0 and 100%');
            }
            previousFrom = tier.fromQuantity;
        }
    }

    // ─── Derived values ──────────────────────────────────────────────────────

    public String getAudience() {
        return SalesCopilotConstants.AUDIENCE_BY_AVAILABILITY.get(getAvailabilityKey());
    }

    public String getChannel() {
        return String.isBlank(channel) ? SalesCopilotConstants.DEFAULT_CHANNEL : channel.toLowerCase();
    }

    public List<ProductLine> getDiscountedProducts() {
        if (String.isBlank(appliesTo)) {
            return products;
        }
        final List<ProductLine> matching = new List<ProductLine>();
        for (ProductLine line : products) {
            if (appliesTo.equalsIgnoreCase(line.name)) {
                matching.add(line);
            }
        }
        return matching;
    }

    public Boolean isBundle() {
        return pricingType == SalesCopilotConstants.PRICING_BUNDLE;
    }

    public String getBundleName() {
        if (String.isNotBlank(bundleName)) {
            return bundleName;
        }
        final List<String> names = new List<String>();
        for (ProductLine line : products) {
            names.add(line.name);
        }
        return String.join(names, ' + ');
    }

    /** Without explicit components every product is a required component with qty 1. */
    public List<BundleComponent> getBundleComponents() {
        if (!bundleComponents.isEmpty()) {
            return bundleComponents;
        }
        final List<BundleComponent> components = new List<BundleComponent>();
        for (ProductLine line : products) {
            final BundleComponent component = new BundleComponent();
            component.productName = line.name;
            component.quantity = 1;
            component.isOptional = false;
            components.add(component);
        }
        return components;
    }

    public Set<String> getSellingModelKeys() {
        final Set<String> keys = new Set<String>();
        for (ProductLine line : products) {
            keys.add(line.getSellingModelKey());
        }
        if (isBundle()) {
            keys.add(getBundleSellingModelKey());
        }
        return keys;
    }

    /** The bundle recurs when any component recurs. */
    public String getBundleSellingModelKey() {
        for (ProductLine line : products) {
            if (line.getSellingModelKey() == SalesCopilotConstants.SELLING_MODEL_EVERGREEN) {
                return SalesCopilotConstants.SELLING_MODEL_EVERGREEN;
            }
        }
        return SalesCopilotConstants.DEFAULT_SELLING_MODEL;
    }

    private String getAvailabilityKey() {
        return String.isBlank(availability) ? SalesCopilotConstants.DEFAULT_AVAILABILITY : availability.toLowerCase();
    }
}
