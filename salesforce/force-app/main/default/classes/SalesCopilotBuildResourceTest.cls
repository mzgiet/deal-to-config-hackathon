@IsTest
private class SalesCopilotBuildResourceTest {

    @TestSetup
    static void makeData() {
        SalesCopilotTestDataFactory.grantBuildAccess();
        SalesCopilotTestDataFactory.createOrgSetup();
    }

    @IsTest
    static void build_volumeTierRequest_createsProductPriceAndRangeTiers() {
        System.runAs(SalesCopilotTestDataFactory.buildUser()) {
            final String body = SalesCopilotTestDataFactory.volumeTierRequest('req_test_001');

            Test.startTest();
            final Map<String, Object> response = post(body);
            Test.stopTest();

            Assert.areEqual(200, RestContext.response.statusCode, String.valueOf(response));
            Assert.areEqual('created', response.get('status'));
            Assert.isTrue(String.valueOf(response.get('artifactUrl')).endsWith('requestId=req_test_001'));

            final List<Product2> products = SalesCopilotSelector.getProductsByRequestId('req_test_001');
            Assert.areEqual(1, products.size());
            Assert.areEqual(SalesCopilotTestDataFactory.CLOUD_ANALYTICS, products[0].Name);
            Assert.areEqual('Business', products[0].Audience__c);
            Assert.isTrue(products[0].IsActive);

            final Set<Id> productIds = new Map<Id, Product2>(products).keySet();
            final List<PricebookEntry> entries = SalesCopilotSelector.getPricebookEntriesByProductIds(productIds);
            Assert.areEqual(1, entries.size());
            Assert.areEqual(40, entries[0].UnitPrice);
            Assert.isNotNull(entries[0].ProductSellingModelId);

            final List<PriceAdjustmentTier> tiers = SalesCopilotSelector.getTiersByProductIds(productIds);
            Assert.areEqual(2, tiers.size());
            Assert.areEqual(100, tiers[0].LowerBound);
            Assert.areEqual(499, tiers[0].UpperBound);
            Assert.areEqual(10, tiers[0].TierValue);
            Assert.areEqual(500, tiers[1].LowerBound);
            Assert.isNull(tiers[1].UpperBound);
            Assert.areEqual(15, tiers[1].TierValue);
            Assert.isNotNull(tiers[0].EffectiveFrom);

            Assert.areEqual(1, SalesCopilotSelector.getCategoryAssignmentsByProductIds(productIds).size());
            Assert.isTrue(SalesCopilotSelector.getScheduleByName(SalesCopilotConstants.VOLUME_SCHEDULE_NAME).IsActive);
        }
    }

    @IsTest
    static void build_sameRequestIdTwice_returnsSameLinkAndCreatesNoNewProducts() {
        System.runAs(SalesCopilotTestDataFactory.buildUser()) {
            final String body = SalesCopilotTestDataFactory.volumeTierRequest('req_test_002');
            final Map<String, Object> first = post(body);

            Test.startTest();
            final Map<String, Object> second = post(body);
            Test.stopTest();

            Assert.areEqual(200, RestContext.response.statusCode);
            Assert.areEqual(first.get('artifactUrl'), second.get('artifactUrl'));
            Assert.areEqual(1, SalesCopilotSelector.getProductsByRequestId('req_test_002').size());
            Assert.areEqual(1, SalesCopilotSelector.getRequests().size());
        }
    }

    @IsTest
    static void build_secondVolumeRequest_addsTiersWhileScheduleIsActive() {
        System.runAs(SalesCopilotTestDataFactory.buildUser()) {
            post(SalesCopilotTestDataFactory.volumeTierRequest('req_test_008'));
            final String body = SalesCopilotTestDataFactory.volumeTierRequest('req_test_009', 'Cloud Storage licence');

            Test.startTest();
            final Map<String, Object> response = post(body);
            Test.stopTest();

            Assert.areEqual(200, RestContext.response.statusCode, String.valueOf(response));
            final List<Product2> products = SalesCopilotSelector.getProductsByRequestId('req_test_009');
            final Set<Id> productIds = new Map<Id, Product2>(products).keySet();
            Assert.areEqual(2, SalesCopilotSelector.getTiersByProductIds(productIds).size());
            Assert.isTrue(SalesCopilotSelector.getScheduleByName(SalesCopilotConstants.VOLUME_SCHEDULE_NAME).IsActive);
        }
    }

    @IsTest
    static void build_flatRequest_createsProductWithoutTiers() {
        System.runAs(SalesCopilotTestDataFactory.buildUser()) {
            final String body = SalesCopilotTestDataFactory.flatRequest('req_test_003', UserInfo.getDefaultCurrency());

            Test.startTest();
            final Map<String, Object> response = post(body);
            Test.stopTest();

            Assert.areEqual(200, RestContext.response.statusCode, String.valueOf(response));
            final List<Product2> products = SalesCopilotSelector.getProductsByRequestId('req_test_003');
            Assert.areEqual(1, products.size());
            Assert.areEqual('Both', products[0].Audience__c);
            final Set<Id> productIds = new Map<Id, Product2>(products).keySet();
            Assert.areEqual(500, SalesCopilotSelector.getPricebookEntriesByProductIds(productIds)[0].UnitPrice);
            Assert.isTrue(SalesCopilotSelector.getTiersByProductIds(productIds).isEmpty());
            Assert.areEqual('cursor', SalesCopilotSelector.getRequestByRequestId('req_test_003').Channel__c);
        }
    }

    @IsTest
    static void build_unsupportedCurrency_returnsBadRequestAndCreatesNothing() {
        System.runAs(SalesCopilotTestDataFactory.buildUser()) {
            final String otherCurrency = UserInfo.getDefaultCurrency() == 'EUR' ? 'GBP' : 'EUR';
            final String body = SalesCopilotTestDataFactory.flatRequest('req_test_004', otherCurrency);

            Test.startTest();
            final Map<String, Object> response = post(body);
            Test.stopTest();

            Assert.areEqual(400, RestContext.response.statusCode);
            Assert.areEqual('failed', response.get('status'));
            Assert.isTrue(String.valueOf(response.get('error')).contains(otherCurrency));
            Assert.isTrue(SalesCopilotSelector.getRequests().isEmpty());
        }
    }

    @IsTest
    static void build_bundleWithDiscount_returnsBadRequestUntilBundleDiscountsAreSupported() {
        System.runAs(SalesCopilotTestDataFactory.buildUser()) {
            final String body = SalesCopilotTestDataFactory.bundleRequest('req_test_005');

            Test.startTest();
            final Map<String, Object> response = post(body);
            Test.stopTest();

            Assert.areEqual(400, RestContext.response.statusCode);
            Assert.isTrue(String.valueOf(response.get('error')).contains('Bundle discounts'));
        }
    }

    @IsTest
    static void build_bundleWithCatalogProduct_reusesItAndCreatesOnlyTheNewOnes() {
        System.runAs(SalesCopilotTestDataFactory.buildUser()) {
            SalesCopilotTestDataFactory.ensureBundleRelationshipType();
            final Id mobileInternetId = SalesCopilotTestDataFactory.createCatalogProduct('Mobile Internet', 10);
            final String body = SalesCopilotTestDataFactory.bundleRequest(
                'req_test_010',
                new List<Object>{
                    SalesCopilotTestDataFactory.catalogProduct(mobileInternetId),
                    SalesCopilotTestDataFactory.product('Router', 15, UserInfo.getDefaultCurrency())
                },
                new List<Object>{
                    SalesCopilotTestDataFactory.component('Mobile Internet', false),
                    SalesCopilotTestDataFactory.component('Router', true)
                }
            );

            Test.startTest();
            final Map<String, Object> response = post(body);
            Test.stopTest();

            Assert.areEqual(200, RestContext.response.statusCode, String.valueOf(response));
            final Map<Id, Product2> created = new Map<Id, Product2>(SalesCopilotSelector.getProductsByRequestId('req_test_010'));
            Assert.areEqual(2, created.size(), 'Only the router and the bundle are new');
            Assert.isFalse(created.containsKey(mobileInternetId));

            final List<PricebookEntry> mobileInternetEntries = SalesCopilotSelector.getPricebookEntriesByProductIds(
                new Set<Id>{ mobileInternetId }
            );
            Assert.areEqual(1, mobileInternetEntries.size(), 'The catalog product gets no second price');

            Product2 bundle;
            for (Product2 product : created.values()) {
                if (product.Type == SalesCopilotConstants.PRODUCT_TYPE_BUNDLE) {
                    bundle = product;
                }
            }
            final List<ProductRelatedComponent> components = SalesCopilotSelector.getComponentsByParentIds(
                new Set<Id>{ bundle.Id }
            );
            Assert.areEqual(2, components.size());
            Assert.areEqual(mobileInternetId, components[0].ChildProductId);
            Assert.isTrue(components[0].IsComponentRequired);
        }
    }

    @IsTest
    static void build_newProductNamedLikeCatalogProduct_returnsConflictWithTheExistingProduct() {
        System.runAs(SalesCopilotTestDataFactory.buildUser()) {
            final Id onboardingId = SalesCopilotTestDataFactory.createCatalogProduct('Onboarding Service', 500);
            final String body = SalesCopilotTestDataFactory.flatRequest('req_test_011', UserInfo.getDefaultCurrency());

            Test.startTest();
            final Map<String, Object> response = post(body);
            Test.stopTest();

            Assert.areEqual(409, RestContext.response.statusCode);
            Assert.areEqual('exists', response.get('status'));
            Assert.isTrue(String.valueOf(response.get('error')).contains('already exists in the catalog'));
            final List<Object> existing = (List<Object>) response.get('existingProducts');
            Assert.areEqual(1, existing.size());
            final Map<String, Object> product = (Map<String, Object>) existing[0];
            Assert.areEqual(String.valueOf(onboardingId), product.get('productId'));
            Assert.areEqual(500, (Decimal) product.get('unitPrice'));
            Assert.areEqual('one-time', product.get('billing'));
            Assert.isTrue(SalesCopilotSelector.getRequests().isEmpty());
        }
    }

    @IsTest
    static void build_productBuiltEarlier_returnsConflictWithItsConfiguratorLink() {
        System.runAs(SalesCopilotTestDataFactory.buildUser()) {
            final Map<String, Object> first = post(SalesCopilotTestDataFactory.volumeTierRequest('req_test_014'));

            Test.startTest();
            final Map<String, Object> response = post(SalesCopilotTestDataFactory.volumeTierRequest('req_test_015'));
            Test.stopTest();

            Assert.areEqual(409, RestContext.response.statusCode, String.valueOf(response));
            final Map<String, Object> product = (Map<String, Object>) ((List<Object>) response.get('existingProducts'))[0];
            Assert.areEqual(first.get('artifactUrl'), product.get('artifactUrl'));
        }
    }

    @IsTest
    static void build_catalogProductWithAnotherPrice_returnsBadRequest() {
        System.runAs(SalesCopilotTestDataFactory.buildUser()) {
            final Id mobileInternetId = SalesCopilotTestDataFactory.createCatalogProduct('Mobile Internet', 10);
            final Map<String, Object> repriced = SalesCopilotTestDataFactory.catalogProduct(mobileInternetId);
            repriced.put('basePrice', 8);
            final String body = SalesCopilotTestDataFactory.bundleRequest(
                'req_test_012',
                new List<Object>{ repriced, SalesCopilotTestDataFactory.product('Router', 15, UserInfo.getDefaultCurrency()) },
                new List<Object>()
            );

            Test.startTest();
            final Map<String, Object> response = post(body);
            Test.stopTest();

            Assert.areEqual(400, RestContext.response.statusCode);
            Assert.isTrue(String.valueOf(response.get('error')).contains('does not change the price'));
        }
    }

    @IsTest
    static void build_catalogProductOutsideBundle_returnsBadRequest() {
        System.runAs(SalesCopilotTestDataFactory.buildUser()) {
            final Id onboardingId = SalesCopilotTestDataFactory.createCatalogProduct('Onboarding Service', 500);
            final Map<String, Object> body = (Map<String, Object>) JSON.deserializeUntyped(
                SalesCopilotTestDataFactory.flatRequest('req_test_013', UserInfo.getDefaultCurrency())
            );
            ((Map<String, Object>) body.get('extracted')).put(
                'products',
                new List<Object>{ SalesCopilotTestDataFactory.catalogProduct(onboardingId) }
            );

            Test.startTest();
            final Map<String, Object> response = post(JSON.serialize(body));
            Test.stopTest();

            Assert.areEqual(400, RestContext.response.statusCode);
            Assert.isTrue(String.valueOf(response.get('error')).contains('can only join a new bundle'));
        }
    }

    @IsTest
    static void build_duplicateTierStart_returnsBadRequest() {
        System.runAs(SalesCopilotTestDataFactory.buildUser()) {
            final String body = SalesCopilotTestDataFactory.volumeTierRequestWithTiers(
                'req_test_006',
                new List<Object>{
                    SalesCopilotTestDataFactory.tier(100, 10),
                    SalesCopilotTestDataFactory.tier(100, 15)
                }
            );

            Test.startTest();
            final Map<String, Object> response = post(body);
            Test.stopTest();

            Assert.areEqual(400, RestContext.response.statusCode);
            Assert.isTrue(String.valueOf(response.get('error')).contains('Two tiers start at 100'));
        }
    }

    @IsTest
    static void build_invalidJson_returnsBadRequest() {
        System.runAs(SalesCopilotTestDataFactory.buildUser()) {
            Test.startTest();
            final Map<String, Object> response = post('{"requestId": ');
            Test.stopTest();

            Assert.areEqual(400, RestContext.response.statusCode);
            Assert.areEqual('The request is not valid JSON', response.get('error'));
        }
    }

    @IsTest
    static void build_missingRequestId_returnsBadRequest() {
        System.runAs(SalesCopilotTestDataFactory.buildUser()) {
            Test.startTest();
            final Map<String, Object> response = post('{"extracted": {}}');
            Test.stopTest();

            Assert.areEqual(400, RestContext.response.statusCode);
            Assert.areEqual('requestId is missing', response.get('error'));
        }
    }

    @IsTest
    static void build_missingCategory_returnsServerErrorAndRollsBack() {
        System.runAs(SalesCopilotTestDataFactory.buildUser()) {
            delete SalesCopilotSelector.getCategoryByCode(SalesCopilotConstants.CATEGORY_CODE);
            final String body = SalesCopilotTestDataFactory.volumeTierRequest('req_test_007');

            Test.startTest();
            final Map<String, Object> response = post(body);
            Test.stopTest();

            Assert.areEqual(500, RestContext.response.statusCode);
            Assert.isTrue(String.valueOf(response.get('error')).contains(SalesCopilotConstants.CATEGORY_CODE));
            Assert.isTrue(SalesCopilotSelector.getRequests().isEmpty());
            Assert.isTrue(SalesCopilotSelector.getProductsByRequestId('req_test_007').isEmpty());
        }
    }

    private static Map<String, Object> post(String body) {
        RestContext.request = new RestRequest();
        RestContext.request.requestURI = '/services/apexrest/salescopilot/build';
        RestContext.request.httpMethod = 'POST';
        RestContext.request.requestBody = Blob.valueOf(body);
        RestContext.response = new RestResponse();

        SalesCopilotBuildResource.build();

        return (Map<String, Object>) JSON.deserializeUntyped(RestContext.response.responseBody.toString());
    }
}
