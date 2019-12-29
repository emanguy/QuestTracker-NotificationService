import * as express from "express";
import {Response} from "express";
import * as morgan from "morgan";
import log from "./logger";
import addLoggingInfo from "./middleware/logging-metadata";
import jsonParse from "./middleware/json-parse";
import PushServiceClientController from "./controllers/ClientController";
import * as cors from "cors";
import config from "../test/Util";

const app = express();

if (config.environment !== "production") {
    app.use(cors());
}
app.use(morgan("common"));
app.use(jsonParse);
app.use(addLoggingInfo);

app.use("/push/", PushServiceClientController);

app.get("/", (_, res:Response) => {
    res.status(200).send(`Quest tracker notification service -- version ${process.env.npm_package_version}`);
});

app.listen(config.applicationPort, () => log.info(`App is running on port ${config.applicationPort}!`));
