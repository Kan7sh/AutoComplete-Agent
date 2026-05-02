import * as vscode from 'vscode';
import { IntentTracker } from './intentTracker';
export class ContextGatherer implements vscode.Disposable{

    private readonly intentTracker:IntentTracker;
    
    constructor(intentTracker:IntentTracker){
        this.intentTracker = intentTracker;
    }

    async gatherContext(
        document:vscode.TextDocument,
        position:vscode.Position
    ):Promise<void>{

        
        const editHistory = this.intentTracker.serialize();

    }


    dispose():void {
    }

}