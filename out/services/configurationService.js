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
exports.ConfigurationService = void 0;
exports.getConfig = getConfig;
const vscode = __importStar(require("vscode"));
const DEFAULTS = {
    fireworksApiKey: "",
    groqApiKey: "",
    openrouterApiKey: "",
    model: "qwen/qwen3-32b",
    maxTokens: 500,
};
class ConfigurationService {
    static instace = null;
    cachedConfig;
    disposables = [];
    changeListeners = new Set();
    constructor() {
        this.cachedConfig = this.loadConfig();
        this.registerConfigChangeListener();
    }
    static getInstance() {
        if (!ConfigurationService.instace) {
            ConfigurationService.instace = new ConfigurationService();
        }
        return ConfigurationService.instace;
    }
    registerConfigChangeListener() {
        this.disposables.push(vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration("tab-completion")) {
                this.cachedConfig = this.loadConfig();
                this.notifyListeners();
            }
        }));
    }
    notifyListeners() {
        for (const listner of this.changeListeners) {
            try {
                listner(this.cachedConfig);
            }
            catch (error) { }
        }
    }
    get model() {
        return this.cachedConfig.model;
    }
    get fireworksApiKey() {
        return this.cachedConfig.fireworksApiKey;
    }
    get groqApiKey() {
        return this.cachedConfig.groqApiKey;
    }
    get openrouterApiKey() {
        return this.cachedConfig.openrouterApiKey;
    }
    get maxTokens() {
        return this.cachedConfig.maxTokens;
    }
    onConfigChange(callback) {
        this.changeListeners.add(callback);
        return { dispose: () => this.changeListeners.delete(callback) };
    }
    loadConfig() {
        const config = vscode.workspace.getConfiguration("tab-completion");
        return {
            fireworksApiKey: config.get("fireworksApiKey", DEFAULTS.fireworksApiKey),
            groqApiKey: config.get("groqApiKey", DEFAULTS.groqApiKey),
            openrouterApiKey: config.get("openrouterApiKey", DEFAULTS.openrouterApiKey),
            maxTokens: config.get("maxTokens", DEFAULTS.maxTokens),
            model: config.get("model", DEFAULTS.model),
        };
    }
    dispose() {
        this.disposables.forEach((d) => d.dispose());
        this.changeListeners.clear();
    }
}
exports.ConfigurationService = ConfigurationService;
function getConfig() {
    return ConfigurationService.getInstance();
}
//# sourceMappingURL=configurationService.js.map