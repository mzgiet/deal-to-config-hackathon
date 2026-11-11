/** Agentforce action: the same quote as POST /salescopilot/quote. */
public with sharing class SalesCopilotAgentCreateQuote {

    public class Request {
        @InvocableVariable(label='Quote JSON' description='{ "account": "<accountId>", "lines": [...], "presentation": {...} }' required=true)
        public String quoteJson;
    }

    @InvocableMethod(
        label='Sales Copilot: Create Quote'
        description='Creates a priced Revenue Cloud quote for a customer from approved lines and returns the quote link, customer page, total and approval status.'
    )
    public static List<SalesCopilotAgentSupport.Result> createQuote(List<Request> requests) {
        final List<SalesCopilotAgentSupport.Result> results = new List<SalesCopilotAgentSupport.Result>();
        for (Request request : requests) {
            final SalesCopilotQuoteResponse response = SalesCopilotQuoteService.createQuote(request.quoteJson);
            results.add(SalesCopilotAgentSupport.result(response.status, response));
        }
        return results;
    }
}
