declare module "sse-channel" {
    import { Request, Response } from "express";

    interface SseMessage {
        data:string|object
        id:string
        event:string
        retry?:number
    }

    interface SseOptions {
        historySize?:number
        history?:string[]
        retryTimeout?:number
        pingInterval?:number
        jsonEncode?:boolean
        cors?:object
    }

    class SseChannel {
        constructor(options?:SseOptions);
        addClient(request:Request, response:Response, callback?:(err:Error) => {}):void;
        removeClient(response:Response):void;
        getConnectionCount():number;
        ping():void;
        send(msg:string|SseMessage, clients?:Response[]):void;
        sendEventsSinceId(client:Response, id:string):void;
        close():void;
    }

    export = SseChannel;
}
