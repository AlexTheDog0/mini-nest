import "reflect-metadata";

import { randomUUID } from "node:crypto";
import type {
  IncomingMessage,
  RequestListener,
  ServerResponse,
} from "node:http";

import { Container, type Constructor } from "./container.js";
import { runWithRequestContext } from "./context/request-context.js";
import {
  PARAMS_METADATA,
  type ParamInstruction,
} from "./decorators/params.js";
import { InvalidJsonError } from "./errors/invalid-json.error.js";
import { NotFoundError } from "./errors/not-found.error.js";
import { ExceptionFilter } from "./filters/exception.filter.js";
import { ZodValidationPipe } from "./pipes/zod-validation.pipe.js";
import type {
  ErrorFilter,
  ExecutionContext,
  Guard,
  Interceptor,
  Middleware,
  Next,
  Pipe,
} from "./lifecycle.js";
import { findRoute, type Route } from "./router.js";
import { PARAM_TYPES_METADATA } from "./tokens.js";

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
  validationPipe: Pipe,
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

export type DispatcherOptions = {
  middleware?: Middleware[];
  guards?: Guard[];
  interceptors?: Interceptor[];
  pipe?: Pipe;
  exceptionFilter?: ErrorFilter;
};

function wrapWithInterceptors(
  context: ExecutionContext,
  interceptors: Interceptor[],
  handler: Next,
): Next {
  return interceptors.reduceRight<Next>(
    (next, interceptor) => () => interceptor.intercept(context, next),
    handler,
  );
}

function wrapWithMiddleware(
  context: ExecutionContext,
  middleware: Middleware[],
  lifecycle: Next,
): Next {
  return middleware.reduceRight<Next>(
    (next, currentMiddleware) => () =>
      currentMiddleware.use(context, next),
    lifecycle,
  );
}

export function createDispatcher(
  container: Container,
  routes: Route[],
  options: DispatcherOptions = {},
): RequestListener {
  const middleware = options.middleware ?? [];
  const guards = options.guards ?? [];
  const interceptors = options.interceptors ?? [];
  const validationPipe = options.pipe ?? new ZodValidationPipe();
  const exceptionFilter = options.exceptionFilter ?? new ExceptionFilter();

  return async (request, response) => {
    const requestIdHeader = request.headers["x-request-id"];
    const requestId =
      typeof requestIdHeader === "string" && requestIdHeader.trim().length > 0
        ? requestIdHeader
        : randomUUID();

    response.setHeader("x-request-id", requestId);

    await runWithRequestContext(requestId, async () => {
      try {
        const url = new URL(request.url ?? "/", "http://localhost");
        const match = findRoute(routes, request.method, url.pathname);

        if (match === undefined) {
          throw new NotFoundError(
            `Route ${request.method ?? "UNKNOWN"} ${url.pathname} not found`,
          );
        }

        const context: ExecutionContext = {
          request,
          response,
          routeMatch: match,
        };

        const executeRoute = async (): Promise<unknown> => {
          for (const guard of guards) {
            if (!(await guard.canActivate(context))) {
              sendJson(response, 403, { error: "Forbidden" });
              return undefined;
            }
          }

          const invokeHandler = async (): Promise<unknown> => {
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

            return handler.apply(controller, args);
          };

          return wrapWithInterceptors(
            context,
            interceptors,
            invokeHandler,
          )();
        };

        const result = await wrapWithMiddleware(
          context,
          middleware,
          executeRoute,
        )();
        if (!response.writableEnded) {
          sendJson(response, 200, result ?? null);
        }
      } catch (error) {
        exceptionFilter.catch(error, response);
      }
    });
  };
}
