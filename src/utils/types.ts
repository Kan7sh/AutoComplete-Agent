export interface ChatStreamChunk{
    id:string,
    object:string,
    created:number,
    model:string,
    choices:Array<{index:number;delta:{
        role?:string;
        content?: string;
    };
    finish_reason:string|null;
}>
}