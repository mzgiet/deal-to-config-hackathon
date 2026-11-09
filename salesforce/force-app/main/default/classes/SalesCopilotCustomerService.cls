public with sharing class SalesCopilotCustomerService {

    private static final Integer MAX_CUSTOMERS = 5;

    public class CustomerResponse {
        public String status;
        public String error;
        public List<Customer> customers = new List<Customer>();
        public transient Integer statusCode;
    }

    public class Customer {
        public String accountId;
        public String name;
        public String segment;
        public String industry;
        public Integer employees;
        public String notes;
        public List<Service> services = new List<Service>();
        public List<OpenQuote> openQuotes = new List<OpenQuote>();
    }

    public class Service {
        public String product;
        public String productId;
        public Decimal quantity;
        public Decimal unitPrice;
        public String status;
        public Date since;
        public Date contractEnd;
        public Integer daysToContractEnd;
    }

    public class OpenQuote {
        public String quoteId;
        public String name;
        public String status;
        public Decimal grandTotal;
        public Datetime createdDate;
    }

    public static CustomerResponse findCustomers(String name) {
        final CustomerResponse response = new CustomerResponse();
        if (String.isBlank(name) || name.trim().length() < 2) {
            response.status = SalesCopilotConstants.STATUS_FAILED;
            response.error = 'Pass ?name= with at least 2 characters of the customer name';
            response.statusCode = SalesCopilotConstants.HTTP_BAD_REQUEST;
            return response;
        }

        final Map<Id, Customer> customersById = new Map<Id, Customer>();
        for (Account account : SalesCopilotSelector.getAccountsByName(name.trim(), MAX_CUSTOMERS)) {
            final Customer customer = new Customer();
            customer.accountId = account.Id;
            customer.name = account.Name;
            customer.segment = account.Customer_Segment__c;
            customer.industry = account.Industry;
            customer.employees = account.NumberOfEmployees;
            customer.notes = account.Description;
            customersById.put(account.Id, customer);
        }

        for (Asset asset : SalesCopilotSelector.getAssetsByAccountIds(customersById.keySet())) {
            final Service service = new Service();
            service.product = asset.Product2?.Name ?? asset.Name;
            service.productId = asset.Product2Id;
            service.quantity = asset.Quantity;
            service.unitPrice = asset.Price;
            service.status = asset.Status;
            service.since = asset.InstallDate;
            service.contractEnd = asset.UsageEndDate;
            service.daysToContractEnd = asset.UsageEndDate == null ? null : Date.today().daysBetween(asset.UsageEndDate);
            customersById.get(asset.AccountId).services.add(service);
        }

        for (Quote quote : SalesCopilotSelector.getOpenQuotesByAccountIds(
            customersById.keySet(),
            SalesCopilotConstants.CLOSED_QUOTE_STATUSES
        )) {
            final OpenQuote openQuote = new OpenQuote();
            openQuote.quoteId = quote.Id;
            openQuote.name = quote.Name;
            openQuote.status = quote.Status;
            openQuote.grandTotal = quote.GrandTotal;
            openQuote.createdDate = quote.CreatedDate;
            customersById.get(quote.AccountId).openQuotes.add(openQuote);
        }

        response.status = SalesCopilotConstants.STATUS_FOUND;
        response.customers = customersById.values();
        response.statusCode = SalesCopilotConstants.HTTP_OK;
        return response;
    }
}
