// Fictitious customers for the Sales Copilot sales-rep demo. Safe to run again: existing accounts are skipped.
// Run: sf apex run -f scripts/apex/salescopilot-seed-customers.apex -o poc-salescopilot
// Assets are plain records (product, quantity, price, contract end), not the Revenue Cloud asset lifecycle.

final Map<String, Account> accountsByName = new Map<String, Account>{
    'Acme Logistics' => new Account(
        Name = 'Acme Logistics',
        Customer_Segment__c = 'Business',
        Industry = 'Transportation',
        NumberOfEmployees = 120,
        Description = 'Fictitious demo customer. Logistics company renewing analytics licences.'
    ),
    'Nowak Design' => new Account(
        Name = 'Nowak Design',
        Customer_Segment__c = 'Business',
        Industry = 'Media',
        NumberOfEmployees = 8,
        Description = 'Fictitious demo customer. Small design studio, no services yet.'
    ),
    'Anna Testowa' => new Account(
        Name = 'Anna Testowa',
        Customer_Segment__c = 'Consumer',
        Description = 'Fictitious demo customer. Consumer with mobile internet.'
    )
};
for (Account existing : [SELECT Name FROM Account WHERE Name IN :accountsByName.keySet()]) {
    accountsByName.remove(existing.Name);
}
insert accountsByName.values();

final Map<String, Id> accountIdByName = new Map<String, Id>();
for (Account account : [SELECT Id, Name FROM Account WHERE Name IN ('Acme Logistics', 'Anna Testowa')]) {
    accountIdByName.put(account.Name, account.Id);
}
final Map<String, Id> productIdByName = new Map<String, Id>();
for (Product2 product : [
    SELECT Id, Name FROM Product2
    WHERE Name IN ('Cloud Analytics licence', 'Mobile Internet') AND IsActive = TRUE AND Type = NULL
]) {
    productIdByName.put(product.Name, product.Id);
}

final List<Asset> assets = new List<Asset>{
    new Asset(
        Name = 'Cloud Analytics licence',
        AccountId = accountIdByName.get('Acme Logistics'),
        Product2Id = productIdByName.get('Cloud Analytics licence'),
        Quantity = 40,
        Price = 40,
        Status = 'Installed',
        InstallDate = Date.newInstance(2025, 2, 1),
        UsageEndDate = Date.newInstance(2027, 1, 31)
    ),
    new Asset(
        Name = 'Mobile Internet',
        AccountId = accountIdByName.get('Anna Testowa'),
        Product2Id = productIdByName.get('Mobile Internet'),
        Quantity = 1,
        Price = 10,
        Status = 'Installed',
        InstallDate = Date.newInstance(2026, 3, 1)
    )
};
final Set<Id> accountsWithAssets = new Set<Id>();
for (Asset existing : [SELECT AccountId FROM Asset WHERE AccountId IN :accountIdByName.values()]) {
    accountsWithAssets.add(existing.AccountId);
}
final List<Asset> newAssets = new List<Asset>();
for (Asset asset : assets) {
    if (!accountsWithAssets.contains(asset.AccountId)) {
        newAssets.add(asset);
    }
}
insert newAssets;

System.debug('Created ' + accountsByName.size() + ' accounts and ' + newAssets.size() + ' assets');
