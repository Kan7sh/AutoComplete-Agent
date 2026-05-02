import * as vscode from "vscode";
import { IntentTracker } from "./intentTracker";
import { PrefixStage } from "./contextStages/prefixStage";
export class ContextGatherer implements vscode.Disposable {
  private readonly intentTracker: IntentTracker;
  private readonly prefixState: PrefixStage;

  constructor(intentTracker: IntentTracker) {
    this.intentTracker = intentTracker;
    this.prefixState = new PrefixStage();
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
