import { Request, Response, NextFunction } from "express";
import * as bodyparser from "body-parser";

const jsonParserMiddleware = bodyparser.json();

export default function(req:Request, res:Response, next:NextFunction) {
    if (req.method === "PUT" || req.method === "POST" || req.method === "PATCH") {
        jsonParserMiddleware(req, res, next);
    }
    else {
        next();
    }
};