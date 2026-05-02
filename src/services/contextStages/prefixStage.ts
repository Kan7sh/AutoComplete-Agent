import * as vscode from "vscode";
export class PrefixStage {
  async buildPrefix(document: vscode.TextDocument, position: vscode.Position) {
    if (position.line < 150) {
      return this.getVerbatimPrefix(document, position);
    }
  }

  getVerbatimPrefix(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): string {
    return this.collectLinesToCursor(document, 0, position).join("\n");
  }

  private collectLinesToCursor(
    document: vscode.TextDocument,
    startLine: number,
    position: vscode.Position,
  ): string[] {
    if (startLine > position.line) {
      return [];
    }

    const lines: string[] = [];

    for (let i = startLine; i <= position.line; i++) {
      const lineText = document.lineAt(i).text;
      lines.push(
        i === position.line ? lineText.slice(0, position.character) : lineText,
      );
    }

    return lines;
  }
}
