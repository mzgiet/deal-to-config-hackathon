@RestResource(urlMapping='/salescopilot/build')
global with sharing class SalesCopilotBuildResource {

    @HttpPost
    global static void build() {
        final SalesCopilotBuildResponse result = SalesCopilotBuildService.build(
            RestContext.request.requestBody?.toString()
        );
        RestContext.response.statusCode = result.statusCode;
        RestContext.response.addHeader('Content-Type', 'application/json');
        RestContext.response.responseBody = Blob.valueOf(JSON.serialize(result, true));
    }
}
