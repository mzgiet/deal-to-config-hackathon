#!/bin/zsh
# Read-only snapshot of what the Sales Copilot agent will see in the org: catalog, customers, quotes, recent builds.
# Usage (from salesforce/): skills/sales-copilot-agent-testing/scripts/org-snapshot.sh [org-alias]   (default syn-scratch)
ORG=${1:-syn-scratch}
q() { sf data query -o "$ORG" -q "$1" 2>/dev/null | grep -v -E "Querying|Warning" ; }
echo "## Catalog (active products)"
q "SELECT Name, Audience__c, Type, SalesCopilot_Request__r.Channel__c, CreatedDate FROM Product2 WHERE IsActive = true ORDER BY Audience__c, Name"
echo "## Customers"
q "SELECT Name, Customer_Segment__c, NumberOfEmployees, Industry FROM Account WHERE Customer_Segment__c != null ORDER BY Name"
echo "## Open quotes per customer (duplicates make the agent warn)"
q "SELECT Account.Name, COUNT(Id) quotes FROM Quote WHERE Account.Name != null GROUP BY Account.Name ORDER BY Account.Name"
echo "## Latest builds (Request Id, channel)"
q "SELECT Request_Id__c, Channel__c, CreatedDate FROM SalesCopilot_Request__c ORDER BY CreatedDate DESC LIMIT 10"
echo "## Active agent version"
q "SELECT VersionNumber, Status FROM BotVersion WHERE BotDefinition.DeveloperName = 'Sales_Copilot' AND Status = 'Active'"
