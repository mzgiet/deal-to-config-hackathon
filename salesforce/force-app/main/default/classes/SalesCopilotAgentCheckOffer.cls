/** Agentforce action: the same dry run as POST /salescopilot/check. Builds nothing. */
public with sharing class SalesCopilotAgentCheckOffer {

    public class Request {
        @InvocableVariable(label='Request JSON' description='The build request JSON (the same body as Build Offer)' required=true)
        public String requestJson;
    }

    @InvocableMethod(
        label='Sales Copilot: Check Offer'
        description='Checks a build request against the catalog without creating anything: exists, similar or new, plus any rule the build would reject.'
    )
    public static List<SalesCopilotAgentSupport.Result> check(List<Request> requests) {
        final List<SalesCopilotAgentSupport.Result> results = new List<SalesCopilotAgentSupport.Result>();
        for (Request request : requests) {
            final SalesCopilotCatalogService.CheckResponse response =
                SalesCopilotCatalogService.check(SalesCopilotAgentSupport.withAgentDefaults(request.requestJson));
            results.add(SalesCopilotAgentSupport.result(response.status, response));
        }
        return results;
    }
}
