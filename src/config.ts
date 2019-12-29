import * as dotenv from "dotenv";
import config from "../test/Util";

dotenv.config();

export interface Configuration {
    applicationPort: string | number
    redisUrl: string
    environment: string
    redisPassword?: string
}

if (!config.redisPassword) {
    throw new Error("No redis password found in env!");
}

