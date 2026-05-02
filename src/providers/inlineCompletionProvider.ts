import * as vscode from "vscode";
import { ApiClient } from "../api/apiClient";
import {
  ChatMessage,
  PendingCompletion,
  ReplacementEdit,
} from "../utils/types";
import { CompletionCache } from "../cache/completionCache";
import { IntentTracker } from "../services/intentTracker";

export class InineCompletionProvider
  implements vscode.InlineCompletionItemProvider
{
  private readonly outputChannel: vscode.OutputChannel;
  private readonly apiClient: ApiClient;
  private readonly intentTracker: IntentTracker;
  private readonly completionCache: CompletionCache;
  private pendingCompletion: PendingCompletion | null = null;
  private lastCompletionText = "";
  private lastCompeltionPosition: vscode.Position | null = null;
  private lastCompletionUri: string | null = null;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
    this.apiClient = new ApiClient(outputChannel);
    this.intentTracker = new IntentTracker();
    this.completionCache = new CompletionCache();
  }
  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken,
  ): Promise<vscode.InlineCompletionList | null> {
    try {
      this.log(
        `provideInlineCompletionItems called t ${position.line}:${position.character}`,
      );
      const pendingCompletionResult = this.handleExistingPendingCompletion(
        document,
        position,
      );

      if (pendingCompletionResult !== undefined) {
        return pendingCompletionResult;
      }

      const editHistoryHash = this.intentTracker.computeHash();

      const cachedResult = this.tryCachedCompletion(
        document,
        position,
        editHistoryHash,
      );
      if (cachedResult) {
        return cachedResult;
      }

      const continuationResult = this.tryContinuePrediction(document, position);
      if (continuationResult !== undefined) {
        return continuationResult;
      }
      const prefix = document.getText(
        new vscode.Range(new vscode.Position(0, 0), position),
      );

      if (token.isCancellationRequested) {
        this.log("Request cancelled");
        return null;
      }

      let completion = "";
      try {
        completion = await this.callCompletionAPI(
          [
            {
              role: "system",
              content:
                "Complete the code. Output ONLY the completion, not explanation.",
            },
            { role: "user", content: prefix },
          ],
          token,
        );
      } catch (error) {
        this.log(`API error ${error}`);
        return null;
      }

      const edit: ReplacementEdit = {
        insertText: completion,
        startPosition: position,
      };

      this.completionCache.set(document, position, editHistoryHash, edit);

      return this.activateCompletion(edit, document);
    } catch (error) {
      this.log(`Unexpected error ${error}`);
      return null;
    }
  }

  private tryCachedCompletion(
    document: vscode.TextDocument,
    position: vscode.Position,
    editHistory: string,
  ): vscode.InlineCompletionList | undefined {
    const cachedEdit = this.completionCache.get(
      document,
      position,
      editHistory,
    );
    if (!cachedEdit) {
      return undefined;
    }

        this.log(`Cache hit ${cachedEdit}`);


    return this.activateCompletion(cachedEdit, document);
  }

  private activateCompletion(
    edit: ReplacementEdit,
    document: vscode.TextDocument,
  ): vscode.InlineCompletionList {
    this.lastCompletionText = edit.insertText;
    this.lastCompeltionPosition = edit.startPosition;
    this.lastCompletionUri = document.uri.toString();
    this.pendingCompletion = {
      documentUri: document.uri.toString(),
      edit: edit,
    };
    return this.createInlineCompletionList(edit.insertText);
  }

  private createInlineCompletionList(
    text: string,
    range?: vscode.Range,
  ): vscode.InlineCompletionList {
    const newItem = new vscode.InlineCompletionItem(text, range);
    return { items: [newItem] };
  }

  private tryContinuePrediction(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.InlineCompletionList | null | undefined {
    if (
      !this.lastCompeltionPosition ||
      !this.lastCompletionText ||
      this.lastCompletionUri !== document.uri.toString()
    ) {
      return undefined;
    }
    const charsSinceCompletion =
      position.character - this.lastCompeltionPosition.character;
    if (
      position.line !== this.lastCompeltionPosition.line ||
      charsSinceCompletion <= 0
    ) {
      return undefined;
    }

    const typedText = document.getText(
      new vscode.Range(this.lastCompeltionPosition, position),
    );
    if (
      charsSinceCompletion <= this.lastCompletionText.length &&
      this.lastCompletionText.startsWith(typedText)
    ) {
      const remaing = this.lastCompletionText.slice(typedText.length);
      if (remaing) {
        this.log(
          `Continuing prediction typed "${typedText}", remaing "${remaing}"`,
        );
        return this.createInlineCompletionList(
          remaing,
          new vscode.Range(position, position),
        );
      }
      this.log("User completed entire prediction");
      this.lastCompletionText = "";
      this.lastCompeltionPosition = null;
      return null;
    }
    this.log(
      `Divergence detected: expected ${this.lastCompletionText}, got ${typedText}`,
    );
    this.lastCompletionText = "";
    this.lastCompeltionPosition = null;
    return undefined;
  }

  private handleExistingPendingCompletion(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.InlineCompletionList | null | undefined {
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

  private clearPendingCompletion(): void {
    this.pendingCompletion = null;
  }

  private async callCompletionAPI(
    messages: ChatMessage[],
    token: vscode.CancellationToken,
  ) {
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
    } catch (error) {
      this.log(`API Error: ${error}`);
    }

    return result;
  }

  private cleanCompletionText(text: string): string {
    let cleaned = text.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
    const explanationPattern = /\n\n(?:\/\/|\/\*|#|Note:|Explanation:)[\s\S]*$/;
    cleaned = cleaned.replace(explanationPattern, "");
    return cleaned.trimEnd();
  }

  private createCompletionListFromCache(
    text: string,
    postition: vscode.Position,
  ) {
    const replaceRange = new vscode.Range(postition, postition);
    const completionText = text;
    return this.createInlineCompletionList(completionText, replaceRange);
  }

  private log(message: string): void {
    this.outputChannel.appendLine(`[Provider] ${message}`);
  }
}
