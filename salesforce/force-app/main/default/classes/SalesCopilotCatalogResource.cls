@RestResource(urlMapping='/salescopilot/catalog')
global with sharing class SalesCopilotCatalogResource {

    @HttpGet
    global static void getCatalog() {
        final SalesCopilotCatalogService.CatalogResponse result = SalesCopilotCatalogService.getCatalog(
            RestContext.request.params.get('audience')
        );
        RestContext.response.statusCode = result.statusCode;
        RestContext.response.addHeader('Content-Type', 'application/json');
        RestContext.response.responseBody = Blob.valueOf(JSON.serialize(result, true));
    }
}
