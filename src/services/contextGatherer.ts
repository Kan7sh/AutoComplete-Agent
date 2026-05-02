import * as vscode from "vscode";
import { IntentTracker } from "./intentTracker";
import { PrefixStage } from "./contextStages/prefixStage";
import { LSPService } from "./lspService";
export class ContextGatherer implements vscode.Disposable {
  private readonly intentTracker: IntentTracker;
  private readonly prefixState: PrefixStage;
  private readonly lspService: LSPService;

  constructor(intentTracker: IntentTracker) {
    this.intentTracker = intentTracker;
    this.lspService = new LSPService();
    this.prefixState = new PrefixStage(this.lspService);
  }

  async gatherContext(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<string> {
    const editHistory = this.intentTracker.serialize();

    return (await this.prefixState.buildPrefix(document, position)) ?? "";
  }

  dispose(): void {}
}
