// Puts the live-demo data back to its starting state after a rehearsal: deletes the demo customer's quotes and
// opportunities, and everything the agent built for the demo product. The customer and its services stay.
// Run: sf apex run -f scripts/apex/salescopilot-reset-demo.apex -o <alias of the PoC org>
// The names must match the "Demo data" table in demo/agentforce-demo.md. It DELETES records: run it on purpose.

final String CUSTOMER_NAME = 'Baltic Freight';
final String PRODUCT_NAME = 'Fleet Tracking licence';
final String VOLUME_SCHEDULE_NAME = 'Standard Price Adjustment Tier';

// 1. The customer's quotes (their lines go with them) and the opportunities the quote endpoint created.
final List<Quote> quotes = [SELECT Id FROM Quote WHERE Account.Name = :CUSTOMER_NAME];
final List<Opportunity> opportunities = [SELECT Id FROM Opportunity WHERE Account.Name = :CUSTOMER_NAME];
delete quotes;
delete opportunities;

// 2. Everything built for the demo product: the same steps as salescopilot-reset-request.apex.
final Set<String> requestIds = new Set<String>();
for (Product2 product : [
    SELECT SalesCopilot_Request__r.Request_Id__c FROM Product2
    WHERE Name = :PRODUCT_NAME AND SalesCopilot_Request__c != null
]) {
    requestIds.add(product.SalesCopilot_Request__r.Request_Id__c);
}
final Set<Id> productIds = new Map<Id, Product2>(
    [SELECT Id FROM Product2 WHERE SalesCopilot_Request__r.Request_Id__c IN :requestIds]
).keySet();
// Leftover lines on other customers' quotes would block the product delete.
delete [SELECT Id FROM QuoteLineItem WHERE Product2Id IN :productIds];

if (!productIds.isEmpty()) {
    // Tiers cannot change while the schedule is active, and an empty schedule cannot be reactivated.
    final PriceAdjustmentSchedule schedule = [
        SELECT Id, IsActive FROM PriceAdjustmentSchedule WHERE Name = :VOLUME_SCHEDULE_NAME LIMIT 1
    ];
    final Boolean wasActive = schedule.IsActive;
    if (wasActive) {
        update new PriceAdjustmentSchedule(Id = schedule.Id, IsActive = false);
    }
    delete [SELECT Id FROM PriceAdjustmentTier WHERE Product2Id IN :productIds];
    final Boolean hasTiersLeft = [SELECT COUNT() FROM PriceAdjustmentTier WHERE PriceAdjustmentScheduleId = :schedule.Id] > 0;
    if (wasActive && hasTiersLeft) {
        update new PriceAdjustmentSchedule(Id = schedule.Id, IsActive = true);
    }
    delete [SELECT Id FROM ProductRelatedComponent WHERE ParentProductId IN :productIds];
    delete [SELECT Id FROM ProductComponentGroup WHERE ParentProductId IN :productIds];
    delete [SELECT Id FROM ProductCategoryProduct WHERE ProductId IN :productIds];
    delete [SELECT Id FROM PricebookEntry WHERE Product2Id IN :productIds];
    delete [SELECT Id FROM ProductSellingModelOption WHERE Product2Id IN :productIds];
    delete [SELECT Id FROM Product2 WHERE Id IN :productIds];
}
delete [SELECT Id FROM SalesCopilot_Request__c WHERE Request_Id__c IN :requestIds];

// 3. Let the pricing decision tables forget the removed prices and tiers (runs in the background).
SalesCopilotPricingRefresh.start();

System.debug('Demo reset: ' + quotes.size() + ' quotes, ' + opportunities.size() + ' opportunities, '
    + productIds.size() + ' products (' + String.join(new List<String>(requestIds), ', ') + ')');
