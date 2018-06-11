import * as express from "express";
import { Response } from "express";
import * as morgan from "morgan";
import * as log from "winston";
import config from "./config";
import cors from "./middleware/cors";
import addLoggingInfo from "./middleware/logging-metadata";
import jsonParse from "./middleware/json-parse";
import PushServiceClientController from "./controllers/ClientController";

const app = express();

app.use(cors);
app.use(morgan("common"));
app.use(jsonParse);
app.use(addLoggingInfo);

app.use("/push/", PushServiceClientController);

app.get("/", (_, res:Response) => {
    res.status(200).send("Hello, world!");
});

app.listen(config.applicationPort, () => log.info(`App is running on port ${config.applicationPort}!`));