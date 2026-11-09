// Removes everything the Sales Copilot build created for one request, so the same requestId can be built again.
// Run: sf apex run -f scripts/apex/salescopilot-reset-request.apex -o poc-salescopilot
// Set requestId below first. Then run syncData so the pricing decision tables forget the removed tiers.

final String requestId = 'req_mf3k_001';
final String volumeScheduleName = 'Standard Price Adjustment Tier';

final Set<Id> productIds = new Map<Id, Product2>(
    [SELECT Id FROM Product2 WHERE SalesCopilot_Request__r.Request_Id__c = :requestId]
).keySet();

// Tiers cannot change while the schedule is active, and an empty schedule cannot be reactivated.
final PriceAdjustmentSchedule schedule = [
    SELECT Id, IsActive FROM PriceAdjustmentSchedule WHERE Name = :volumeScheduleName LIMIT 1
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
delete [SELECT Id FROM SalesCopilot_Request__c WHERE Request_Id__c = :requestId];

System.debug('Removed request ' + requestId + ' and ' + productIds.size() + ' products');
