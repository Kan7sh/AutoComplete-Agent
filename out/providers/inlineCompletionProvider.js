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
    lastCompletionText = "";
    lastCompeltionPosition = null;
    lastCompletionUri = null;
    constructor(outputChannel) {
        this.outputChannel = outputChannel;
        this.apiClient = new apiClient_1.ApiClient(outputChannel);
    }
    async provideInlineCompletionItems(document, position, _context, token) {
        try {
            this.log(`provideInlineCompletionItems called t ${position.line}:${position.character}`);
            const pendingCompletionResult = this.handleExistingPendingCompletion(document, position);
            if (pendingCompletionResult !== undefined) {
                return pendingCompletionResult;
            }
            const prefix = document.getText(new vscode.Range(new vscode.Position(0, 0), position));
            if (token.isCancellationRequested) {
                this.log("Request cancelled");
                return null;
            }
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
            const edit = {
                insertText: completion,
                startPosition: position,
            };
            return this.activateCompletion(edit, document);
        }
        catch (error) {
            this.log(`Unexpected error ${error}`);
            return null;
        }
    }
    activateCompletion(edit, document) {
        this.lastCompletionText = edit.insertText;
        this.lastCompeltionPosition = edit.startPosition;
        this.lastCompletionUri = document.uri.toString();
        this.pendingCompletion = {
            documentUri: document.uri.toString(),
            edit: edit,
        };
        return this.createInlineCompletionList(edit.insertText);
    }
    createInlineCompletionList(text, range) {
        const newItem = new vscode.InlineCompletionItem(text, range);
        return { items: [newItem] };
    }
    tryContinuePrediction(document, position) {
        if (!this.lastCompeltionPosition ||
            !this.lastCompletionText ||
            this.lastCompletionUri !== document.uri.toString()) {
            return undefined;
        }
        const charsSinceCompletion = position.character - this.lastCompeltionPosition.character;
        if (position.line !== this.lastCompeltionPosition.line ||
            charsSinceCompletion <= 0) {
            return undefined;
        }
        const typedText = document.getText(new vscode.Range(this.lastCompeltionPosition, position));
        if (charsSinceCompletion <= this.lastCompletionText.length &&
            this.lastCompletionText.startsWith(typedText)) {
            const remaing = this.lastCompletionText.slice(typedText.length);
            if (remaing) {
                this.log(`Continuing prediction typed "${typedText}", remaing "${remaing}"`);
                return this.createInlineCompletionList(remaing, new vscode.Range(position, position));
            }
            this.log("User completed entire prediction");
            this.lastCompletionText = "";
            this.lastCompeltionPosition = null;
            return null;
        }
        this.log(`Divergence detected: expected ${this.lastCompletionText}, got ${typedText}`);
        this.lastCompletionText = "";
        this.lastCompeltionPosition = null;
        return undefined;
    }
    handleExistingPendingCompletion(document, position) {
        if (!this.pendingCompletion) {
            return undefined;
        }
        const pendingPosition = this.pendingCompletion.edit.startPosition;
        const pendingUri = this.pendingCompletion.documentUri;
        if (document.uri.toString() !== pendingUri) {
            this.clearPendingCompletion();
            return undefined;
        }
        if (position.line !== pendingPosition.line) {
            this.clearPendingCompletion();
            return undefined;
        }
        if (position.character === pendingPosition.character) {
            this.createInlineCompletionList(this.pendingCompletion.edit.insertText);
        }
        this.clearPendingCompletion();
        return undefined;
    }
    clearPendingCompletion() {
        this.pendingCompletion = null;
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
    cleanCompletionText(text) {
        let cleaned = text.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
        const explanationPattern = /\n\n(?:\/\/|\/\*|#|Note:|Explanation:)[\s\S]*$/;
        cleaned = cleaned.replace(explanationPattern, "");
        return cleaned.trimEnd();
    }
    createCompletionListFromCache(text, postition) {
        const replaceRange = new vscode.Range(postition, postition);
        const completionText = text;
        return this.createInlineCompletionList(completionText, replaceRange);
    }
    log(message) {
        this.outputChannel.appendLine(`[Provider] ${message}`);
    }
}
exports.InineCompletionProvider = InineCompletionProvider;
//# sourceMappingURL=inlineCompletionProvider.js.map