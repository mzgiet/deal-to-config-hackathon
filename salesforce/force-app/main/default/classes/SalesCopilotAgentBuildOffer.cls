/**
 * Agentforce action: the same build as POST /salescopilot/build, followed by a pricing refresh in the background
 * (the Slack orchestrator calls the sync endpoint after a build; an agent has no separate step for it).
 */
public with sharing class SalesCopilotAgentBuildOffer {

    public class Request {
        @InvocableVariable(label='Request JSON' description='The build request JSON (contract v2). requestId may be omitted; one is generated.' required=true)
        public String requestJson;
    }

    @InvocableMethod(
        label='Sales Copilot: Build Offer'
        description='Creates the products, prices, volume tiers or bundle in Revenue Cloud from an approved request and returns the configurator link.'
    )
    public static List<SalesCopilotAgentSupport.Result> build(List<Request> requests) {
        final List<SalesCopilotAgentSupport.Result> results = new List<SalesCopilotAgentSupport.Result>();
        Boolean created = false;
        for (Request request : requests) {
            final SalesCopilotBuildResponse response =
                SalesCopilotBuildService.build(SalesCopilotAgentSupport.withAgentDefaults(request.requestJson));
            created = created || response.status == SalesCopilotConstants.STATUS_CREATED;
            results.add(SalesCopilotAgentSupport.result(response.status, response));
        }
        if (created) {
            SalesCopilotPricingRefresh.start();
        }
        return results;
    }
}
