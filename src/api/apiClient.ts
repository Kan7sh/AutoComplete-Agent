import * as vscode from "vscode";
import { getConfig } from "../services/configurationService";
import { ChatStreamChunk } from "../utils/types";

export type APIProvider = 'openrouter'|'groq'|'fireworks';

interface ProviderConfig{
    endpoint:string;
    getApiKey:()=>string;
    getModel:()=>string;
}

const PROVIDER_CONFIGS:Record<APIProvider,ProviderConfig> = {
    openrouter:{
        endpoint:"https://openrouter.ai/api/v1/chat/completions",
        getApiKey: ()=> getConfig().openrouterApiKey,
        getModel:()=>getConfig().model,
    },
    groq:{
        endpoint:"https://openrouter.ai/api/v1/chat/completions",
        getApiKey: ()=> getConfig().groqApiKey,
        getModel:()=>getConfig().model,
    },
    fireworks:{
        endpoint:"https://openrouter.ai/api/v1/chat/completions",
        getApiKey: ()=> getConfig().fireworksApiKey,
        getModel:()=>getConfig().model,
    },
} ;

export class ApiClient implements vscode.Disposable{
  private readonly outputChannel:vscode.OutputChannel;

      constructor(outputChannel:vscode.OutputChannel){
        this.outputChannel = outputChannel;
      }

      getActiveProvider(): APIProvider | null{
        const config = getConfig();
        if(config.openrouterApiKey) return 'openrouter';
        if(config.groqApiKey) return 'groq';
        if(config.fireworksApiKey) return 'fireworks';
        return null;
      }

      async complete(
        message:ChatMessage[],
        options:{
            maxTokens?:number;
        }={}
      ):Promise<AsyncGenerator<string,void,unknown>>{

      }

    private async* streamRequest(
        endpoint:string,
        body:Record<string,unknown>,
        apiKey:string,
        signal:AbortSignal,
    ):AsyncGenerator<String,void,unknown>{
        const response = await fetch(endpoint,{
            method:'POST',
            headers:{
                'Authorization':`Bearer ${apiKey}`,
                'Content-Type':'application/json'
            },
            body:JSON.stringify(body)
        });

        if(!response.ok){
            const errorText = await response.text();
            throw new Error(`API error ${response.status}: ${errorText}`);
        }

        if(!response.body){
            throw new Error('No response body');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try{
            while(true){
                const {done,value} = await reader.read();
                if(done){
                    break;
                }
                
                buffer+=decoder.decode(value,{stream:true});
                const lines = buffer.split('\n');
                buffer=lines.pop()||'';
                for(const line of lines){
                    if(line.startsWith('data: ')){
                        const data = line.slice(6);
                        if(data==='[DONE]'){
                            return;
                        }
                        try{
                            const chunk = JSON.parse(data) as ChatStreamChunk;
                            if(chunk.choices&&chunk.choices.length>0){
                                const content = chunk.choices[0].delta?.content;
                                if(content){
                                    yield content;
                                }
    
                            }
                        }catch(error){
                            this.log(`Parse error: ${error} `);
                        }
                    }
                }
            }
        }finally{
            reader.releaseLock();
        }
    }

    private log(message:string):void{
        this.outputChannel.appendLine(`[ApiClient] ${message}`);
    }

    dispose() {
        throw new Error("Method not implemented.");
    }

}