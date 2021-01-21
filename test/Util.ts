import * as Docker from "dockerode";
import {ContainerCreateOptions} from "dockerode";
import {Configuration} from "../src/config";

interface HostPortBinding {
    HostPort: string
}

interface CreateOptionsWithPortBindings extends ContainerCreateOptions {
    PortBindings: {
        [key: string]: HostPortBinding[]
    }
}

const redisPort = "6379";

export const testConfig: Configuration = {
    applicationPort: 3000,
    redisUrl: `redis://127.0.0.1:${redisPort}`,
    environment: "testing",
    redisPassword: "testRedis"
};

export function createRedisContainer(docker: Docker): Promise<Docker.Container> {
    return docker.createContainer(<CreateOptionsWithPortBindings>{
        Image: "bitnami/redis:4.0.9",
        Env: [
            `REDIS_PASSWORD=${testConfig.redisPassword}`
        ],
        PortBindings: {
            "6379/tcp": [{HostPort: redisPort}]
        }
    });
}

export function pullRedisImage(docker: Docker): Promise<void> {
    return new Promise((resolve, reject) => {
        docker.pull("bitnami/redis:4.0.9", {}, (err, stream) => {
            if (err) {
                console.log("Got an error pulling the image.");
                reject(err);
                return;
            }

            docker.modem.followProgress(stream, (err?: Error) => err ? reject(err) : resolve(), () => {});
        });
    });
}
