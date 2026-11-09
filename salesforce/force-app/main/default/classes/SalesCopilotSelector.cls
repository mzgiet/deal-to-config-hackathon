public with sharing class SalesCopilotSelector {

    public static SalesCopilot_Request__c getRequestByRequestId(String requestId) {
        final List<SalesCopilot_Request__c> requests = [
            SELECT Id, Request_Id__c, Artifact_Url__c, Audience__c, Channel__c, Pricing_Type__c
            FROM SalesCopilot_Request__c
            WHERE Request_Id__c = :requestId
            WITH USER_MODE
            LIMIT 1
        ];
        return requests.isEmpty() ? null : requests[0];
    }

    public static List<SalesCopilot_Request__c> getRequests() {
        return [
            SELECT Id, Request_Id__c, Artifact_Url__c, Audience__c, Channel__c, Pricing_Type__c, Summary__c
            FROM SalesCopilot_Request__c
            WITH USER_MODE
        ];
    }

    public static List<Product2> getProductsByRequestId(String requestId) {
        return [
            SELECT Id, Name, ProductCode, IsActive, Type, Audience__c, SalesCopilot_Request__c
            FROM Product2
            WHERE SalesCopilot_Request__r.Request_Id__c = :requestId
            WITH USER_MODE
            ORDER BY ProductCode
        ];
    }

    public static List<PricebookEntry> getPricebookEntriesByProductIds(Set<Id> productIds) {
        return [
            SELECT Id, Product2Id, Pricebook2Id, UnitPrice, IsActive, ProductSellingModelId
            FROM PricebookEntry
            WHERE Product2Id IN :productIds
            WITH USER_MODE
        ];
    }

    public static List<PriceAdjustmentTier> getTiersByProductIds(Set<Id> productIds) {
        return [
            SELECT Id, Product2Id, PriceAdjustmentScheduleId, LowerBound, UpperBound, TierType, TierValue, EffectiveFrom
            FROM PriceAdjustmentTier
            WHERE Product2Id IN :productIds
            WITH USER_MODE
            ORDER BY LowerBound
        ];
    }

    public static List<ProductCategoryProduct> getCategoryAssignmentsByProductIds(Set<Id> productIds) {
        return [
            SELECT Id, ProductId, ProductCategoryId
            FROM ProductCategoryProduct
            WHERE ProductId IN :productIds
            WITH USER_MODE
        ];
    }

    public static Map<String, ProductSellingModel> getSellingModelsByName(Set<String> names) {
        final Map<String, ProductSellingModel> modelsByName = new Map<String, ProductSellingModel>();
        for (ProductSellingModel model : [
            SELECT Id, Name, SellingModelType
            FROM ProductSellingModel
            WHERE Name IN :names AND Status = 'Active'
            WITH USER_MODE
        ]) {
            modelsByName.put(model.Name, model);
        }
        return modelsByName;
    }

    public static ProductRelationshipType getBundleRelationshipType() {
        final List<ProductRelationshipType> types = [
            SELECT Id
            FROM ProductRelationshipType
            WHERE MainProductRoleCat = 'Bundle' AND AssociatedProductRoleCat = 'BundleComponent'
            WITH USER_MODE
            LIMIT 1
        ];
        return types.isEmpty() ? null : types[0];
    }

    public static List<ProductRelatedComponent> getComponentsByParentIds(Set<Id> parentIds) {
        return [
            SELECT Id, ParentProductId, ChildProductId, ChildProduct.Name, ProductComponentGroupId,
                ProductRelationshipTypeId, Quantity, IsComponentRequired
            FROM ProductRelatedComponent
            WHERE ParentProductId IN :parentIds
            WITH USER_MODE
            ORDER BY Sequence
        ];
    }

    public static PriceAdjustmentSchedule getScheduleByName(String name) {
        final List<PriceAdjustmentSchedule> schedules = [
            SELECT Id, IsActive, EffectiveFrom
            FROM PriceAdjustmentSchedule
            WHERE Name = :name
            WITH USER_MODE
            LIMIT 1
        ];
        return schedules.isEmpty() ? null : schedules[0];
    }

    public static ProductCategory getCategoryByCode(String code) {
        final List<ProductCategory> categories = [
            SELECT Id
            FROM ProductCategory
            WHERE Code = :code
            WITH USER_MODE
            LIMIT 1
        ];
        return categories.isEmpty() ? null : categories[0];
    }

    // Without SeeAllData the standard price book is invisible to SOQL in tests.
    public static Id getStandardPricebookId() {
        if (Test.isRunningTest()) {
            return Test.getStandardPricebookId();
        }
        final List<Pricebook2> pricebooks = [
            SELECT Id
            FROM Pricebook2
            WHERE IsStandard = TRUE AND IsActive = TRUE
            WITH USER_MODE
            LIMIT 1
        ];
        return pricebooks.isEmpty() ? null : pricebooks[0].Id;
    }

    public static Quote getQuoteById(Id quoteId) {
        return [SELECT Id, GrandTotal, Status FROM Quote WHERE Id = :quoteId WITH USER_MODE LIMIT 1];
    }

    // ─── Customer context ────────────────────────────────────────────────────

    public static List<Account> getAccountsByName(String namePart, Integer maxResults) {
        final String pattern = '%' + namePart + '%';
        return [
            SELECT Id, Name, Customer_Segment__c, Industry, NumberOfEmployees, Description
            FROM Account
            WHERE Name LIKE :pattern
            WITH USER_MODE
            ORDER BY Name
            LIMIT :maxResults
        ];
    }

    public static List<Account> getAccountsByIdOrName(String idOrName) {
        Id accountId;
        try {
            accountId = Id.valueOf(idOrName);
        } catch (StringException e) {
            accountId = null;
        }
        return [
            SELECT Id, Name, Customer_Segment__c
            FROM Account
            WHERE Id = :accountId OR Name = :idOrName
            WITH USER_MODE
            LIMIT 2
        ];
    }

    public static List<Asset> getAssetsByAccountIds(Set<Id> accountIds) {
        return [
            SELECT Id, AccountId, Name, Product2Id, Product2.Name, Quantity, Price, Status, InstallDate, UsageEndDate
            FROM Asset
            WHERE AccountId IN :accountIds
            WITH USER_MODE
            ORDER BY InstallDate
        ];
    }

    public static List<Quote> getOpenQuotesByAccountIds(Set<Id> accountIds, Set<String> closedStatuses) {
        return [
            SELECT Id, AccountId, Name, Status, GrandTotal, CreatedDate
            FROM Quote
            WHERE AccountId IN :accountIds AND Status NOT IN :closedStatuses
            WITH USER_MODE
            ORDER BY CreatedDate DESC
        ];
    }

    public static List<Product2> getProductsByIds(Set<Id> productIds) {
        return [
            SELECT Id, Name, ProductCode, Type, Audience__c
            FROM Product2
            WHERE Id IN :productIds
            WITH USER_MODE
        ];
    }

    // Newest first, so a name reused by a later request resolves to the latest product.
    public static List<Product2> getSellableProductsByKeys(Set<String> namesOrCodes) {
        return [
            SELECT Id, Name, ProductCode, Type, Audience__c
            FROM Product2
            WHERE IsActive = TRUE AND (Name IN :namesOrCodes OR ProductCode IN :namesOrCodes)
            WITH USER_MODE
            ORDER BY CreatedDate DESC
        ];
    }

    // ─── Catalog ─────────────────────────────────────────────────────────────

    // Newest first, matching getSellableProductsByKeys, so the catalog lists what a quote would resolve to.
    public static List<PricebookEntry> getSellableEntries(Id pricebookId) {
        return [
            SELECT Id, Product2Id, UnitPrice, Product2.Name, Product2.ProductCode, Product2.Type,
                Product2.Audience__c, Product2.Description, ProductSellingModel.Name,
                ProductSellingModel.SellingModelType, ProductSellingModel.PricingTermUnit
            FROM PricebookEntry
            WHERE Pricebook2Id = :pricebookId AND IsActive = TRUE AND Product2.IsActive = TRUE
            WITH USER_MODE
            ORDER BY Product2.CreatedDate DESC
        ];
    }

    public static PermissionSet getPermissionSetByName(String name) {
        return [SELECT Id FROM PermissionSet WHERE Name = :name WITH USER_MODE LIMIT 1];
    }

    public static String getAppStartUrl(String appName) {
        final List<AppMenuItem> items = [
            SELECT StartUrl
            FROM AppMenuItem
            WHERE Name = :appName
            WITH USER_MODE
            LIMIT 1
        ];
        return items.isEmpty() ? null : items[0].StartUrl;
    }
}
