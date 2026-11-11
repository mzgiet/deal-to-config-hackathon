/**
 * /apex/SalesCopilotPage?id=<quoteId or requestId> redirects to the Revenue Configurator page.
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
    public static final String ID_PARAM = 'id';
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

    /**
     * The configurator URL for these parameters, or null when the app is missing. Accepts ?id= (what the agent is
     * given), ?quoteId= and ?requestId=, and as a last resort any parameter whose value is a Quote id: a model
     * retyping the link once turned quoteId into qId.
     */
    public static String targetUrl(Map<String, String> params) {
        final String startUrl = SalesCopilotSelector.getAppStartUrl(SalesCopilotConstants.APP_NAME);
        if (String.isBlank(startUrl)) {
            return null;
        }
        final String separator = startUrl.contains('?') ? '&' : '?';
        final List<String> candidates = new List<String>{
            params.get(ID_PARAM),
            params.get(SalesCopilotConstants.QUOTE_ID_PARAM),
            params.get(SalesCopilotConstants.REQUEST_ID_PARAM)
        };
        candidates.addAll(params.values());
        for (Integer i = 0; i < candidates.size(); i++) {
            candidates[i] = clean(candidates[i]);
        }
        for (String value : candidates) {
            if (isQuoteId(value)) {
                return startUrl + separator + SalesCopilotConstants.QUOTE_ID_PARAM + '=' + value;
            }
        }
        for (String value : new List<String>{ clean(params.get(ID_PARAM)), clean(params.get(SalesCopilotConstants.REQUEST_ID_PARAM)) }) {
            if (value != null && REQUEST_ID.matcher(value).matches()) {
                return startUrl + separator + SalesCopilotConstants.REQUEST_ID_PARAM + '=' + value;
            }
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
        final String page = URL.getOrgDomainUrl().toExternalForm() + PAGE_PATH + '?' + ID_PARAM + '=';
        return json
            .replace(startUrl + '?' + SalesCopilotConstants.QUOTE_ID_PARAM + '=', page)
            .replace(startUrl + '?' + SalesCopilotConstants.REQUEST_ID_PARAM + '=', page);
    }

    /** Drops anything a chat client may glue to the end of a link (a backslash line break, punctuation). */
    private static String clean(String value) {
        return value == null ? null : value.replaceAll('[^A-Za-z0-9_-]+$', '');
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
