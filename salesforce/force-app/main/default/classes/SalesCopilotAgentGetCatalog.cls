/** Agentforce action: the same catalog as GET /salescopilot/catalog. */
public with sharing class SalesCopilotAgentGetCatalog {

    public class Request {
        @InvocableVariable(label='Audience' description='Business or Consumer; empty for the whole catalog')
        public String audience;
    }

    @InvocableMethod(
        label='Sales Copilot: Get Catalog'
        description='Lists what can be sold to a segment: products, list price, billing, volume tiers, bundle components and the discount limit without approval.'
    )
    public static List<SalesCopilotAgentSupport.Result> getCatalog(List<Request> requests) {
        final List<SalesCopilotAgentSupport.Result> results = new List<SalesCopilotAgentSupport.Result>();
        for (Request request : requests) {
            final SalesCopilotCatalogService.CatalogResponse response =
                SalesCopilotCatalogService.getCatalog(request.audience);
            results.add(SalesCopilotAgentSupport.result(response.status, response));
        }
        return results;
    }
}
