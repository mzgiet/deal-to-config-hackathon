@RestResource(urlMapping='/salescopilot/customer')
global with sharing class SalesCopilotCustomerResource {

    @HttpGet
    global static void findCustomers() {
        final SalesCopilotCustomerService.CustomerResponse result = SalesCopilotCustomerService.findCustomers(
            RestContext.request.params.get('name')
        );
        RestContext.response.statusCode = result.statusCode;
        RestContext.response.addHeader('Content-Type', 'application/json');
        RestContext.response.responseBody = Blob.valueOf(JSON.serialize(result, true));
    }
}
