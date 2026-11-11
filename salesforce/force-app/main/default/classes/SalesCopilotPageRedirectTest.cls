@IsTest
private class SalesCopilotPageRedirectTest {

    @IsTest
    static void targetUrl_onlyPassesWellFormedIds() {
        final String startUrl = SalesCopilotSelector.getAppStartUrl(SalesCopilotConstants.APP_NAME);
        final String quoteId = '0Q0' + '000000000001AAA';

        final String forQuote = SalesCopilotPageRedirect.targetUrl(new Map<String, String>{ 'quoteId' => quoteId });
        final String forRequest = SalesCopilotPageRedirect.targetUrl(new Map<String, String>{ 'requestId' => 'req_af_1' });
        final String forJunk = SalesCopilotPageRedirect.targetUrl(
            new Map<String, String>{ 'requestId' => 'x"><script>', 'quoteId' => 'https://evil.example' }
        );

        if (startUrl == null) {
            Assert.isNull(forQuote);
            return;
        }
        Assert.isTrue(forQuote.startsWith(startUrl) && forQuote.endsWith('quoteId=' + quoteId), forQuote);
        Assert.isTrue(forRequest.endsWith('requestId=req_af_1'), forRequest);
        Assert.areEqual(startUrl, forJunk);
    }

    @IsTest
    static void redirect_withoutTheApp_staysOnThePageOrRedirectsToTheApp() {
        Test.setCurrentPage(new PageReference(SalesCopilotPageRedirect.PAGE_PATH + '?requestId=req_af_1'));
        final PageReference result = new SalesCopilotPageRedirect().redirect();
        if (SalesCopilotSelector.getAppStartUrl(SalesCopilotConstants.APP_NAME) == null) {
            Assert.isNull(result);
        } else {
            Assert.isTrue(result.getRedirect());
            Assert.isTrue(result.getUrl().contains('requestId=req_af_1'), result.getUrl());
        }
    }

    @IsTest
    static void toOrgDomainLinks_rewritesOnlyConfiguratorLinks() {
        final String startUrl = SalesCopilotSelector.getAppStartUrl(SalesCopilotConstants.APP_NAME);
        final String other = 'https://example.com/x?quoteId=1';
        final String json = '{"pageUrl":"' + startUrl + '?quoteId=0Q0","recordUrl":"' + other + '"}';

        final String rewritten = SalesCopilotPageRedirect.toOrgDomainLinks(json);

        Assert.isTrue(rewritten.contains(other), rewritten);
        if (startUrl != null && !startUrl.contains('?')) {
            Assert.isTrue(rewritten.contains(SalesCopilotPageRedirect.PAGE_PATH + '?quoteId=0Q0'), rewritten);
            Assert.isFalse(rewritten.contains(startUrl + '?'), rewritten);
        }
    }
}
