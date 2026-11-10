@IsTest
public class SalesCopilotTestDataFactory {

    public static final String CLOUD_ANALYTICS = 'Cloud Analytics licence';
    public static final String ACCESS_PERMISSION_SET = 'SalesCopilotAccess';

    // ─── Running user ────────────────────────────────────────────────────────
    // The running user gets the permission set in its own runAs block to avoid mixed DML;
    // runAs again in the test so USER_MODE queries see the new field permissions.
    // allOrNone=false: the user may already hold the permission set in the org.

    public static User buildUser() {
        return new User(Id = UserInfo.getUserId());
    }

    public static void grantBuildAccess() {
        System.runAs(buildUser()) {
            Database.insert(
                new PermissionSetAssignment(
                    AssigneeId = UserInfo.getUserId(),
                    PermissionSetId = SalesCopilotSelector.getPermissionSetByName(ACCESS_PERMISSION_SET).Id
                ),
                false
            );
        }
    }

    // ─── One-time org setup ──────────────────────────────────────────────────

    public static void createOrgSetup() {
        final Id pricebookId = Test.getStandardPricebookId();
        update new Pricebook2(Id = pricebookId, IsActive = true);

        insert new ProductSellingModel(
            Name = SalesCopilotConstants.SELLING_MODEL_NAME_BY_KEY.get(SalesCopilotConstants.DEFAULT_SELLING_MODEL),
            SellingModelType = 'OneTime',
            Status = 'Active'
        );
        insert new PriceAdjustmentSchedule(
            Name = SalesCopilotConstants.VOLUME_SCHEDULE_NAME,
            ScheduleType = 'Volume',
            AdjustmentMethod = 'Range',
            Pricebook2Id = pricebookId,
            EffectiveFrom = Datetime.now().addDays(-1),
            IsActive = false
        );

        final ProductCatalog catalog = new ProductCatalog(Name = 'Sales Copilot Demo', CatalogType = 'Sales');
        insert catalog;
        insert new ProductCategory(
            Name = 'Sales Copilot Offers',
            CatalogId = catalog.Id,
            Code = SalesCopilotConstants.CATEGORY_CODE
        );
    }

    public static void ensureBundleRelationshipType() {
        if (SalesCopilotSelector.getBundleRelationshipType() == null) {
            insert new ProductRelationshipType(
                Name = 'Bundle to Bundle Component',
                MainProductRoleCat = 'Bundle',
                AssociatedProductRoleCat = 'BundleComponent'
            );
        }
    }

    /** A product already sold from the catalog: one-time model, price in the standard price book. */
    public static Id createCatalogProduct(String name, Decimal unitPrice) {
        final Product2 product = new Product2(Name = name, ProductCode = 'CAT-' + name.deleteWhitespace(), IsActive = true);
        insert product;
        final Id sellingModelId = SalesCopilotSelector.getSellingModelsByName(
                new Set<String>{ SalesCopilotConstants.SELLING_MODEL_NAME_BY_KEY.get(SalesCopilotConstants.DEFAULT_SELLING_MODEL) }
            )
            .values()[0]
            .Id;
        insert new ProductSellingModelOption(Product2Id = product.Id, ProductSellingModelId = sellingModelId, IsDefault = true);
        insert new PricebookEntry(
            Pricebook2Id = Test.getStandardPricebookId(),
            Product2Id = product.Id,
            ProductSellingModelId = sellingModelId,
            UnitPrice = unitPrice,
            IsActive = true
        );
        return product.Id;
    }

    // ─── Request presets (TS-01, TS-02, TS-03, TS-05) ─────────────────────────

    public static String volumeTierRequest(String requestId) {
        return volumeTierRequest(requestId, CLOUD_ANALYTICS);
    }

    public static String volumeTierRequest(String requestId, String productName) {
        return JSON.serialize(
            request(
                requestId,
                new List<Object>{ product(productName, 40, UserInfo.getDefaultCurrency()) },
                SalesCopilotConstants.PRICING_VOLUME_TIER,
                new List<Object>{ tier(500, 15), tier(100, 10) },
                'B2B'
            )
        );
    }

    public static String bundleRequest(String requestId, List<Object> products, List<Object> components) {
        final Map<String, Object> body = request(requestId, products, SalesCopilotConstants.PRICING_BUNDLE, new List<Object>(), 'both');
        ((Map<String, Object>) body.get('extracted')).put(
            'bundle',
            new Map<String, Object>{ 'name' => 'Test Bundle ' + requestId, 'components' => components }
        );
        return JSON.serialize(body);
    }

    public static Map<String, Object> catalogProduct(Id productId) {
        return new Map<String, Object>{ 'productId' => productId };
    }

    public static Map<String, Object> component(String productName, Boolean isOptional) {
        return new Map<String, Object>{ 'product' => productName, 'qty' => 1, 'optional' => isOptional };
    }

    public static String flatRequest(String requestId, String currencyCode) {
        return JSON.serialize(
            request(
                requestId,
                new List<Object>{ product('Onboarding Service', 500, currencyCode) },
                SalesCopilotConstants.PRICING_FLAT,
                new List<Object>(),
                'both'
            )
        );
    }

    public static String bundleRequest(String requestId) {
        return JSON.serialize(
            request(
                requestId,
                new List<Object>{
                    product('Starter Hardware Kit', 200, UserInfo.getDefaultCurrency()),
                    product('Onboarding Service', 500, UserInfo.getDefaultCurrency())
                },
                SalesCopilotConstants.PRICING_BUNDLE,
                new List<Object>{ tier(1, 5) },
                'B2B'
            )
        );
    }

    public static String volumeTierRequestWithTiers(String requestId, List<Object> tiers) {
        return JSON.serialize(
            request(
                requestId,
                new List<Object>{ product(CLOUD_ANALYTICS, 40, UserInfo.getDefaultCurrency()) },
                SalesCopilotConstants.PRICING_VOLUME_TIER,
                tiers,
                'B2B'
            )
        );
    }

    public static Map<String, Object> tier(Integer fromQuantity, Decimal discountPct) {
        return new Map<String, Object>{ 'from' => fromQuantity, 'discountPct' => discountPct };
    }

    public static Map<String, Object> product(String name, Decimal basePrice, String currencyCode) {
        return new Map<String, Object>{ 'name' => name, 'basePrice' => basePrice, 'currency' => currencyCode };
    }

    private static Map<String, Object> request(
        String requestId,
        List<Object> products,
        String pricingType,
        List<Object> tiers,
        String availability
    ) {
        return new Map<String, Object>{
            'requestId' => requestId,
            'rawRequest' => 'Test request ' + requestId,
            'source' => new Map<String, Object>{ 'channel' => 'cursor' },
            'extracted' => new Map<String, Object>{
                'products' => products,
                'pricing' => new Map<String, Object>{ 'type' => pricingType, 'tiers' => tiers },
                'availability' => availability
            },
            'summary' => 'Summary of ' + requestId,
            'assumptions' => new List<Object>{ 'Price is per user per month' },
            'target' => 'revenue-cloud'
        };
    }
}
