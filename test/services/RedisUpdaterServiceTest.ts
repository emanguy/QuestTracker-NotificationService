import {afterEach, beforeEach, it, suite} from "mocha";
import {expect} from "chai";
import * as Docker from "dockerode";
import {Container, ContainerCreateOptions} from "dockerode";
import {Configuration} from "../../src/config";
import {RedisUpdaterService} from "../../src/services/RedisUpdaterService";
import {createClient} from "redis";
import {
    GenericAdd,
    GenericDeletion,
    GenericUpdate,
    HierarchyLevel,
    Objective,
    ObjectiveUpdate
} from "common-interfaces/QuestInterfaces";

interface HostPortBinding {
    HostPort:string
}
interface CreateOptionsWithPortBindings extends ContainerCreateOptions {
    PortBindings: {
        [key:string]: HostPortBinding[]
    }
}

suite("Redis updater service test", () => {
    let container:Container;
    let docker = new Docker();
    let containersToDelete:Container[] = [];
    const config:Configuration = {
        applicationPort: 3000,
        redisUrl: "redis://localhost:6379",
        redisPassword: "testRedis"
    };
    const DOCKER_STARTUP_TIME = 5000;
    const MESSAGE_AWAIT_TIME = 500;
    const DEFAULT_ASYNC_TIMEOUT = 10000;

    before(function (done) {
        this.timeout(30000);

        docker.pull("bitnami/redis:4.0.9", {}, (err, stream) => {
            if (err) {
                console.log("Got an error pulling the image.");
                return;
            }

            docker.modem.followProgress(stream, () => done(), () => {});
        });
    });

    beforeEach(async function ()  {
        this.timeout(DEFAULT_ASYNC_TIMEOUT);
        container = await docker.createContainer(<CreateOptionsWithPortBindings>{
            Image: "bitnami/redis:4.0.9",
            Env: [
                "REDIS_PASSWORD=testRedis"
            ],
            PortBindings: {
                "6379/tcp": [{HostPort: "6379"}]
            }
        });

        await container.start();
    });

    afterEach(async function ()  {
        this.timeout(DEFAULT_ASYNC_TIMEOUT);
        if (container) {
            await container.stop();
            containersToDelete.push(container);
        }
    });

    after(async function() {
        this.timeout(DEFAULT_ASYNC_TIMEOUT);
        let stopJobs = containersToDelete.map((container) => container.remove());

        await Promise.all(stopJobs);
    });

    it("reacts to things published to its channels", (done) => {
        setTimeout(() => {
            const service = new RedisUpdaterService(config);
            let addPosted = false;
            let updatePosted = false;
            let deletePosted = false;

            const addMessage: GenericAdd = {
                type: HierarchyLevel.OBJECTIVE,
                newData: <Objective> {id: "a", text: "text", completed: true}
            };
            const updateMessage: GenericUpdate = {
                type: HierarchyLevel.OBJECTIVE,
                updateDetail: <ObjectiveUpdate> {
                    questId: "a",
                    objectiveId: "b",
                    text: "text"
                }
            };
            const deleteMessage: GenericDeletion = {
                type: HierarchyLevel.QUEST,
                id: "a"
            };

            service.toNotifyOnAdd.push(() => addPosted = true);
            service.toNotifyOnUpdate.push(() => updatePosted = true);
            service.toNotifyOnRemove.push(() => deletePosted = true);

            const redisClient = createClient(config.redisUrl, {
                password: config.redisPassword
            });

            redisClient.publish("new-quests", JSON.stringify(addMessage));
            redisClient.publish("quest-updates", JSON.stringify(updateMessage));
            redisClient.publish("removed-quests", JSON.stringify(deleteMessage));

            setTimeout(() => {
                console.log(`AddPosted value: ${addPosted}`);
                console.log(`UpdatePosted value: ${updatePosted}`);
                console.log(`DeletePosted value: ${deletePosted}`);
                expect(addPosted).to.be.true;
                expect(updatePosted).to.be.true;
                expect(deletePosted).to.be.true;
                redisClient.quit();
                service.disconnect();
                done();
            }, MESSAGE_AWAIT_TIME);
        }, DOCKER_STARTUP_TIME); // Give the redis container about 5 seconds to spin up
    }).timeout(DEFAULT_ASYNC_TIMEOUT);

    it("does not push messages on malformed JSON", (done) => {
        setTimeout(() => {
            const service = new RedisUpdaterService(config);
            let updateReceived = false;

            service.toNotifyOnAdd.push(() => updateReceived = true);
            service.toNotifyOnUpdate.push(() => updateReceived = true);
            service.toNotifyOnRemove.push(() => updateReceived = true);

            const redisClient = createClient(config.redisUrl, {
                password: config.redisPassword
            });

            redisClient.publish("new-quests", "not json", () => {
                console.log(`UpdateReceived value: ${updateReceived}`);
                expect(updateReceived).to.be.false;
                redisClient.quit();
                service.disconnect();
                done();
            });
        }, DOCKER_STARTUP_TIME);
    }).timeout(DEFAULT_ASYNC_TIMEOUT);
});



