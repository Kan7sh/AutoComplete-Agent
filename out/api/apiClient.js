"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiClient = void 0;
const configurationService_1 = require("../services/configurationService");
const PROVIDER_CONFIGS = {
    openrouter: {
        endpoint: "https://openrouter.ai/api/v1/chat/completions",
        getApiKey: () => (0, configurationService_1.getConfig)().openrouterApiKey,
        getModel: () => (0, configurationService_1.getConfig)().model,
    },
    groq: {
        endpoint: "https://openrouter.ai/api/v1/chat/completions",
        getApiKey: () => (0, configurationService_1.getConfig)().groqApiKey,
        getModel: () => (0, configurationService_1.getConfig)().model,
    },
    fireworks: {
        endpoint: "https://openrouter.ai/api/v1/chat/completions",
        getApiKey: () => (0, configurationService_1.getConfig)().fireworksApiKey,
        getModel: () => (0, configurationService_1.getConfig)().model,
    },
};
class ApiClient {
    outputChannel;
    pendingRequest = null;
    constructor(outputChannel) {
        this.outputChannel = outputChannel;
    }
    getActiveProvider() {
        const config = (0, configurationService_1.getConfig)();
        if (config.openrouterApiKey)
            return "openrouter";
        if (config.groqApiKey)
            return "groq";
        if (config.fireworksApiKey)
            return "fireworks";
        return null;
    }
    async complete(messages) {
        const provider = this.getActiveProvider();
        if (!provider) {
            throw new Error("No API key is configured");
        }
        this.cancel();
        this.pendingRequest = new AbortController();
        const configService = (0, configurationService_1.getConfig)();
        const maxTokens = configService.maxTokens;
        const providerConfig = PROVIDER_CONFIGS[provider];
        const model = providerConfig.getModel();
        const body = {
            model,
            messages,
            max_tokens: maxTokens,
            stream: true,
            temperature: 0.1,
        };
        this.log(`[${provider}] Request:model=${body.model}, max_tokens=${maxTokens}`);
        return this.streamRequest(providerConfig.endpoint, body, providerConfig.getApiKey(), this.pendingRequest.signal);
    }
    cancel() {
        if (this.pendingRequest) {
            this.pendingRequest.abort();
            this.pendingRequest = null;
        }
    }
    async *streamRequest(endpoint, body, apiKey, signal) {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
            signal
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API error ${response.status}: ${errorText}`);
        }
        if (!response.body) {
            throw new Error("No response body");
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";
                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const data = line.slice(6);
                        if (data === "[DONE]") {
                            return;
                        }
                        try {
                            const chunk = JSON.parse(data);
                            if (chunk.choices && chunk.choices.length > 0) {
                                const content = chunk.choices[0].delta?.content;
                                if (content) {
                                    yield content;
                                }
                            }
                        }
                        catch (error) {
                            this.log(`Parse error: ${error} `);
                        }
                    }
                }
            }
        }
        finally {
            reader.releaseLock();
        }
    }
    log(message) {
        this.outputChannel.appendLine(`[ApiClient] ${message}`);
    }
    dispose() {
        throw new Error("Method not implemented.");
    }
}
exports.ApiClient = ApiClient;
//# sourceMappingURL=apiClient.js.map