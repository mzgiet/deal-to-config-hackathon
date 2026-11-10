@RestResource(urlMapping='/salescopilot/check')
global with sharing class SalesCopilotCheckResource {

    @HttpPost
    global static void check() {
        final SalesCopilotCatalogService.CheckResponse result = SalesCopilotCatalogService.check(
            RestContext.request.requestBody?.toString()
        );
        RestContext.response.statusCode = result.statusCode;
        RestContext.response.addHeader('Content-Type', 'application/json');
        RestContext.response.responseBody = Blob.valueOf(JSON.serialize(result, true));
    }
}
