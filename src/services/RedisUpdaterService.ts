import { createClient, RedisClient } from "redis";
import { Configuration } from "../config";
import * as log from "winston";

interface QuestUpdateMessage {
    updateDescriptor:object
}

type UpdateFunction = (update:object) => void;

let serviceSingleton: RedisUpdaterService | null = null;

export class RedisUpdaterService {
    private subscription:RedisClient;
    public readonly toNotifyOnAdd:Array<UpdateFunction>;
    public readonly toNotifyOnUpdate:Array<UpdateFunction>;
    public readonly toNotifyOnRemove:Array<UpdateFunction>;

    private ADD_CHANNEL = "new-quests";
    private UPDATE_CHANNEL = "quest-updates";
    private REMOVE_CHANNEL = "removed-quests";
    private RECONNECT_WAIT_TIME = 10000;

    constructor(config:Configuration) {
        if (!config.redisPassword) {
            throw new Error("Tried to construct the redis updater service without a password!");
        }

        this.toNotifyOnAdd = [];
        this.toNotifyOnUpdate = [];
        this.toNotifyOnRemove = [];

        this.subscription = createClient(config.redisUrl, {
            password: config.redisPassword,
            retry_strategy: (options) => {

                if (options.attempt > 12) {
                    log.error("Lost connection with redis after 12 attempts! Shutting down server.");
                    return Error("Could not connect to redis after 12 attempts.");
                }

                return this.RECONNECT_WAIT_TIME;
            }
        });

        this.subscribeToRedisTopics();
        this.logErrors();

        log.info("Successfully connected to redis.");
    }

    private subscribeToRedisTopics() {
        this.subscription.on("message", (channel:string, message:string) => {
            let deserializedMessage:QuestUpdateMessage;

            try {
                deserializedMessage = JSON.parse(message);

                if (!deserializedMessage.updateDescriptor) {
                    log.error(`No updateDescriptor field in message: ${message}`);
                    return;
                }
            }
            catch (e) {
                log.warn(`Received bad JSON: ${message}`);
                return;
            }

            if (channel == this.ADD_CHANNEL) {
                this.toNotifyOnAdd.forEach(async (updateFn) => updateFn(deserializedMessage.updateDescriptor));
            }

            if (channel == this.UPDATE_CHANNEL) {
                this.toNotifyOnUpdate.forEach(async (updateFn) => updateFn(deserializedMessage.updateDescriptor));
            }

            if (channel == this.REMOVE_CHANNEL) {
                this.toNotifyOnRemove.forEach(async (updateFn) => updateFn(deserializedMessage.updateDescriptor));
            }
        });

        this.subscription.subscribe(this.ADD_CHANNEL, this.UPDATE_CHANNEL, this.REMOVE_CHANNEL);
    }

    private logErrors() {
        this.subscription.on("error", (err:Error) => {
            log.warn(`Got an error from the redis connector. Message: ${err.message}`);
        })
    }
}

export default (config:Configuration) => {
    if (!serviceSingleton) {
        serviceSingleton = new RedisUpdaterService(config);
    }

    return serviceSingleton;
};