public with sharing class SalesCopilotQuoteResponse {

    public String requestId;
    public String status;
    public String quoteId;
    public String quoteUrl;
    public String quoteStatus;
    public Decimal grandTotal;
    public String accountId;
    public String opportunityId;
    public String pageUrl;
    public Boolean approvalRequired;
    public List<String> approvalReasons;
    public String error;
    public transient Integer statusCode;

    public static SalesCopilotQuoteResponse created(
        String requestId,
        Quote quote,
        Id accountId,
        Id opportunityId,
        List<String> approvalReasons
    ) {
        final SalesCopilotQuoteResponse response = new SalesCopilotQuoteResponse();
        response.requestId = requestId;
        response.status = SalesCopilotConstants.STATUS_CREATED;
        response.quoteId = quote.Id;
        response.quoteUrl = URL.getOrgDomainUrl().toExternalForm() + '/lightning/r/Quote/' + quote.Id + '/view';
        response.quoteStatus = quote.Status;
        response.grandTotal = quote.GrandTotal;
        response.accountId = accountId;
        response.opportunityId = opportunityId;
        response.approvalRequired = !approvalReasons.isEmpty();
        response.approvalReasons = approvalReasons.isEmpty() ? null : approvalReasons;
        response.statusCode = SalesCopilotConstants.HTTP_OK;
        return response;
    }

    public SalesCopilotQuoteResponse withPageUrl(String pageUrl) {
        this.pageUrl = pageUrl;
        return this;
    }

    public static SalesCopilotQuoteResponse failed(String requestId, Integer statusCode, String error) {
        final SalesCopilotQuoteResponse response = new SalesCopilotQuoteResponse();
        response.requestId = requestId;
        response.status = SalesCopilotConstants.STATUS_FAILED;
        response.error = error;
        response.statusCode = statusCode;
        return response;
    }
}
