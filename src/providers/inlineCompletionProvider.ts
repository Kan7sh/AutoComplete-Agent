import * as vscode from "vscode";
import { ApiClient } from "../api/apiClient";
import { ChatMessage, PendingCompletion } from "../utils/types";

export class InineCompletionProvider
  implements vscode.InlineCompletionItemProvider
{
  private readonly outputChannel: vscode.OutputChannel;
  private readonly apiClient: ApiClient;
  private pendingCompletion: PendingCompletion | null = null;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
    this.apiClient = new ApiClient(outputChannel);
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

      const prefix = document.getText(
        new vscode.Range(new vscode.Position(0, 0), position),
      );

      if(token.isCancellationRequested){
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

      this.pendingCompletion = {
        documentUri: document.uri.toString(),
        edit: {
          startPosition: position,
          insertText: completion,
        },
      };
      return this.createInlineCompletionList(completion);
    } catch (error) {
      this.log(`Unexpected error ${error}`);
      return null;
    }
  }

  private createInlineCompletionList(
    text: string,
    range?: vscode.Range,
  ): vscode.InlineCompletionList {
    const newItem = new vscode.InlineCompletionItem(text, range);
    return { items: [newItem] };
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

  private log(message: string): void {
    this.outputChannel.appendLine(`[Provider] ${message}`);
  }
}
