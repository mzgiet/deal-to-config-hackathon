@IsTest
private class SalesCopilotAgentActionsTest {

    @TestSetup
    static void makeData() {
        SalesCopilotTestDataFactory.grantBuildAccess();
        SalesCopilotTestDataFactory.createOrgSetup();
    }

    @IsTest
    static void buildOffer_withoutRequestId_generatesOneTagsChannelAndQueuesPricingRefresh() {
        System.runAs(SalesCopilotTestDataFactory.buildUser()) {
            final Map<String, Object> body = (Map<String, Object>) JSON.deserializeUntyped(
                SalesCopilotTestDataFactory.volumeTierRequest('placeholder')
            );
            body.remove('requestId');

            final SalesCopilotAgentBuildOffer.Request request = new SalesCopilotAgentBuildOffer.Request();
            request.requestJson = JSON.serialize(body);

            Test.startTest();
            final SalesCopilotAgentSupport.Result result = SalesCopilotAgentBuildOffer.build(
                new List<SalesCopilotAgentBuildOffer.Request>{ request }
            )[0];
            Test.stopTest();

            Assert.areEqual('created', result.status, result.resultJson);
            final Map<String, Object> response = (Map<String, Object>) JSON.deserializeUntyped(result.resultJson);
            final String requestId = String.valueOf(response.get('requestId'));
            Assert.isTrue(requestId.startsWith('req_af_'), requestId);
            Assert.areEqual(
                SalesCopilotAgentSupport.CHANNEL,
                [SELECT Channel__c FROM SalesCopilot_Request__c WHERE Request_Id__c = :requestId].Channel__c
            );
        }
    }

    @IsTest
    static void buildOffer_invalidJson_returnsTheServiceError() {
        System.runAs(SalesCopilotTestDataFactory.buildUser()) {
            final SalesCopilotAgentBuildOffer.Request request = new SalesCopilotAgentBuildOffer.Request();
            request.requestJson = 'not json';

            final SalesCopilotAgentSupport.Result result = SalesCopilotAgentBuildOffer.build(
                new List<SalesCopilotAgentBuildOffer.Request>{ request }
            )[0];

            Assert.areEqual('failed', result.status);
            Assert.isTrue(result.resultJson.contains('error'), result.resultJson);
        }
    }

    @IsTest
    static void checkOffer_newProduct_isNew() {
        System.runAs(SalesCopilotTestDataFactory.buildUser()) {
            final SalesCopilotAgentCheckOffer.Request request = new SalesCopilotAgentCheckOffer.Request();
            request.requestJson = SalesCopilotTestDataFactory.volumeTierRequest('', 'Agent Test Product');

            final SalesCopilotAgentSupport.Result result = SalesCopilotAgentCheckOffer.check(
                new List<SalesCopilotAgentCheckOffer.Request>{ request }
            )[0];

            Assert.areEqual('new', result.status, result.resultJson);
        }
    }

    @IsTest
    static void readActions_returnTheEndpointJson() {
        System.runAs(SalesCopilotTestDataFactory.buildUser()) {
            final SalesCopilotAgentFindCustomer.Request customer = new SalesCopilotAgentFindCustomer.Request();
            customer.name = 'Nobody By This Name';
            final SalesCopilotAgentSupport.Result customers = SalesCopilotAgentFindCustomer.findCustomer(
                new List<SalesCopilotAgentFindCustomer.Request>{ customer }
            )[0];
            Assert.isNotNull(customers.status, customers.resultJson);
            Assert.isTrue(customers.resultJson.contains('customers'), customers.resultJson);

            final SalesCopilotAgentGetCatalog.Request catalog = new SalesCopilotAgentGetCatalog.Request();
            catalog.audience = 'Business';
            final SalesCopilotAgentSupport.Result products = SalesCopilotAgentGetCatalog.getCatalog(
                new List<SalesCopilotAgentGetCatalog.Request>{ catalog }
            )[0];
            Assert.isTrue(products.resultJson.contains('maxDiscountWithoutApprovalPct'), products.resultJson);
        }
    }

    @IsTest
    static void createQuote_unknownAccount_failsWithoutCreatingAnything() {
        System.runAs(SalesCopilotTestDataFactory.buildUser()) {
            final SalesCopilotAgentCreateQuote.Request request = new SalesCopilotAgentCreateQuote.Request();
            request.quoteJson = '{"account":"Nobody By This Name","lines":[{"product":"Nothing","quantity":1}]}';

            final SalesCopilotAgentSupport.Result result = SalesCopilotAgentCreateQuote.createQuote(
                new List<SalesCopilotAgentCreateQuote.Request>{ request }
            )[0];

            Assert.areEqual('failed', result.status, result.resultJson);
            Assert.areEqual(0, [SELECT COUNT() FROM Quote]);
        }
    }

    @IsTest
    static void withAgentDefaults_keepsAGivenRequestIdAndLeavesNonObjectsAlone() {
        final Map<String, Object> body = (Map<String, Object>) JSON.deserializeUntyped(
            SalesCopilotAgentSupport.withAgentDefaults('{"requestId":"req_keep","source":{"channel":"slack"}}')
        );
        Assert.areEqual('req_keep', body.get('requestId'));
        Assert.areEqual('agentforce', ((Map<String, Object>) body.get('source')).get('channel'));
        Assert.areEqual('[1,2]', SalesCopilotAgentSupport.withAgentDefaults('[1,2]'));
    }
}
