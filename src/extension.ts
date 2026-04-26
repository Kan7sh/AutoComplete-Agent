
import * as vscode from 'vscode';
import { InineCompletionProvider } from './providers/inlineCompletionProvider';
let provider:InineCompletionProvider | undefined;
let outputChannel:vscode.OutputChannel|undefined;

export function activate(context: vscode.ExtensionContext) {

	outputChannel = vscode.window.createOutputChannel('Tab Completion');
	outputChannel.appendLine('Tab Completion extension activated');
	provider = new InineCompletionProvider(outputChannel);
	const providerDisposable = vscode.languages.registerInlineCompletionItemProvider(
		{pattern:"**"},
		provider
	);

	context.subscriptions.push(providerDisposable,outputChannel);
}

export function deactivate() {}
