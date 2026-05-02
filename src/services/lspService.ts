import * as vscode from "vscode";
import { BoundedCache, buildCacheKey } from "../cache/boundedCache";
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

    this.registerListners();
  }

  private registerListners():void{
    this.disposables.push(
        vscode.workspace.onDidChangeTextDocument((e)=>{
            this.cache.invalidateGroup(e.document.uri.toString());
        }),
        vscode.workspace.onDidCloseTextDocument((doc)=>{
            this.cache.invalidateGroup(doc.uri.toString());
        })
    );
    
  }

  async getDocumentSymbols(
    document: vscode.TextDocument,
  ): Promise<vscode.DocumentSymbol[]> {

    const documentUri = document.uri.toString();


    const cacheKey = buildCacheKey(
        documentUri,
        document.version,
        'documentSymbols',
    );
    const cached = this.cache.get(cacheKey) as vscode.DocumentSymbol[]|undefined;
    if(cached!==undefined){
        return cached;
    }

    try {
      const symbols: vscode.DocumentSymbol[] =
        await vscode.commands.executeCommand(
          "vscode.executeDocumentSymbolProvider",
          document.uri,
        );

        this.cache.set(cacheKey,symbols,{groupKey:documentUri});

      return symbols;
    } catch (error) {
      return [];
    }
  }

  dispose() {
    this.disposables.forEach((d)=>d.dispose);
    this.cache.clear();
  }
}
