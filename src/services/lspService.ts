import * as vscode from "vscode";
import { BoundedCache } from "../cache/boundedCache";
import { getConfig } from "./configurationService";

export class LSPService implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private currentMaxEntries: number;
  private cache: BoundedCache<unknown>;

  constructor() {
    const configService = getConfig();
    this.currentMaxEntries = configService.lspCacheMaxEntries;
    this.cache = new BoundedCache(this.currentMaxEntries);
    this.disposables.push(
      configService.onConfigChange((config) => {
        if (config.lspCacheMaxEntries !== this.currentMaxEntries) {
          this.cache = new BoundedCache<unknown>(config.lspCacheMaxEntries);
          this.currentMaxEntries = config.lspCacheMaxEntries;
        }
      }),
    );
  }

  async getDocumentSymbols(
    document: vscode.TextDocument,
  ): Promise<vscode.DocumentSymbol[]> {
    try {
      const symbols: vscode.DocumentSymbol[] =
        await vscode.commands.executeCommand(
          "vscode.executeDocumentSymbolProvider",
          document.uri,
        );

      return symbols;
    } catch (error) {
      return [];
    }
  }

  dispose() {}
}
