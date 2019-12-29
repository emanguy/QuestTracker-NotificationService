import {createClient, RedisClient, RetryStrategyOptions} from "redis";
import {Configuration} from "../config";
import log from "../logger";
import {GenericAdd, GenericDeletion, GenericUpdate} from "common-interfaces/QuestInterfaces";
import {RedisTestPayload} from "./customTypes/RedisTestTypes";

type QuestAddedCallback = (update: GenericAdd) => void;
type QuestUpdatedCallback = (update: GenericUpdate) => void;
type QuestDeletedCallback = (update: GenericDeletion) => void;
type TestListenerRegistration  = {
    id: number;
    callbackFn: (input: RedisTestPayload) => void;
};

let serviceSingleton: RedisUpdaterService | null = null;

export class RedisUpdaterService {
    public readonly toNotifyOnAdd: Array<QuestAddedCallback>;
    public readonly toNotifyOnUpdate: Array<QuestUpdatedCallback>;
    public readonly toNotifyOnRemove: Array<QuestDeletedCallback>;

    /**
     * Base client is used for typical redis stuff. Needed because the client goes into "subscriber mode" on subscribe.
     *
     *  @see https://github.com/noderedis/node_redis#publish--subscribe
     */
    private baseClient: RedisClient;
    /** Subscription is used for listening to posted channel messages */
    private subscription: RedisClient;

    private toNotifyOnTest: Array<TestListenerRegistration>;

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

        let strategy = (options: RetryStrategyOptions) => {

            if (options.attempt > 12) {
                log.error("Lost connection with redis after 12 attempts! Shutting down server.");
                return Error("Could not connect to redis after 12 attempts.");
            }

            return this.RECONNECT_WAIT_TIME;
        };
        this.baseClient = createClient(config.redisUrl, {
            password: config.redisPassword,
            retry_strategy: strategy
        });
        this.subscription = createClient(config.redisUrl, {
            password: config.redisPassword,
            retry_strategy: strategy
        });

        this.subscribeToRedisTopics();
        this.logErrors();

        log.info("Successfully connected to redis.");
    }

    // This is really only used in testing
    public disconnect() {
        this.subscription.quit();
        this.baseClient.quit();
    }

    /**
     * Sends a test message through redis pubsub with a unique value and waits 3 seconds to receive the value back.
     * If we don't see the value within 3 seconds, we time out and say we can't reach redis.
     *
     * @return A promise which resolves true if we can talk to redis or false if we can't
     */
    public sendTestMessage(): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            const randomNum = Math.floor(1000 * Math.random());
            const payload: RedisTestPayload = {
                testValue: randomNum
            };
            let receivedInput = false;

            // Option 1 - Receive response before timeout and our number matches. Resolve with true, our connection to redis is working
            const listnenerFn = (response: RedisTestPayload) => {
                // If we got a different value than the one we sent, ignore
                if (response.testValue !== randomNum) return;
                receivedInput = true;
                this.removeTestListenerByID(randomNum);
                resolve(true);
            };
            // Option 2 - We don't receive a response after 3 seconds, we assume the redis connection isn't working and resolve with false
            setTimeout(() => {
                if (receivedInput) return;
                log.error(`Health test timeout, did not receive value (${randomNum}).`);
                this.removeTestListenerByID(randomNum);
                resolve(false);
            }, 3000);

            // Add the listener and send the message
            this.toNotifyOnTest.push({
                id: randomNum,
                callbackFn: listnenerFn,
            });

            try {
                this.baseClient.publish(this.TEST_CHANNEL, JSON.stringify(payload));
            } catch (err) {
                log.error(`Failed to send health test message. Will time out shortly. Problem: ${err.message}`);
                resolve(false);
            }
        })
    }

    private subscribeToRedisTopics() {
        this.subscription.on("message", (channel:string, message:string) => {
            let deserializedMessage: GenericAdd|GenericUpdate|GenericDeletion|RedisTestPayload;
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

            if (channel == this.TEST_CHANNEL) {
                this.toNotifyOnTest.forEach(async (registration) => registration.callbackFn(<RedisTestPayload> deserializedMessage));
            }
        });

        this.subscription.subscribe(this.ADD_CHANNEL, this.UPDATE_CHANNEL, this.REMOVE_CHANNEL, this.TEST_CHANNEL);
    }

    private removeTestListenerByID(id: number) {
        const listenerIdx = this.toNotifyOnTest.findIndex(registration => registration.id === id);
        if (listenerIdx === -1) return;
        this.toNotifyOnTest.splice(listenerIdx, 1);
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
