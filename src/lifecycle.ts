import type { IncomingMessage, ServerResponse } from "node:http";

import type { RouteMatch } from "./router.js";

export type ExecutionContext = {
  request: IncomingMessage;
  response: ServerResponse;
  routeMatch: RouteMatch;
};

export type Next = () => Promise<unknown>;

export interface Middleware {
  use(context: ExecutionContext, next: Next): Promise<unknown>;
}

export interface Guard {
  canActivate(context: ExecutionContext): boolean | Promise<boolean>;
}

export interface Interceptor {
  intercept(context: ExecutionContext, next: Next): Promise<unknown>;
}

export interface Pipe {
  transform(value: unknown, target: new (...args: any[]) => unknown): unknown;
}

export interface ErrorFilter {
  catch(error: unknown, response: ServerResponse): void;
}
