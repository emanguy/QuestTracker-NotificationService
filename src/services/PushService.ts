import {Request, Response} from "express";
import {v4 as uuid} from "uuid";
import redisService, {RedisUpdaterService} from "./RedisUpdaterService";
import config from "../config";
import {GenericAdd, GenericDeletion, GenericUpdate} from "common-interfaces/QuestInterfaces";
import {MessageType} from "common-interfaces/NotificationInterfaces";
import SseChannel = require("sse-channel");

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

    addNewItem(item: GenericAdd) {
        this.channel.send({
            data: item,
            id: uuid(),
            event: MessageType.DATA_NEW
        });
    }

    updateExistingItem(item: GenericUpdate) {
        this.channel.send({
            data: item,
            id: uuid(),
            event: MessageType.DATA_UPDATE
        });
    }

    deleteItem(item: GenericDeletion) {
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
