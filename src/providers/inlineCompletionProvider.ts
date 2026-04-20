import * as vscode from "vscode";
import { ApiClient } from "../api/apiClient";
import { ChatMessage } from "../utils/types";

export class InineCompletionProvider
  implements vscode.InlineCompletionItemProvider
{
  private readonly outputChannel: vscode.OutputChannel;
  private readonly apiClient: ApiClient;
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
      const prefix = document.getText(
        new vscode.Range(new vscode.Position(0, 0), position),
      );
      this.log(
        `provideInlineCompletionItems called t ${position.line}:${position.character}`,
      );
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
      } catch (error) {}

      const newItem = new vscode.InlineCompletionItem(completion);
      return { items: [newItem] };
    } catch (error) {
      this.log(`Unexpected error ${error}`);
      return null;
    }
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
