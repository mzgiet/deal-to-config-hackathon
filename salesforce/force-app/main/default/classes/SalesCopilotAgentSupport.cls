/**
 * Shared plumbing for the Agentforce actions (SalesCopilotAgent*). The actions are thin wrappers over the same
 * services the REST endpoints call, so the agent gets exactly the endpoint's JSON back and the same validation.
 */
public with sharing class SalesCopilotAgentSupport {

    public static final String CHANNEL = 'agentforce';

    /** One action result: the endpoint's status ("created", "failed", "found"...) and its JSON body. */
    public class Result {
        @InvocableVariable(label='Status' description='The endpoint status, e.g. created, found, failed, exists, new, similar')
        public String status;

        @InvocableVariable(label='Result JSON' description='The full endpoint response as JSON')
        public String resultJson;
    }

    public static Result result(String status, Object body) {
        final Result result = new Result();
        result.status = status;
        result.resultJson = JSON.serialize(body, true);
        return result;
    }

    /**
     * Prepares a build or check body written by the agent: a fresh requestId when it has none (the model should not
     * invent ids; a reused id would return an old build) and source.channel = agentforce. A body that is not a JSON
     * object is returned unchanged, so the service answers with its own readable error.
     */
    public static String withAgentDefaults(String body) {
        Object parsed;
        try {
            parsed = JSON.deserializeUntyped(body);
        } catch (Exception e) {
            return body;
        }
        if (!(parsed instanceof Map<String, Object>)) {
            return body;
        }
        final Map<String, Object> root = (Map<String, Object>) parsed;
        final Object requestId = root.get('requestId');
        if (!(requestId instanceof String) || String.isBlank((String) requestId)) {
            root.put('requestId', newRequestId());
        }
        Map<String, Object> source = root.get('source') instanceof Map<String, Object>
            ? (Map<String, Object>) root.get('source')
            : new Map<String, Object>();
        source.put('channel', CHANNEL);
        root.put('source', source);
        if (root.get('target') == null) {
            root.put('target', 'revenue-cloud');
        }
        return JSON.serialize(root);
    }

    /** req_af_<yyMMddHHmmss>_<4 random hex>: unique per call, within the endpoint's 80 characters. */
    public static String newRequestId() {
        final String stamp = Datetime.now().formatGmt('yyMMddHHmmss');
        final String random = EncodingUtil.convertToHex(Crypto.generateAesKey(128)).left(4);
        return 'req_af_' + stamp + '_' + random;
    }
}
