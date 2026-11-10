public with sharing class SalesCopilotConstants {

    // ─── Response ────────────────────────────────────────────────────────────

    public static final String STATUS_CREATED = 'created';
    public static final String STATUS_FAILED = 'failed';
    public static final String STATUS_FOUND = 'found';
    public static final String STATUS_EXISTS = 'exists';
    public static final Integer HTTP_OK = 200;
    public static final Integer HTTP_BAD_REQUEST = 400;
    public static final Integer HTTP_NOT_FOUND = 404;
    public static final Integer HTTP_CONFLICT = 409;
    public static final Integer HTTP_SERVER_ERROR = 500;

    // ─── Request contract ────────────────────────────────────────────────────

    public static final String PRICING_FLAT = 'flat';
    public static final String PRICING_VOLUME_TIER = 'volume-tier';
    public static final String PRICING_BUNDLE = 'bundle';
    public static final Set<String> PRICING_TYPES = new Set<String>{ PRICING_FLAT, PRICING_VOLUME_TIER, PRICING_BUNDLE };
    public static final String DEFAULT_CHANNEL = 'api';
    public static final String DEFAULT_AVAILABILITY = 'both';
    public static final String SELLING_MODEL_ONE_TIME = 'one-time';
    public static final String SELLING_MODEL_EVERGREEN = 'evergreen';
    public static final String DEFAULT_SELLING_MODEL = SELLING_MODEL_ONE_TIME;

    // ─── Audience ────────────────────────────────────────────────────────────

    public static final String AUDIENCE_BUSINESS = 'Business';
    public static final String AUDIENCE_CONSUMER = 'Consumer';
    public static final String AUDIENCE_BOTH = 'Both';
    public static final Map<String, String> AUDIENCE_BY_AVAILABILITY = new Map<String, String>{
        'b2b' => AUDIENCE_BUSINESS,
        'b2c' => AUDIENCE_CONSUMER,
        'both' => AUDIENCE_BOTH
    };

    // ─── One-time org setup the build relies on ──────────────────────────────

    public static final Map<String, String> SELLING_MODEL_NAME_BY_KEY = new Map<String, String>{
        SELLING_MODEL_ONE_TIME => 'One Time',
        SELLING_MODEL_EVERGREEN => 'Evergreen Monthly'
    };
    public static final String VOLUME_SCHEDULE_NAME = 'Standard Price Adjustment Tier';
    public static final String CATEGORY_CODE = 'SALES_COPILOT_OFFERS';
    public static final String APP_NAME = 'RevenueConfigurator';

    // ─── Records ─────────────────────────────────────────────────────────────

    public static final String TIER_TYPE_PERCENTAGE = 'AdjustmentPercentage';
    public static final String PRODUCT_CODE_PREFIX = 'SC-';
    public static final String BUNDLE_CODE_SUFFIX = '-B';
    public static final String PRODUCT_TYPE_BUNDLE = 'Bundle';
    public static final String CONFIGURE_DURING_SALE_ALLOWED = 'Allowed';
    public static final String GROUP_INCLUDED = 'Included';
    public static final String GROUP_OPTIONAL = 'Optional';
    public static final String REQUEST_ID_PARAM = 'requestId';

    // ─── Selling ─────────────────────────────────────────────────────────────

    public static final Decimal MAX_DISCOUNT_WITHOUT_APPROVAL = 10;
    public static final String QUOTE_STATUS_DRAFT = 'Draft';
    public static final String QUOTE_STATUS_NEEDS_REVIEW = 'Needs Review';
    public static final Set<String> CLOSED_QUOTE_STATUSES = new Set<String>{ 'Accepted', 'Denied', 'Rejected' };
    public static final String OPPORTUNITY_STAGE = 'Proposal/Price Quote';
    public static final Integer OPPORTUNITY_CLOSE_DAYS = 30;
    public static final Integer PAYLOAD_MAX_LENGTH = 131072;
}
