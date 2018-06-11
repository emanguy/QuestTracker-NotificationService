import { Router, Response } from "express";
import { WinstonRequest } from "../middleware/logging-metadata";
import * as log from "winston";
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

clientRestController.post("/newObject", (req:WinstonRequest, res:Response) => {
    log.info("New object now being sent to client.", req.winstonMetadata);
    pushService.addNewItem(req.body);
    res.status(201).end();
});

export default clientRestController;