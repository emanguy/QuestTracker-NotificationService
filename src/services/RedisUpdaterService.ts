import {createClient, RedisClient} from "redis";
import {Configuration} from "../config";
import log from "../logger";
import {GenericAdd, GenericDeletion, GenericUpdate} from "common-interfaces/QuestInterfaces";
import {RedisTestPayload} from "./customTypes/RedisTestTypes";

type QuestAddedCallback = (update: GenericAdd) => void;
type QuestUpdatedCallback = (update: GenericUpdate) => void;
type QuestDeletedCallback = (update: GenericDeletion) => void;
type TestReceiveCallback = (testMessage: RedisTestPayload) => void;

let serviceSingleton: RedisUpdaterService | null = null;

export class RedisUpdaterService {
    private subscription: RedisClient;
    public readonly toNotifyOnAdd: Array<QuestAddedCallback>;
    public readonly toNotifyOnUpdate: Array<QuestUpdatedCallback>;
    public readonly toNotifyOnRemove: Array<QuestDeletedCallback>;
    public readonly toNotifyOnTest: Array<TestReceiveCallback>;

    private ADD_CHANNEL = "new-quests";
    private UPDATE_CHANNEL = "quest-updates";
    private REMOVE_CHANNEL = "removed-quests";
    private TEST_CHANNEL = "test-connectivity";
    private RECONNECT_WAIT_TIME = 10000;

    constructor(config:Configuration) {
        if (!config.redisPassword) {
            throw new Error("Tried to construct the redis updater service without a password!");
        }

        this.toNotifyOnAdd = [];
        this.toNotifyOnUpdate = [];
        this.toNotifyOnRemove = [];
        this.toNotifyOnTest = [];

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

    // This is really only used in testing
    public disconnect() {
        this.subscription.quit();
    }

    public sendTestMessage(): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            const randomNum = Math.floor(1000 * Math.random());
            const payload: RedisTestPayload = {
                testValue: randomNum
            };

            // TODO add listener to test set and look for sent number, race against 1s timeout
        })
    }

    private subscribeToRedisTopics() {
        this.subscription.on("message", (channel:string, message:string) => {
            let deserializedMessage: GenericAdd|GenericUpdate|GenericDeletion;

            try {
                deserializedMessage = JSON.parse(message);
            }
            catch (e) {
                log.warn(`Received bad JSON: ${message}`);
                return;
            }

            if (channel == this.ADD_CHANNEL) {
                this.toNotifyOnAdd.forEach(async (updateFn) => updateFn(<GenericAdd> deserializedMessage));
            }

            if (channel == this.UPDATE_CHANNEL) {
                this.toNotifyOnUpdate.forEach(async (updateFn) => updateFn(<GenericUpdate> deserializedMessage));
            }

            if (channel == this.REMOVE_CHANNEL) {
                this.toNotifyOnRemove.forEach(async (updateFn) => updateFn(<GenericDeletion> deserializedMessage));
            }
        });

        this.subscription.subscribe(this.ADD_CHANNEL, this.UPDATE_CHANNEL, this.REMOVE_CHANNEL);
    }

    private logErrors() {
        this.subscription.on("error", (err:Error) => {
            log.warn(`Got an error from the redis connector. Message: ${err.message}`);
            // Kill the process so K8s can restart it
            process.exit(1);
        })
    }
}

export default (config:Configuration) => {
    if (!serviceSingleton) {
        serviceSingleton = new RedisUpdaterService(config);
    }

    return serviceSingleton;
};
