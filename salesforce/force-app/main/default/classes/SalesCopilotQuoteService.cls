public with sharing class SalesCopilotQuoteService {

    private static final String QUOTE_REF = 'refQuote';

    public class InvalidQuoteRequestException extends Exception {
    }

    private class Line {
        public Product2 product;
        public Integer quantity;
        public Decimal discountPct;
        public Set<String> addOns;
    }

    // Two entry points share one graph: a customer quote ({account, lines}) from a sales rep, and the
    // configurator page's preview quote ({requestId, addOns}) for one Sales Copilot request.
    public static SalesCopilotQuoteResponse createQuote(String body) {
        String requestId;
        try {
            final Map<String, Object> input = parse(body);
            requestId = (String) input.get('requestId');

            final Account account = input.get('account') == null ? null : resolveAccount(String.valueOf(input.get('account')));
            final List<Line> lines;
            SalesCopilotRequestWrapper.Presentation presentation;
            if (input.containsKey('lines')) {
                if (account == null) {
                    throw new InvalidQuoteRequestException('account is required with lines');
                }
                lines = toLines(input.get('lines'));
                presentation = toPresentation(input.get('presentation'));
            } else if (String.isNotBlank(requestId)) {
                if (SalesCopilotSelector.getRequestByRequestId(requestId) == null) {
                    return SalesCopilotQuoteResponse.failed(
                        requestId,
                        SalesCopilotConstants.HTTP_NOT_FOUND,
                        'No configuration exists for request ' + requestId
                    );
                }
                lines = linesForRequest(requestId, toQuantity(input.get('quantity')), toAddOns(input.get('addOns')));
            } else {
                throw new InvalidQuoteRequestException('Send either requestId, or account with lines');
            }
            if (account != null) {
                checkSegment(account, lines);
            }
            return place(requestId, account, lines, presentation);
        } catch (InvalidQuoteRequestException e) {
            return SalesCopilotQuoteResponse.failed(requestId, SalesCopilotConstants.HTTP_BAD_REQUEST, e.getMessage());
        } catch (Exception e) {
            return SalesCopilotQuoteResponse.failed(
                requestId,
                SalesCopilotConstants.HTTP_SERVER_ERROR,
                'The quote could not be created: ' + e.getMessage()
            );
        }
    }

    private static SalesCopilotQuoteResponse place(
        String requestId,
        Account account,
        List<Line> lines,
        SalesCopilotRequestWrapper.Presentation presentation
    ) {
        final List<String> approvalReasons = getApprovalReasons(lines);
        final Savepoint savepoint = Database.setSavepoint();

        Opportunity opportunity;
        if (account != null) {
            opportunity = new Opportunity(
                Name = (account.Name + ' — ' + lines[0].product.Name).left(120),
                AccountId = account.Id,
                StageName = SalesCopilotConstants.OPPORTUNITY_STAGE,
                CloseDate = Date.today().addDays(SalesCopilotConstants.OPPORTUNITY_CLOSE_DAYS)
            );
            insert opportunity;
        }

        final Map<String, Object> quoteFields = new Map<String, Object>{
            'Name' => ((account == null ? lines[0].product.Name + ' — ' + requestId : opportunity.Name)).left(80),
            'Pricebook2Id' => SalesCopilotSelector.getStandardPricebookId(),
            'Status' => approvalReasons.isEmpty()
                ? SalesCopilotConstants.QUOTE_STATUS_DRAFT
                : SalesCopilotConstants.QUOTE_STATUS_NEEDS_REVIEW
        };
        if (opportunity != null) {
            quoteFields.put('OpportunityId', opportunity.Id);
        }

        final RevSalesTrxn.PlaceSalesTransactionResponse response = RevSalesTrxn.PlaceSalesTransactionExecutor.execute(
            new RevSalesTrxn.GraphRequest(String.isBlank(requestId) ? 'salesCopilotQuote' : requestId, buildGraph(quoteFields, lines)),
            RevSalesTrxn.PricingPreferenceEnum.SYSTEM,
            RevSalesTrxn.ConfigurationExecutionEnum.SYSTEM,
            new RevSalesTrxn.ConfigurationOptionsInput(),
            null
        );
        if (response.isSuccess != true || String.isBlank(response.salesTransactionId)) {
            Database.rollback(savepoint);
            return SalesCopilotQuoteResponse.failed(
                requestId,
                SalesCopilotConstants.HTTP_SERVER_ERROR,
                'Revenue Cloud rejected the quote: ' + String.valueOf(response.errorResponse)
            );
        }
        // The pricing graph only takes fields the pricing procedure knows, so the page is stored afterwards.
        String pageUrl;
        if (presentation != null) {
            try {
                update new Quote(Id = response.salesTransactionId, Presentation__c = JSON.serialize(presentation, true));
            } catch (DmlException e) {
                Database.rollback(savepoint);
                return SalesCopilotQuoteResponse.failed(
                    requestId,
                    SalesCopilotConstants.HTTP_SERVER_ERROR,
                    'The quote page could not be saved: ' + e.getDmlMessage(0)
                );
            }
            pageUrl = buildPageUrl(response.salesTransactionId);
        }
        return SalesCopilotQuoteResponse.created(
            requestId,
            SalesCopilotSelector.getQuoteById(response.salesTransactionId),
            account?.Id,
            opportunity?.Id,
            approvalReasons
        ).withPageUrl(pageUrl);
    }

    private static String buildPageUrl(Id quoteId) {
        final String startUrl = SalesCopilotSelector.getAppStartUrl(SalesCopilotConstants.APP_NAME);
        if (String.isBlank(startUrl)) {
            return null;
        }
        return startUrl + (startUrl.contains('?') ? '&' : '?') + SalesCopilotConstants.QUOTE_ID_PARAM + '=' + quoteId;
    }

    private static SalesCopilotRequestWrapper.Presentation toPresentation(Object value) {
        SalesCopilotRequestWrapper.Presentation presentation;
        try {
            presentation = SalesCopilotRequestWrapper.parsePresentation(value);
        } catch (SalesCopilotRequestWrapper.InvalidRequestException e) {
            throw new InvalidQuoteRequestException(e.getMessage());
        }
        if (presentation == null) {
            return null;
        }
        final List<String> errors = new List<String>();
        presentation.validate(SalesCopilotConstants.QUOTE_SECTION_TYPES, errors);
        if (!errors.isEmpty()) {
            throw new InvalidQuoteRequestException(String.join(errors, '; '));
        }
        return presentation;
    }

    // ─── Lines ───────────────────────────────────────────────────────────────

    private static List<Line> toLines(Object value) {
        if (!(value instanceof List<Object>) || ((List<Object>) value).isEmpty()) {
            throw new InvalidQuoteRequestException('lines must be a non-empty list');
        }
        final List<Map<String, Object>> inputs = new List<Map<String, Object>>();
        final Set<String> keys = new Set<String>();
        for (Object item : (List<Object>) value) {
            if (!(item instanceof Map<String, Object>)) {
                throw new InvalidQuoteRequestException('Each line must be a JSON object');
            }
            final Map<String, Object> input = (Map<String, Object>) item;
            if (String.isBlank((String) input.get('product'))) {
                throw new InvalidQuoteRequestException('Each line needs a product name or code');
            }
            inputs.add(input);
            keys.add(((String) input.get('product')).trim());
        }

        final Map<String, Product2> productsByKey = new Map<String, Product2>();
        for (Product2 product : SalesCopilotSelector.getSellableProductsByKeys(keys)) {
            for (String key : new List<String>{ product.Name.toLowerCase(), product.ProductCode.toLowerCase() }) {
                if (!productsByKey.containsKey(key)) {
                    productsByKey.put(key, product);
                }
            }
        }

        final List<Line> lines = new List<Line>();
        for (Map<String, Object> input : inputs) {
            final String key = ((String) input.get('product')).trim();
            final Product2 product = productsByKey.get(key.toLowerCase());
            if (product == null) {
                throw new InvalidQuoteRequestException('"' + key + '" is not an active product in the catalog');
            }
            final Line line = new Line();
            line.product = product;
            line.quantity = toQuantity(input.get('quantity'));
            line.discountPct = toDiscount(input.get('discountPct'), product.Name);
            line.addOns = toAddOns(input.get('addOns'));
            if (!line.addOns.isEmpty() && product.Type != SalesCopilotConstants.PRODUCT_TYPE_BUNDLE) {
                throw new InvalidQuoteRequestException('addOns apply to bundles only; ' + product.Name + ' is not a bundle');
            }
            lines.add(line);
        }
        return lines;
    }

    private static List<Line> linesForRequest(String requestId, Integer quantity, Set<String> addOns) {
        final List<Product2> products = SalesCopilotSelector.getProductsByRequestId(requestId);
        Product2 bundle;
        for (Product2 product : products) {
            if (product.Type == SalesCopilotConstants.PRODUCT_TYPE_BUNDLE) {
                bundle = product;
            }
        }
        if (bundle == null && !addOns.isEmpty()) {
            throw new InvalidQuoteRequestException('addOns apply to bundles only; request ' + requestId + ' has no bundle');
        }

        final List<Line> lines = new List<Line>();
        for (Product2 product : bundle == null ? products : new List<Product2>{ bundle }) {
            final Line line = new Line();
            line.product = product;
            line.quantity = quantity;
            line.addOns = addOns;
            lines.add(line);
        }
        return lines;
    }

    private static void checkSegment(Account account, List<Line> lines) {
        if (String.isBlank(account.Customer_Segment__c)) {
            return;
        }
        for (Line line : lines) {
            final String audience = line.product.Audience__c;
            if (String.isNotBlank(audience) && audience != SalesCopilotConstants.AUDIENCE_BOTH && audience != account.Customer_Segment__c) {
                throw new InvalidQuoteRequestException(
                    line.product.Name + ' is sold to ' + audience + ' customers only; ' + account.Name + ' is a ' +
                    account.Customer_Segment__c + ' customer'
                );
            }
        }
    }

    private static List<String> getApprovalReasons(List<Line> lines) {
        final List<String> reasons = new List<String>();
        for (Line line : lines) {
            if (line.discountPct != null && line.discountPct > SalesCopilotConstants.MAX_DISCOUNT_WITHOUT_APPROVAL) {
                reasons.add(
                    line.product.Name + ': ' + line.discountPct + '% discount is above the ' +
                    SalesCopilotConstants.MAX_DISCOUNT_WITHOUT_APPROVAL + '% a sales rep can give without approval'
                );
            }
        }
        return reasons;
    }

    // ─── Graph ───────────────────────────────────────────────────────────────

    // Place Sales Transaction does not enforce component group minimums, so required components are
    // always added here, and only optional components are accepted as add-ons.
    private static List<RevSalesTrxn.RecordWithReferenceRequest> buildGraph(Map<String, Object> quoteFields, List<Line> lines) {
        final Set<Id> productIds = new Set<Id>();
        final Set<Id> bundleIds = new Set<Id>();
        for (Line line : lines) {
            productIds.add(line.product.Id);
            if (line.product.Type == SalesCopilotConstants.PRODUCT_TYPE_BUNDLE) {
                bundleIds.add(line.product.Id);
            }
        }
        final Map<Id, List<ProductRelatedComponent>> componentsByBundleId = new Map<Id, List<ProductRelatedComponent>>();
        for (ProductRelatedComponent component : SalesCopilotSelector.getComponentsByParentIds(bundleIds)) {
            if (!componentsByBundleId.containsKey(component.ParentProductId)) {
                componentsByBundleId.put(component.ParentProductId, new List<ProductRelatedComponent>());
            }
            componentsByBundleId.get(component.ParentProductId).add(component);
            productIds.add(component.ChildProductId);
        }
        final Map<Id, Product2> childrenById = new Map<Id, Product2>(
            SalesCopilotSelector.getProductsByIds(productIds)
        );
        final Map<Id, PricebookEntry> entryByProductId = getEntries(productIds);

        final List<RevSalesTrxn.RecordWithReferenceRequest> records = new List<RevSalesTrxn.RecordWithReferenceRequest>{
            record(QUOTE_REF, Quote.SObjectType, quoteFields)
        };
        for (Line line : lines) {
            final String lineRef = 'refLine' + records.size();
            records.add(lineItem(lineRef, line.product, entryByProductId, line.quantity, line.discountPct));
            if (!bundleIds.contains(line.product.Id)) {
                continue;
            }

            final Set<String> unmatched = new Set<String>(line.addOns);
            for (ProductRelatedComponent component : componentsByBundleId.get(line.product.Id) ?? new List<ProductRelatedComponent>()) {
                final Product2 child = childrenById.get(component.ChildProductId);
                final Boolean isAddOn = line.addOns.contains(child.Name.toLowerCase()) ||
                    line.addOns.contains(String.valueOf(child.Id).toLowerCase());
                if (!component.IsComponentRequired && !isAddOn) {
                    continue;
                }
                unmatched.remove(child.Name.toLowerCase());
                unmatched.remove(String.valueOf(child.Id).toLowerCase());

                final String childRef = 'refLine' + records.size();
                final Decimal perBundle = component.Quantity == null ? 1 : component.Quantity;
                records.add(lineItem(childRef, child, entryByProductId, (perBundle * line.quantity).intValue(), line.discountPct));
                records.add(record('refRel' + records.size(), QuoteLineRelationship.SObjectType, new Map<String, Object>{
                    'MainQuoteLineId' => '@{' + lineRef + '.id}',
                    'AssociatedQuoteLineId' => '@{' + childRef + '.id}',
                    'ProductRelatedComponentId' => component.Id,
                    'ProductRelationshipTypeId' => component.ProductRelationshipTypeId,
                    'AssociatedQuoteLinePricing' => 'NotIncludedInBundlePrice',
                    'AssociatedQuantScaleMethod' => 'Proportional'
                }));
            }
            if (!unmatched.isEmpty()) {
                throw new InvalidQuoteRequestException(
                    'Not an optional component of ' + line.product.Name + ': ' + String.join(new List<String>(unmatched), ', ')
                );
            }
        }
        return records;
    }

    private static RevSalesTrxn.RecordWithReferenceRequest lineItem(
        String referenceId,
        Product2 product,
        Map<Id, PricebookEntry> entryByProductId,
        Integer quantity,
        Decimal discountPct
    ) {
        final PricebookEntry entry = entryByProductId.get(product.Id);
        if (entry == null) {
            throw new InvalidQuoteRequestException(product.Name + ' has no active price in the Standard Price Book');
        }
        final Map<String, Object> fields = new Map<String, Object>{
            'QuoteId' => '@{' + QUOTE_REF + '.id}',
            'Product2Id' => product.Id,
            'PricebookEntryId' => entry.Id,
            'Quantity' => quantity,
            'StartDate' => String.valueOf(Date.today())
        };
        if (discountPct != null && discountPct > 0) {
            // Pricing procedures reject Percent fields, so QuoteLineItem.Discount never reaches Manual Discount.
            fields.put('Line_Discount_Pct__c', discountPct);
        }
        return record(referenceId, QuoteLineItem.SObjectType, fields);
    }

    private static RevSalesTrxn.RecordWithReferenceRequest record(
        String referenceId,
        SObjectType objectType,
        Map<String, Object> fieldValues
    ) {
        final RevSalesTrxn.RecordResource resource = new RevSalesTrxn.RecordResource(objectType, 'POST');
        resource.fieldValues = fieldValues;
        return new RevSalesTrxn.RecordWithReferenceRequest(referenceId, resource);
    }

    private static Map<Id, PricebookEntry> getEntries(Set<Id> productIds) {
        final Id pricebookId = SalesCopilotSelector.getStandardPricebookId();
        final Map<Id, PricebookEntry> entryByProductId = new Map<Id, PricebookEntry>();
        for (PricebookEntry entry : SalesCopilotSelector.getPricebookEntriesByProductIds(productIds)) {
            if (entry.IsActive && entry.Pricebook2Id == pricebookId) {
                entryByProductId.put(entry.Product2Id, entry);
            }
        }
        return entryByProductId;
    }

    // ─── Input ───────────────────────────────────────────────────────────────

    private static Map<String, Object> parse(String body) {
        try {
            final Object value = String.isBlank(body) ? null : JSON.deserializeUntyped(body);
            if (!(value instanceof Map<String, Object>)) {
                throw new InvalidQuoteRequestException('The request must be a JSON object');
            }
            return (Map<String, Object>) value;
        } catch (JSONException e) {
            throw new InvalidQuoteRequestException('The request is not valid JSON');
        }
    }

    private static Account resolveAccount(String idOrName) {
        final List<Account> accounts = SalesCopilotSelector.getAccountsByIdOrName(idOrName.trim());
        if (accounts.isEmpty()) {
            throw new InvalidQuoteRequestException('No customer named or with id "' + idOrName + '"');
        }
        if (accounts.size() > 1) {
            throw new InvalidQuoteRequestException('More than one customer matches "' + idOrName + '"; send the accountId');
        }
        return accounts[0];
    }

    private static Integer toQuantity(Object value) {
        if (value == null) {
            return 1;
        }
        final Decimal quantity = toDecimal(value);
        if (quantity == null || quantity < 1 || quantity != quantity.round(System.RoundingMode.DOWN)) {
            throw new InvalidQuoteRequestException('quantity must be a whole number of 1 or more, got ' + value);
        }
        return quantity.intValue();
    }

    private static Decimal toDiscount(Object value, String productName) {
        if (value == null) {
            return null;
        }
        final Decimal discount = toDecimal(value);
        if (discount == null || discount < 0 || discount >= 100) {
            throw new InvalidQuoteRequestException(productName + ': discountPct must be between 0 and 100, got ' + value);
        }
        return discount;
    }

    private static Decimal toDecimal(Object value) {
        try {
            return Decimal.valueOf(String.valueOf(value));
        } catch (TypeException e) {
            return null;
        }
    }

    private static Set<String> toAddOns(Object value) {
        final Set<String> addOns = new Set<String>();
        if (value == null) {
            return addOns;
        }
        if (!(value instanceof List<Object>)) {
            throw new InvalidQuoteRequestException('addOns must be a list of product names');
        }
        for (Object item : (List<Object>) value) {
            addOns.add(String.valueOf(item).trim().toLowerCase());
        }
        return addOns;
    }
}
