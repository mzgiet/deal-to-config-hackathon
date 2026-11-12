// A fresh, fictitious customer reserved for the live demo of the Agentforce agent, so the agent has no earlier test
// quotes to warn about. Safe to run again: an existing account or asset is skipped.
// Run: sf apex run -f scripts/apex/salescopilot-seed-demo-customer.apex -o syn-scratch
// Do not use "Baltic Freight" in tests; see skills/sales-copilot-agent-testing/SKILL.md.

final String accountName = 'Baltic Freight';
List<Account> accounts = [SELECT Id FROM Account WHERE Name = :accountName LIMIT 1];
if (accounts.isEmpty()) {
    accounts.add(new Account(
        Name = accountName,
        Customer_Segment__c = 'Business',
        Industry = 'Transportation',
        NumberOfEmployees = 150,
        Description = 'Fictitious demo customer. Freight forwarder with 150 staff, analytics contract up for renewal.'
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
        Quantity = 60,
        Price = 40,
        Status = 'Installed',
        InstallDate = Date.newInstance(2025, 1, 15),
        UsageEndDate = Date.newInstance(2027, 1, 15)
    );
}
System.debug('Demo customer ready: ' + accountId);
