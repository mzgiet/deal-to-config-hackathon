@RestResource(urlMapping='/salescopilot/quote')
global with sharing class SalesCopilotQuoteResource {

    @HttpPost
    global static void createQuote() {
        final SalesCopilotQuoteResponse result = SalesCopilotQuoteService.createQuote(
            RestContext.request.requestBody?.toString()
        );
        RestContext.response.statusCode = result.statusCode;
        RestContext.response.addHeader('Content-Type', 'application/json');
        RestContext.response.responseBody = Blob.valueOf(JSON.serialize(result, true));
    }
}
