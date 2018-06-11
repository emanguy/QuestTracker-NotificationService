import { Request, Response } from "express";
import { v4 as uuid } from "uuid";
import { RedisUpdaterService } from "./RedisUpdaterService";
import config from "../config";
import SseChannel = require("sse-channel");
import redisService from "./RedisUpdaterService";

export enum MessageType { DATA_UPDATE = "update_item", DATA_NEW = "new_item", DATA_REMOVED = "remove_item" }

let serviceInstance: PushService | null = null;

export class PushService {
    private channel:SseChannel;

    constructor(redisService:RedisUpdaterService) {
        this.channel = new SseChannel({jsonEncode: true, cors: {origins: "*"}});

        redisService.toNotifyOnAdd.push(this.addNewItem.bind(this));
        redisService.toNotifyOnUpdate.push(this.updateExistingItem.bind(this));
        redisService.toNotifyOnRemove.push(this.deleteItem.bind(this));
    }

    addClient(req:Request, res:Response) {
        this.channel.addClient(req, res);
    }

    addNewItem(item:object) {
        this.channel.send({
            data: item,
            id: uuid(),
            event: MessageType.DATA_NEW
        });
    }

    updateExistingItem(item:object) {
        this.channel.send({
            data: item,
            id: uuid(),
            event: MessageType.DATA_UPDATE
        });
    }

    deleteItem(item:object) {
        this.channel.send({
            data: item,
            id: uuid(),
            event: MessageType.DATA_REMOVED
        });
    }
}

export default () => {
    if (!serviceInstance) {
        serviceInstance = new PushService(redisService(config));
    }

    return serviceInstance;
};
