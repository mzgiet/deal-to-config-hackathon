// A fresh, fictitious customer reserved for the live demo of the Agentforce agent, so the agent has no earlier test
// quotes to warn about. Safe to run again: an existing account or asset is skipped.
// Run: sf apex run -f scripts/apex/salescopilot-seed-demo-customer.apex -o <alias of the PoC org>
// To use another demo customer, change the values below and the "Demo data" table in demo/agentforce-demo.md.

final String CUSTOMER_NAME = 'Baltic Freight';
final Integer EMPLOYEES = 150;
final String INDUSTRY = 'Transportation';
final Integer ANALYTICS_SEATS = 60;                          // existing Cloud Analytics licences
final Date CONTRACT_END = Date.newInstance(2027, 1, 15);    // a renewal within ~90 days makes a good highlight

List<Account> accounts = [SELECT Id FROM Account WHERE Name = :CUSTOMER_NAME LIMIT 1];
if (accounts.isEmpty()) {
    accounts.add(new Account(
        Name = CUSTOMER_NAME,
        Customer_Segment__c = 'Business',
        Industry = INDUSTRY,
        NumberOfEmployees = EMPLOYEES,
        Description = 'Fictitious demo customer for the Sales Copilot Agentforce demo.'
    ));
    insert accounts;
}
final Id accountId = accounts[0].Id;

final List<Product2> analytics = [
    SELECT Id FROM Product2
    WHERE Name = 'Cloud Analytics licence' AND IsActive = TRUE AND Type = NULL
    LIMIT 1
];
if (!analytics.isEmpty() && [SELECT COUNT() FROM Asset WHERE AccountId = :accountId] == 0) {
    insert new Asset(
        Name = 'Cloud Analytics licence',
        AccountId = accountId,
        Product2Id = analytics[0].Id,
        Quantity = ANALYTICS_SEATS,
        Price = 40,
        Status = 'Installed',
        InstallDate = CONTRACT_END.addYears(-2),
        UsageEndDate = CONTRACT_END
    );
}
System.debug('Demo customer ready: ' + CUSTOMER_NAME + ' ' + accountId);
