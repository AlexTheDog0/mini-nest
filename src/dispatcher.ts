import "reflect-metadata";

import type {
  IncomingMessage,
  RequestListener,
  ServerResponse,
} from "node:http";

import { Container, type Constructor } from "./container.js";
import {
  PARAMS_METADATA,
  type ParamInstruction,
} from "./decorators/params.js";
import {
  ValidationPipe,
  ValidationPipeError,
} from "./pipes/validation.pipe.js";
import { findRoute, type Route } from "./router.js";
import { PARAM_TYPES_METADATA } from "./tokens.js";

class InvalidJsonError extends Error {
  constructor() {
    super("Invalid JSON body");
  }
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  value: unknown,
): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(value));
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return undefined;
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");

  if (rawBody.trim().length === 0) {
    return undefined;
  }

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    throw new InvalidJsonError();
  }
}

function getParameterInstructions(route: Route): ParamInstruction[] {
  return (
    (Reflect.getOwnMetadata(
      PARAMS_METADATA,
      route.controller.prototype,
      route.controllerHandlerName,
    ) as ParamInstruction[] | undefined) ?? []
  );
}

function getParameterTypes(route: Route): Constructor[] {
  return (
    (Reflect.getMetadata(
      PARAM_TYPES_METADATA,
      route.controller.prototype,
      route.controllerHandlerName,
    ) as Constructor[] | undefined) ?? []
  );
}

function isDtoConstructor(
  value: Constructor | undefined,
): value is Constructor {
  return (
    value !== undefined &&
    value !== Object &&
    value !== String &&
    value !== Number &&
    value !== Boolean &&
    value !== Array
  );
}

function buildArguments(
  instructions: ParamInstruction[],
  parameterTypes: Constructor[],
  params: Record<string, string>,
  searchParams: URLSearchParams,
  body: unknown,
  validationPipe: ValidationPipe,
): unknown[] {
  const args: unknown[] = [];

  for (const instruction of instructions) {
    if (instruction === undefined) {
      continue;
    }

    switch (instruction.source) {
      case "body": {
        const BodyDto = parameterTypes[instruction.index];
        args[instruction.index] = isDtoConstructor(BodyDto)
          ? validationPipe.transform(body, BodyDto)
          : body;
        break;
      }
      case "param":
        args[instruction.index] =
          instruction.name === undefined
            ? undefined
            : params[instruction.name];
        break;
      case "query":
        args[instruction.index] =
          instruction.name === undefined
            ? undefined
            : (searchParams.get(instruction.name) ?? undefined);
        break;
    }
  }

  return args;
}

export function createDispatcher(
  container: Container,
  routes: Route[],
  validationPipe = new ValidationPipe(),
): RequestListener {
  return async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      const match = findRoute(routes, request.method, url.pathname);

      if (match === undefined) {
        sendJson(response, 404, { error: "Route not found" });
        return;
      }

      const instructions = getParameterInstructions(match.route);
      const parameterTypes = getParameterTypes(match.route);
      const needsBody = instructions.some(
        (instruction) => instruction?.source === "body",
      );
      const body = needsBody ? await readJsonBody(request) : undefined;
      const args = buildArguments(
        instructions,
        parameterTypes,
        match.params,
        url.searchParams,
        body,
        validationPipe,
      );

      const controller = container.resolve(match.route.controller);
      const handler = Reflect.get(
        controller as object,
        match.route.controllerHandlerName,
      ) as unknown;

      if (typeof handler !== "function") {
        throw new Error(
          `Handler ${match.route.controllerHandlerName} is not a function`,
        );
      }

      const result = await handler.apply(controller, args);
      sendJson(response, 200, result ?? null);
    } catch (error) {
      if (error instanceof ValidationPipeError) {
        sendJson(response, 400, error.errors);
        return;
      }

      if (error instanceof InvalidJsonError) {
        sendJson(response, 400, { error: error.message });
        return;
      }

      sendJson(response, 500, { error: "Internal server error" });
    }
  };
}
