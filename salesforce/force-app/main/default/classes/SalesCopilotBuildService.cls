public with sharing class SalesCopilotBuildService {

    public class OrgSetupException extends Exception {
    }

    public static SalesCopilotBuildResponse build(String body) {
        SalesCopilotRequestWrapper request;
        try {
            request = SalesCopilotRequestWrapper.parse(body);
        } catch (SalesCopilotRequestWrapper.InvalidRequestException e) {
            return failed(null, SalesCopilotConstants.HTTP_BAD_REQUEST, e.getMessage());
        }

        final SalesCopilot_Request__c existing = SalesCopilotSelector.getRequestByRequestId(request.requestId);
        if (existing != null) {
            return created(request.requestId, existing);
        }

        final CatalogCheck check = resolveCatalogProducts(request);
        final List<String> errors = check.errors;
        errors.addAll(request.validate(UserInfo.getDefaultCurrency()));
        if (!errors.isEmpty()) {
            errors.addAll(check.conflicts);
            return failed(request.requestId, SalesCopilotConstants.HTTP_BAD_REQUEST, String.join(errors, '; '));
        }
        // Only name clashes left: the offer is probably already there, so the caller can open it instead.
        if (!check.conflicts.isEmpty()) {
            return SalesCopilotBuildResponse.builderInstance()
                .withRequestId(request.requestId)
                .withExisting(check.existingProducts, String.join(check.conflicts, '; '))
                .get();
        }

        final Savepoint savepoint = Database.setSavepoint();
        try {
            return created(request.requestId, createConfiguration(request, body));
        } catch (OrgSetupException e) {
            Database.rollback(savepoint);
            return failed(request.requestId, SalesCopilotConstants.HTTP_SERVER_ERROR, e.getMessage());
        } catch (DmlException e) {
            Database.rollback(savepoint);
            return failed(
                request.requestId,
                SalesCopilotConstants.HTTP_SERVER_ERROR,
                'Salesforce rejected the configuration: ' + e.getDmlMessage(0)
            );
        } catch (Exception e) {
            Database.rollback(savepoint);
            return failed(
                request.requestId,
                SalesCopilotConstants.HTTP_SERVER_ERROR,
                'The configuration could not be built: ' + e.getMessage()
            );
        }
    }

    // ─── Catalog ─────────────────────────────────────────────────────────────

    // A reused product keeps its catalog name, price and billing; a new product may not take the name of one
    // already sold, or the catalog ends up with two products the rep cannot tell apart.
    private class CatalogCheck {
        public final List<String> errors = new List<String>();
        public final List<String> conflicts = new List<String>();
        public final List<SalesCopilotBuildResponse.ExistingProduct> existingProducts = new List<SalesCopilotBuildResponse.ExistingProduct>();

        public void addConflict(PricebookEntry entry, String message) {
            conflicts.add(message);
            final SalesCopilotBuildResponse.ExistingProduct product = new SalesCopilotBuildResponse.ExistingProduct();
            product.productId = entry.Product2Id;
            product.name = entry.Product2.Name;
            product.unitPrice = entry.UnitPrice;
            product.billing = toSellingModelKey(entry.ProductSellingModel) == SalesCopilotConstants.SELLING_MODEL_EVERGREEN
                ? 'monthly'
                : 'one-time';
            product.artifactUrl = entry.Product2.SalesCopilot_Request__r?.Artifact_Url__c;
            product.recordUrl = SalesCopilotCatalogService.toRecordUrl(entry.Product2Id);
            existingProducts.add(product);
        }
    }

    private static CatalogCheck resolveCatalogProducts(SalesCopilotRequestWrapper request) {
        final CatalogCheck check = new CatalogCheck();
        final List<String> errors = check.errors;
        final Set<Id> productIds = new Set<Id>();
        final Set<String> newNames = new Set<String>();
        for (SalesCopilotRequestWrapper.ProductLine line : request.products) {
            if (line.isExisting()) {
                productIds.add(line.productId);
            } else if (String.isNotBlank(line.name)) {
                newNames.add(line.name);
            }
        }
        if (request.isBundle() && String.isNotBlank(request.bundleName)) {
            newNames.add(request.bundleName);
        }
        final Id pricebookId = SalesCopilotSelector.getStandardPricebookId();
        if (pricebookId == null || (productIds.isEmpty() && newNames.isEmpty())) {
            return check;
        }

        final Map<Id, PricebookEntry> entriesByProductId = new Map<Id, PricebookEntry>();
        final Map<String, PricebookEntry> entriesByName = new Map<String, PricebookEntry>();
        for (PricebookEntry entry : SalesCopilotSelector.getSellableEntriesByProducts(pricebookId, productIds, newNames)) {
            if (!entriesByProductId.containsKey(entry.Product2Id)) {
                entriesByProductId.put(entry.Product2Id, entry);
            }
            if (!entriesByName.containsKey(entry.Product2.Name.toLowerCase())) {
                entriesByName.put(entry.Product2.Name.toLowerCase(), entry);
            }
        }

        for (SalesCopilotRequestWrapper.ProductLine line : request.products) {
            if (line.isExisting()) {
                applyCatalogEntry(line, entriesByProductId.get(line.productId), request.getAudience(), errors);
            } else if (String.isNotBlank(line.name) && entriesByName.containsKey(line.name.toLowerCase())) {
                final PricebookEntry entry = entriesByName.get(line.name.toLowerCase());
                check.addConflict(
                    entry,
                    '"' + entry.Product2.Name + '" already exists in the catalog (productId ' + entry.Product2Id + ', ' +
                    describePrice(entry) + '); send its productId to reuse it, or give the new product another name'
                );
            }
        }
        if (request.isBundle() && String.isNotBlank(request.bundleName) && entriesByName.containsKey(request.bundleName.toLowerCase())) {
            check.addConflict(
                entriesByName.get(request.bundleName.toLowerCase()),
                'A product named "' + request.bundleName + '" already exists in the catalog; give the bundle another name'
            );
        }
        return check;
    }

    private static void applyCatalogEntry(
        SalesCopilotRequestWrapper.ProductLine line,
        PricebookEntry entry,
        String requestAudience,
        List<String> errors
    ) {
        if (entry == null) {
            errors.add('productId ' + line.productId + ' is not an active product in the price book');
            return;
        }
        final String catalogName = entry.Product2.Name;
        if (String.isNotBlank(line.name) && !line.name.equalsIgnoreCase(catalogName)) {
            errors.add('productId ' + line.productId + ' is "' + catalogName + '" in the catalog, not "' + line.name + '"');
            return;
        }
        if (line.basePrice != null && line.basePrice != entry.UnitPrice) {
            errors.add(
                '"' + catalogName + '" is in the catalog at ' + describePrice(entry) +
                '; a build does not change the price of an existing product, so omit basePrice'
            );
        }
        final String sellingModelKey = toSellingModelKey(entry.ProductSellingModel);
        if (sellingModelKey == null) {
            errors.add('"' + catalogName + '" has a selling model a bundle cannot carry yet');
        }
        final String productAudience = entry.Product2.Audience__c;
        if (
            String.isNotBlank(productAudience) &&
            productAudience != SalesCopilotConstants.AUDIENCE_BOTH &&
            requestAudience != null &&
            productAudience != requestAudience
        ) {
            errors.add('"' + catalogName + '" is sold to ' + productAudience + ' customers only, not ' + requestAudience);
        }
        line.name = catalogName;
        line.basePrice = entry.UnitPrice;
        line.sellingModel = sellingModelKey;
    }

    private static String toSellingModelKey(ProductSellingModel model) {
        if (model == null || model.SellingModelType == 'OneTime') {
            return SalesCopilotConstants.SELLING_MODEL_ONE_TIME;
        }
        if (model.SellingModelType == 'Evergreen' && model.PricingTermUnit == 'Months') {
            return SalesCopilotConstants.SELLING_MODEL_EVERGREEN;
        }
        return null;
    }

    private static String describePrice(PricebookEntry entry) {
        final String key = toSellingModelKey(entry.ProductSellingModel);
        return entry.UnitPrice.setScale(2) + ' ' + UserInfo.getDefaultCurrency() +
            (key == SalesCopilotConstants.SELLING_MODEL_EVERGREEN ? ' per month' : '');
    }

    // ─── Configuration ───────────────────────────────────────────────────────

    private static SalesCopilot_Request__c createConfiguration(SalesCopilotRequestWrapper request, String body) {
        final OrgSetup setup = new OrgSetup(request);

        final SalesCopilot_Request__c requestRecord = buildRequestRecord(request, body);
        insert requestRecord;

        final Map<String, Product2> productsByName = buildProducts(request, requestRecord.Id);
        insert productsByName.values();

        // Reused products already have their selling model option, price and category.
        final Map<Id, ProductSellingModel> sellingModelByProductId = new Map<Id, ProductSellingModel>();
        final Map<Id, Decimal> priceByProductId = new Map<Id, Decimal>();
        for (SalesCopilotRequestWrapper.ProductLine line : request.products) {
            if (line.isExisting()) {
                productsByName.put(line.name.toLowerCase(), new Product2(Id = line.productId, Name = line.name));
                continue;
            }
            final Id productId = productsByName.get(line.name.toLowerCase()).Id;
            sellingModelByProductId.put(productId, setup.getSellingModel(line.getSellingModelKey()));
            priceByProductId.put(productId, line.basePrice);
        }

        // Components must exist before their bundle; the bundle itself is priced through its components.
        Product2 bundle;
        if (request.isBundle()) {
            bundle = buildBundle(request, requestRecord.Id);
            insert bundle;
            sellingModelByProductId.put(bundle.Id, setup.getSellingModel(request.getBundleSellingModelKey()));
            priceByProductId.put(bundle.Id, 0);
        }

        insert buildSellingModelOptions(sellingModelByProductId);
        insert buildPricebookEntries(sellingModelByProductId, priceByProductId, setup);
        insert buildCategoryAssignments(sellingModelByProductId.keySet(), setup);

        if (bundle != null) {
            buildBundleStructure(request, bundle, productsByName, setup);
        }

        if (request.pricingType == SalesCopilotConstants.PRICING_VOLUME_TIER) {
            setScheduleActive(setup.volumeSchedule, false);
            insert buildTiers(request, productsByName, sellingModelByProductId, setup);
            setScheduleActive(setup.volumeSchedule, true);
        }

        requestRecord.Artifact_Url__c = buildArtifactUrl(request.requestId, requestRecord.Id);
        requestRecord.Record_Url__c = SalesCopilotCatalogService.toRecordUrl(
            bundle != null ? bundle.Id : productsByName.get(request.products[0].name.toLowerCase()).Id
        );
        update requestRecord;
        return requestRecord;
    }

    private static SalesCopilot_Request__c buildRequestRecord(SalesCopilotRequestWrapper request, String body) {
        return new SalesCopilot_Request__c(
            Name = request.requestId.left(80),
            Request_Id__c = request.requestId,
            Channel__c = request.getChannel(),
            Pricing_Type__c = request.pricingType,
            Audience__c = request.getAudience(),
            Summary__c = request.summary,
            Raw_Request__c = request.rawRequest,
            Assumptions__c = String.join(request.assumptions, '\n'),
            Presentation__c = request.presentation == null ? null : JSON.serialize(request.presentation, true),
            Payload__c = body.left(SalesCopilotConstants.PAYLOAD_MAX_LENGTH)
        );
    }

    private static Map<String, Product2> buildProducts(SalesCopilotRequestWrapper request, Id requestRecordId) {
        final Map<String, Product2> productsByName = new Map<String, Product2>();
        Integer position = 0;
        for (SalesCopilotRequestWrapper.ProductLine line : request.products) {
            position++;
            if (line.isExisting()) {
                continue;
            }
            productsByName.put(
                line.name.toLowerCase(),
                new Product2(
                    Name = line.name,
                    ProductCode = SalesCopilotConstants.PRODUCT_CODE_PREFIX + request.requestId + '-' + position,
                    Description = request.summary,
                    IsActive = true,
                    Audience__c = request.getAudience(),
                    SalesCopilot_Request__c = requestRecordId
                )
            );
        }
        return productsByName;
    }

    private static Product2 buildBundle(SalesCopilotRequestWrapper request, Id requestRecordId) {
        return new Product2(
            Name = request.getBundleName(),
            ProductCode = SalesCopilotConstants.PRODUCT_CODE_PREFIX + request.requestId + SalesCopilotConstants.BUNDLE_CODE_SUFFIX,
            Description = request.summary,
            IsActive = true,
            Type = SalesCopilotConstants.PRODUCT_TYPE_BUNDLE,
            ConfigureDuringSale = SalesCopilotConstants.CONFIGURE_DURING_SALE_ALLOWED,
            Audience__c = request.getAudience(),
            SalesCopilot_Request__c = requestRecordId
        );
    }

    // Required components sit in a group whose min and max equal their count, so none can be dropped;
    // optional ones sit in a group with min 0.
    private static void buildBundleStructure(
        SalesCopilotRequestWrapper request,
        Product2 bundle,
        Map<String, Product2> productsByName,
        OrgSetup setup
    ) {
        final List<SalesCopilotRequestWrapper.BundleComponent> required = new List<SalesCopilotRequestWrapper.BundleComponent>();
        final List<SalesCopilotRequestWrapper.BundleComponent> optional = new List<SalesCopilotRequestWrapper.BundleComponent>();
        for (SalesCopilotRequestWrapper.BundleComponent component : request.getBundleComponents()) {
            if (component.isOptional) {
                optional.add(component);
            } else {
                required.add(component);
            }
        }

        final Map<String, ProductComponentGroup> groupsByName = new Map<String, ProductComponentGroup>();
        if (!required.isEmpty()) {
            groupsByName.put(SalesCopilotConstants.GROUP_INCLUDED, buildGroup(bundle, SalesCopilotConstants.GROUP_INCLUDED, required.size(), required.size(), 1));
        }
        if (!optional.isEmpty()) {
            groupsByName.put(SalesCopilotConstants.GROUP_OPTIONAL, buildGroup(bundle, SalesCopilotConstants.GROUP_OPTIONAL, 0, optional.size(), 2));
        }
        insert groupsByName.values();

        final List<ProductRelatedComponent> components = new List<ProductRelatedComponent>();
        Integer sequence = 0;
        for (SalesCopilotRequestWrapper.BundleComponent component : required) {
            components.add(buildComponent(bundle, component, productsByName, groupsByName.get(SalesCopilotConstants.GROUP_INCLUDED), setup, ++sequence));
        }
        for (SalesCopilotRequestWrapper.BundleComponent component : optional) {
            components.add(buildComponent(bundle, component, productsByName, groupsByName.get(SalesCopilotConstants.GROUP_OPTIONAL), setup, ++sequence));
        }
        insert components;
    }

    private static ProductComponentGroup buildGroup(Product2 bundle, String name, Integer min, Integer max, Integer sequence) {
        return new ProductComponentGroup(
            Name = name,
            Code = bundle.ProductCode + '-' + name.toUpperCase(),
            ParentProductId = bundle.Id,
            MinBundleComponents = min,
            MaxBundleComponents = max,
            Sequence = sequence
        );
    }

    private static ProductRelatedComponent buildComponent(
        Product2 bundle,
        SalesCopilotRequestWrapper.BundleComponent component,
        Map<String, Product2> productsByName,
        ProductComponentGroup componentGroup,
        OrgSetup setup,
        Integer sequence
    ) {
        return new ProductRelatedComponent(
            ParentProductId = bundle.Id,
            ChildProductId = productsByName.get(component.productName.toLowerCase()).Id,
            ProductComponentGroupId = componentGroup.Id,
            ProductRelationshipTypeId = setup.bundleRelationshipType.Id,
            IsComponentRequired = !component.isOptional,
            IsDefaultComponent = !component.isOptional,
            DoesBundlePriceIncludeChild = false,
            IsQuantityEditable = false,
            Quantity = component.quantity == null ? 1 : component.quantity,
            Sequence = sequence
        );
    }

    private static List<ProductSellingModelOption> buildSellingModelOptions(Map<Id, ProductSellingModel> sellingModelByProductId) {
        final List<ProductSellingModelOption> options = new List<ProductSellingModelOption>();
        for (Id productId : sellingModelByProductId.keySet()) {
            options.add(
                new ProductSellingModelOption(
                    Product2Id = productId,
                    ProductSellingModelId = sellingModelByProductId.get(productId).Id,
                    IsDefault = true
                )
            );
        }
        return options;
    }

    private static List<PricebookEntry> buildPricebookEntries(
        Map<Id, ProductSellingModel> sellingModelByProductId,
        Map<Id, Decimal> priceByProductId,
        OrgSetup setup
    ) {
        final List<PricebookEntry> entries = new List<PricebookEntry>();
        for (Id productId : sellingModelByProductId.keySet()) {
            entries.add(
                new PricebookEntry(
                    Pricebook2Id = setup.pricebookId,
                    Product2Id = productId,
                    ProductSellingModelId = sellingModelByProductId.get(productId).Id,
                    UnitPrice = priceByProductId.get(productId),
                    IsActive = true
                )
            );
        }
        return entries;
    }

    private static List<ProductCategoryProduct> buildCategoryAssignments(Set<Id> productIds, OrgSetup setup) {
        final List<ProductCategoryProduct> assignments = new List<ProductCategoryProduct>();
        for (Id productId : productIds) {
            assignments.add(
                new ProductCategoryProduct(
                    ProductCategoryId = setup.category.Id,
                    ProductId = productId,
                    IsPrimaryCategory = true
                )
            );
        }
        return assignments;
    }

    // Range mode: one rate covers every unit on the line. The volume lookup treats both bounds as inclusive,
    // so a tier ends one unit before the next starts; sharing the bound leaves that quantity unpriced.
    // A tier must carry an Effective From inside its schedule's dates; the schedule's own start always is.
    private static List<PriceAdjustmentTier> buildTiers(
        SalesCopilotRequestWrapper request,
        Map<String, Product2> productsByName,
        Map<Id, ProductSellingModel> sellingModelByProductId,
        OrgSetup setup
    ) {
        final List<PriceAdjustmentTier> tiers = new List<PriceAdjustmentTier>();
        for (SalesCopilotRequestWrapper.ProductLine line : request.getDiscountedProducts()) {
            final Id productId = productsByName.get(line.name.toLowerCase()).Id;
            final Id sellingModelId = sellingModelByProductId.get(productId).Id;
            for (Integer i = 0; i < request.tiers.size(); i++) {
                final SalesCopilotRequestWrapper.Tier tier = request.tiers[i];
                final Boolean isLast = i == request.tiers.size() - 1;
                tiers.add(
                    new PriceAdjustmentTier(
                        PriceAdjustmentScheduleId = setup.volumeSchedule.Id,
                        Product2Id = productId,
                        ProductSellingModelId = sellingModelId,
                        TierType = SalesCopilotConstants.TIER_TYPE_PERCENTAGE,
                        TierValue = tier.discountPct,
                        LowerBound = tier.fromQuantity,
                        UpperBound = isLast ? null : request.tiers[i + 1].fromQuantity - 1,
                        EffectiveFrom = setup.volumeSchedule.EffectiveFrom
                    )
                );
            }
        }
        return tiers;
    }

    // Tiers cannot be added while their schedule is active, and a schedule cannot be activated before it has
    // a tier; the shared schedule is switched off only inside this transaction.
    private static void setScheduleActive(PriceAdjustmentSchedule schedule, Boolean isActive) {
        if (schedule.IsActive != isActive) {
            update new PriceAdjustmentSchedule(Id = schedule.Id, IsActive = isActive);
            schedule.IsActive = isActive;
        }
    }

    private static String buildArtifactUrl(String requestId, Id requestRecordId) {
        final String startUrl = SalesCopilotSelector.getAppStartUrl(SalesCopilotConstants.APP_NAME);
        final String baseUrl = String.isBlank(startUrl)
            ? URL.getOrgDomainUrl().toExternalForm() + '/' + requestRecordId
            : startUrl;
        return baseUrl +
            (baseUrl.contains('?') ? '&' : '?') +
            SalesCopilotConstants.REQUEST_ID_PARAM +
            '=' +
            EncodingUtil.urlEncode(requestId, 'UTF-8');
    }

    // ─── Responses ───────────────────────────────────────────────────────────

    private static SalesCopilotBuildResponse created(String requestId, SalesCopilot_Request__c requestRecord) {
        return SalesCopilotBuildResponse.builderInstance()
            .withRequestId(requestId)
            .withCreated(requestRecord.Artifact_Url__c, requestRecord.Record_Url__c)
            .get();
    }

    private static SalesCopilotBuildResponse failed(String requestId, Integer statusCode, String error) {
        return SalesCopilotBuildResponse.builderInstance()
            .withRequestId(requestId)
            .withFailed(statusCode, error)
            .get();
    }

    // ─── One-time org setup ──────────────────────────────────────────────────

    private class OrgSetup {
        public final Map<String, ProductSellingModel> sellingModelsByName;
        public final Id pricebookId;
        public final ProductCategory category;
        public final PriceAdjustmentSchedule volumeSchedule;
        public final ProductRelationshipType bundleRelationshipType;

        public OrgSetup(SalesCopilotRequestWrapper request) {
            final String pricingType = request.pricingType;
            final Set<String> sellingModelNames = new Set<String>();
            for (String key : request.getSellingModelKeys()) {
                sellingModelNames.add(SalesCopilotConstants.SELLING_MODEL_NAME_BY_KEY.get(key));
            }
            this.sellingModelsByName = SalesCopilotSelector.getSellingModelsByName(sellingModelNames);
            this.pricebookId = SalesCopilotSelector.getStandardPricebookId();
            this.category = SalesCopilotSelector.getCategoryByCode(SalesCopilotConstants.CATEGORY_CODE);
            this.volumeSchedule = pricingType == SalesCopilotConstants.PRICING_VOLUME_TIER
                ? SalesCopilotSelector.getScheduleByName(SalesCopilotConstants.VOLUME_SCHEDULE_NAME)
                : null;
            this.bundleRelationshipType = request.isBundle() ? SalesCopilotSelector.getBundleRelationshipType() : null;

            final List<String> missing = new List<String>();
            for (String name : sellingModelNames) {
                if (!sellingModelsByName.containsKey(name)) {
                    missing.add('active selling model "' + name + '"');
                }
            }
            if (request.isBundle() && bundleRelationshipType == null) {
                missing.add('product relationship type Bundle to Bundle Component');
            }
            if (pricebookId == null) {
                missing.add('active Standard Price Book');
            }
            if (category == null) {
                missing.add('product category with code ' + SalesCopilotConstants.CATEGORY_CODE);
            }
            if (pricingType == SalesCopilotConstants.PRICING_VOLUME_TIER && volumeSchedule?.EffectiveFrom == null) {
                missing.add(
                    'price adjustment schedule "' + SalesCopilotConstants.VOLUME_SCHEDULE_NAME + '" with an Effective From date'
                );
            }
            if (!missing.isEmpty()) {
                throw new OrgSetupException('Salesforce org setup is incomplete, missing: ' + String.join(missing, ', '));
            }
        }

        public ProductSellingModel getSellingModel(String key) {
            return sellingModelsByName.get(SalesCopilotConstants.SELLING_MODEL_NAME_BY_KEY.get(key));
        }
    }
}
