import {afterEach, beforeEach, it, suite} from "mocha";
import {expect} from "chai";
import * as Docker from "dockerode";
import {Container} from "dockerode";
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
import {createRedisContainer, pullRedisImage, testConfig} from "../Util";
import sleep = require("sleep-promise");

suite("Redis updater service test", () => {
    let container:Container;
    let docker = new Docker();
    let containersToDelete:Container[] = [];
    const DOCKER_STARTUP_TIME = 7000;
    const MESSAGE_AWAIT_TIME = 500;
    const DEFAULT_ASYNC_TIMEOUT = 20000;

    suite("With Redis", () => {
        before(async function() {
            this.timeout(30000);

            await pullRedisImage(docker);
        });

        beforeEach(async function ()  {
            this.timeout(DEFAULT_ASYNC_TIMEOUT);

            container = await createRedisContainer(docker);

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
                const service = new RedisUpdaterService(testConfig);
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

                const redisClient = createClient(testConfig.redisUrl, {
                    password: testConfig.redisPassword
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
                const service = new RedisUpdaterService(testConfig);
                let updateReceived = false;

                service.toNotifyOnAdd.push(() => updateReceived = true);
                service.toNotifyOnUpdate.push(() => updateReceived = true);
                service.toNotifyOnRemove.push(() => updateReceived = true);

                const redisClient = createClient(testConfig.redisUrl, {
                    password: testConfig.redisPassword
                });

                redisClient.publish("new-quests", "not json", async () => {
                    console.log(`UpdateReceived value: ${updateReceived}`);
                    await sleep(MESSAGE_AWAIT_TIME);
                    expect(updateReceived).to.be.false;
                    redisClient.quit();
                    service.disconnect();
                    done();
                });
            }, DOCKER_STARTUP_TIME);
        }).timeout(DEFAULT_ASYNC_TIMEOUT);

        it("can verify its connection to redis", (done) => {
            setTimeout(async () => {
                const service = new RedisUpdaterService(testConfig);
                await sleep(MESSAGE_AWAIT_TIME);
                const connectionStatus = await service.sendTestMessage();
                try {
                    expect(connectionStatus).to.be.true;
                    done();
                } catch(err) {
                    done(err);
                } finally {
                    service.disconnect();
                }
            }, DOCKER_STARTUP_TIME);
        }).timeout(DEFAULT_ASYNC_TIMEOUT);
    });

    suite("Without Redis", () => {
        it("fails connection test without redis", async () => {
            // Get container
            await pullRedisImage(docker);
            // Start container
            const redisContainer = await createRedisContainer(docker);
            await redisContainer.start();
            // Wait for container to start
            await sleep(DOCKER_STARTUP_TIME);
            // Start the redis service
            const service = new RedisUpdaterService(testConfig);
            // Stop & remove the container
            await redisContainer.stop();
            await redisContainer.remove();
            await sleep(1000);

            // Verify the test shows we aren't connected to docker
            expect(await service.sendTestMessage()).to.be.false;

            // We know disconnect will throw an error because redis is stopped so we'll just swallow the error
            try {
                service.disconnect();
            } catch (err) {
                // It's ok!
            }
        }).timeout(DEFAULT_ASYNC_TIMEOUT * 2);
    });
});



