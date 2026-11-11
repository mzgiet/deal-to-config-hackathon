/**
 * Refreshes the pricing decision tables after a build, the Apex equivalent of the orchestrator's call to
 * connect/core-pricing/sync/syncData. Runs as a Queueable so it starts after the build has committed, and runs a
 * second pass a minute later because the first refresh after a build can miss new prices.
 */
public with sharing class SalesCopilotPricingRefresh implements Queueable {

    private static final Integer PASSES = 2;
    private final Integer pass;

    public SalesCopilotPricingRefresh(Integer pass) {
        this.pass = pass;
    }

    public static void start() {
        System.enqueueJob(new SalesCopilotPricingRefresh(1));
    }

    public void execute(QueueableContext context) {
        for (DecisionTable table : [
            SELECT DeveloperName FROM DecisionTable WHERE UsageType = 'DefaultPricing' AND Status = 'Active'
        ]) {
            refresh(table.DeveloperName);
        }
        if (pass < PASSES && !Test.isRunningTest()) {
            System.enqueueJob(new SalesCopilotPricingRefresh(pass + 1), 1);
        }
    }

    /** Best effort, like the orchestrator's refresh: a failure is logged and never undoes the build. */
    private static void refresh(String tableName) {
        try {
            final Invocable.Action action = Invocable.Action.createStandardAction('refreshDecisionTable');
            action.setInvocationParameter('DecisionTableApiName', tableName);
            for (Invocable.Action.Result result : action.invoke()) {
                if (!result.isSuccess()) {
                    System.debug(LoggingLevel.WARN, 'Pricing refresh failed for ' + tableName + ': ' + result.getErrors());
                }
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'Pricing refresh failed for ' + tableName + ': ' + e.getMessage());
        }
    }
}
