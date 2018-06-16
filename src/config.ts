import * as dotenv from "dotenv";

dotenv.config();

export interface Configuration {
    applicationPort: string | number
    redisUrl: string
    redisPassword?: string
}
const config = {
    applicationPort: process.env["PROCESS_PORT"] || 80,
    redisUrl: process.env["REDIS_URL"] || "redis://localhost:6379",
    redisPassword: process.env["REDIS_PASSWORD"]
};

if (!config.redisPassword) {
    throw new Error("No redis password found in env!");
}

export default config;