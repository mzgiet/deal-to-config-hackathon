/** Agentforce action: the same lookup as GET /salescopilot/customer. */
public with sharing class SalesCopilotAgentFindCustomer {

    public class Request {
        @InvocableVariable(label='Customer name' description='At least 2 characters of the account name' required=true)
        public String name;
    }

    @InvocableMethod(
        label='Sales Copilot: Find Customer'
        description='Finds up to 5 customer accounts by name, with segment, current services (contract end dates) and open quotes.'
    )
    public static List<SalesCopilotAgentSupport.Result> findCustomer(List<Request> requests) {
        final List<SalesCopilotAgentSupport.Result> results = new List<SalesCopilotAgentSupport.Result>();
        for (Request request : requests) {
            final SalesCopilotCustomerService.CustomerResponse response =
                SalesCopilotCustomerService.findCustomers(request.name);
            results.add(SalesCopilotAgentSupport.result(response.status, response));
        }
        return results;
    }
}
