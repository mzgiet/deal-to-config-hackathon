public with sharing class SalesCopilotBuildResponse {

    public String requestId;
    public String status;
    public String artifactUrl;
    public String error;
    public transient Integer statusCode;

    public static Builder builderInstance() {
        return new Builder();
    }

    public class Builder {

        private SalesCopilotBuildResponse response;

        public Builder() {
            this.response = new SalesCopilotBuildResponse();
        }

        public Builder withRequestId(String requestId) {
            this.response.requestId = requestId;
            return this;
        }

        public Builder withCreated(String artifactUrl) {
            this.response.status = SalesCopilotConstants.STATUS_CREATED;
            this.response.artifactUrl = artifactUrl;
            this.response.statusCode = SalesCopilotConstants.HTTP_OK;
            return this;
        }

        public Builder withFailed(Integer statusCode, String error) {
            this.response.status = SalesCopilotConstants.STATUS_FAILED;
            this.response.error = error;
            this.response.statusCode = statusCode;
            return this;
        }

        public SalesCopilotBuildResponse get() {
            return this.response;
        }
    }
}
