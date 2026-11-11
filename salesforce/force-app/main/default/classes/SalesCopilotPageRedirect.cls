/**
 * /apex/SalesCopilotPage?quoteId=... or ?requestId=... redirects to the Revenue Configurator page.
 *
 * Why: Agentforce strips links it does not trust from agent replies, and in Slack the configurator's own domain
 * (*.salesforce.app) stayed redacted while the org's my.salesforce.com domain is accepted. The agent therefore links
 * here, on the org domain, and this page forwards to the configurator.
 *
 * Not an open redirect: the target is always the configurator app's start URL, and only a well-formed quoteId or
 * requestId is passed on.
 */
public with sharing class SalesCopilotPageRedirect {

    public static final String PAGE_PATH = '/apex/SalesCopilotPage';
    private static final Pattern REQUEST_ID = Pattern.compile('^[A-Za-z0-9_-]{1,80}$');

    public PageReference redirect() {
        final String target = targetUrl(ApexPages.currentPage().getParameters());
        if (target == null) {
            return null;
        }
        final PageReference page = new PageReference(target);
        page.setRedirect(true);
        return page;
    }

    /** The configurator URL for these parameters, or null when the app or a valid id is missing. */
    public static String targetUrl(Map<String, String> params) {
        final String startUrl = SalesCopilotSelector.getAppStartUrl(SalesCopilotConstants.APP_NAME);
        if (String.isBlank(startUrl)) {
            return null;
        }
        final String separator = startUrl.contains('?') ? '&' : '?';
        final String quoteId = params.get(SalesCopilotConstants.QUOTE_ID_PARAM);
        if (isQuoteId(quoteId)) {
            return startUrl + separator + SalesCopilotConstants.QUOTE_ID_PARAM + '=' + quoteId;
        }
        final String requestId = params.get(SalesCopilotConstants.REQUEST_ID_PARAM);
        if (requestId != null && REQUEST_ID.matcher(requestId).matches()) {
            return startUrl + separator + SalesCopilotConstants.REQUEST_ID_PARAM + '=' + requestId;
        }
        return startUrl;
    }

    /**
     * Rewrites configurator links in an agent result to this page on the org domain. Only the app's start URL is
     * replaced, so every other link is left as it is.
     */
    public static String toOrgDomainLinks(String json) {
        final String startUrl = SalesCopilotSelector.getAppStartUrl(SalesCopilotConstants.APP_NAME);
        if (String.isBlank(json) || String.isBlank(startUrl) || startUrl.contains('?')) {
            return json;
        }
        return json.replace(startUrl + '?', URL.getOrgDomainUrl().toExternalForm() + PAGE_PATH + '?');
    }

    private static Boolean isQuoteId(String value) {
        if (String.isBlank(value)) {
            return false;
        }
        try {
            return ((Id) value).getSobjectType() == Quote.SObjectType;
        } catch (Exception e) {
            return false;
        }
    }
}
