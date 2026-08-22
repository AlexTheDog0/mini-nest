import type { ServerResponse } from "node:http";

import { InvalidJsonError } from "../errors/invalid-json.error.js";
import { NotFoundError } from "../errors/not-found.error.js";
import type { ErrorFilter } from "../lifecycle.js";
import { ValidationError } from "../pipes/zod-validation.pipe.js";

function sendJson(
  response: ServerResponse,
  statusCode: number,
  value: unknown,
): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(value));
}

export class ExceptionFilter implements ErrorFilter {
  catch(error: unknown, response: ServerResponse): void {
    if (response.writableEnded) {
      return;
    }

    if (error instanceof NotFoundError) {
      sendJson(response, 404, { error: error.message });
      return;
    }

    if (error instanceof ValidationError) {
      sendJson(response, 400, error.errors);
      return;
    }

    if (error instanceof InvalidJsonError) {
      sendJson(response, 400, { error: error.message });
      return;
    }

    sendJson(response, 500, { error: "Internal server error" });
  }
}
