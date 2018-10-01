import {Response, Router} from "express";
import {WinstonRequest} from "../middleware/logging-metadata";
import log from "../logger";
import pushServiceRetriever from "../services/PushService";

const clientRestController = Router();
const pushService = pushServiceRetriever();

clientRestController.get("/", (req:WinstonRequest, res:Response) => {
    log.info("Hit base url.", req.winstonMetadata);
    res.status(200).send("Hello world!").end();
});

clientRestController.get("/register", (req:WinstonRequest, res:Response) => {
    log.info("Registered new client.", req.winstonMetadata);
    pushService.addClient(req, res);
});

export default clientRestController;