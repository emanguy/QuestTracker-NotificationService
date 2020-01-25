import {Response, Router} from "express";
import redisServiceRetriever from "../services/RedisUpdaterService";
import config from "../config";
import * as asyncHandler from "express-async-handler";
import {WinstonRequest} from "../middleware/logging-metadata";
import * as HttpStatus from "http-status-codes";

const healthRestController = Router();
const redisService = redisServiceRetriever(config);

healthRestController.get("/", asyncHandler(async (req: WinstonRequest, res: Response) => {
    const connected = await redisService.sendTestMessage();

    if (connected) {
        res.sendStatus(HttpStatus.OK);
    } else {
        res.sendStatus(HttpStatus.INTERNAL_SERVER_ERROR);
    }
}));

export default healthRestController;
