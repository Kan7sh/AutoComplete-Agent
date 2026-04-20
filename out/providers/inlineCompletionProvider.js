"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.InineCompletionProvider = void 0;
const vscode = __importStar(require("vscode"));
const apiClient_1 = require("../api/apiClient");
class InineCompletionProvider {
    outputChannel;
    apiClient;
    pendingCompletion = null;
    constructor(outputChannel) {
        this.outputChannel = outputChannel;
        this.apiClient = new apiClient_1.ApiClient(outputChannel);
    }
    async provideInlineCompletionItems(document, position, _context, token) {
        try {
            this.handleExistingPendingCompletion();
            const prefix = document.getText(new vscode.Range(new vscode.Position(0, 0), position));
            this.log(`provideInlineCompletionItems called t ${position.line}:${position.character}`);
            let completion = "";
            try {
                completion = await this.callCompletionAPI([
                    {
                        role: "system",
                        content: "Complete the code. Output ONLY the completion, not explanation.",
                    },
                    { role: "user", content: prefix },
                ], token);
            }
            catch (error) {
                this.log(`API error ${error}`);
                return null;
            }
            this.pendingCompletion = {
                documentUri: document.uri.toString(),
                edit: {
                    startPosition: position,
                    insertText: completion,
                }
            };
            const newItem = new vscode.InlineCompletionItem(completion);
            return { items: [newItem] };
        }
        catch (error) {
            this.log(`Unexpected error ${error}`);
            return null;
        }
    }
    handleExistingPendingCompletion(document, position) {
        if (!this.pendingCompletion) {
            return undefined;
        }
        const pendingPosition = this.pendingCompletion.edit.startPosition;
        const pendingUri = this.pendingCompletion.documentUri;
        if (document.uri.toString() !== pendingUri) {
        }
    }
    async callCompletionAPI(messages, token) {
        let result = "";
        try {
            const generator = await this.apiClient.complete(messages);
            for await (const chunk of generator) {
                if (token.isCancellationRequested) {
                    this.apiClient.cancel();
                    break;
                }
                result += chunk;
            }
        }
        catch (error) {
            this.log(`API Error: ${error}`);
        }
        return result;
    }
    log(message) {
        this.outputChannel.appendLine(`[Provider] ${message}`);
    }
}
exports.InineCompletionProvider = InineCompletionProvider;
//# sourceMappingURL=inlineCompletionProvider.js.map