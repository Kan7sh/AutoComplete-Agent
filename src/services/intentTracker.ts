import * as vscode from "vscode";
import { PendingIntent } from "../utils/types";

export class IntentTracker implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private lastDocumentVersion: Map<string, number> = new Map();
  private pendingIntent: PendingIntent | null = null;

  constructor() {
    this.registerListners();
  }

  private registerListners(): void {
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        this.handleDocumentChange(e);
      }),
    );

    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        this.handleActiveEditortChange(editor);
      }),
    );
  }

  private handleActiveEditortChange(editor: vscode.TextEditor | undefined) {}

  private handleDocumentChange(event: vscode.TextDocumentChangeEvent): void {
    const document = event.document;
    if (document.uri.scheme !== "file") {
      return;
    }

    const activeEditor = vscode.window.activeTextEditor;
    if (
      !activeEditor ||
      activeEditor.document.uri.toString() !== document.uri.toString()
    ) {
      return;
    }

    const docKey = document.uri.toString();
    const previousVersion = this.lastDocumentVersion.get(docKey);
    const currentVersion = document.version;
    this.lastDocumentVersion.set(docKey, currentVersion);
    if (
      previousVersion !== undefined &&
      Math.abs(currentVersion - previousVersion) > 1
    ) {
      if (
        this.pendingIntent &&
        this.pendingIntent.filePath == document.uri.fsPath
      ) {
        this.pendingIntent = null;
      }
      return;
    }

    for (const change of event.contentChanges) {
      this.processChange(document, change);
    }
  }

  private processChange(
    document: vscode.TextDocument,
    change: vscode.TextDocumentContentChangeEvent,
  ): void {
    const isPaste = change.text.length > 50;
    const filePath = document.uri.fsPath;
    const now = Date.now();
    const line = change.range.start.line;
    const currentLineContent = line<document.lineCount?document.lineAt(line).text:'';
    const canContinuePending =
      this.pendingIntent &&
      this.pendingIntent.filePath === filePath &&
      now - this.pendingIntent?.lastActivityTime < 1500;

    if (!canContinuePending) {
      this.finalizeIntent();
    }

    if (!this.pendingIntent) {
      this.pendingIntent = {
        type: isPaste ? "pasted" : "added",
        filePath,
        originalContent: new Map(),
        currentContent: new Map(),
        startTime: now,
        lastActivityTime: now,
        affectedLines: new Set(),
      };
    }

    this.captureOrignalLineContent(change, line, currentLineContent);
  }

  private captureOrignalLineContent(
    change: vscode.TextDocumentContentChangeEvent,
    line: number,
    currentLineContent: string,
  ) :void{
    if(this.pendingIntent?.originalContent.has(line)){
        return;
    }

    let orignalLineContent = currentLineContent;


    if(change.rangeLength===0&&change.text.length>0){
        const startChar = change.range.start.character;
        orignalLineContent = currentLineContent.slice(0,startChar)+currentLineContent.slice(startChar+change.text.length);
    }

    this.pendingIntent?.originalContent.set(
        line,
        orignalLineContent,

    )
  }

  private finalizeIntent(): void {}

  dispose() {}
}
