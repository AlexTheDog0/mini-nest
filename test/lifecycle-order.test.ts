import "reflect-metadata";

import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { Container } from "../src/container.js";
import { Controller } from "../src/decorators/controller.js";
import { Injectable } from "../src/decorators/injectable.js";
import { Post } from "../src/decorators/methods.js";
import { Body } from "../src/decorators/params.js";
import { createDispatcher } from "../src/dispatcher.js";
import type {
  Guard,
  Interceptor,
  Middleware,
  Pipe,
} from "../src/lifecycle.js";
import { collectRoutes } from "../src/router.js";

test("executes the request lifecycle in the required order", async () => {
  const calls: string[] = [];

  class RequestDto {}

  @Controller("lifecycle")
  @Injectable()
  class LifecycleController {
    @Post("")
    handle(@Body() body: RequestDto) {
      calls.push("handler");
      return body;
    }
  }

  const middleware: Middleware = {
    async use(_context, next) {
      calls.push("middleware");
      return next();
    },
  };
  const guard: Guard = {
    canActivate() {
      calls.push("guard");
      return true;
    },
  };
  const interceptor: Interceptor = {
    async intercept(_context, next) {
      calls.push("interceptor:before");
      const result = await next();
      calls.push("interceptor:after");
      return result;
    },
  };
  const pipe: Pipe = {
    transform(value) {
      calls.push("pipe");
      return value;
    },
  };

  const container = new Container();
  const routes = collectRoutes([LifecycleController]);
  const server = createServer(
    createDispatcher(container, routes, {
      middleware: [middleware],
      guards: [guard],
      interceptors: [interceptor],
      pipe,
    }),
  );

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  try {
    const address = server.address() as AddressInfo;
    const response = await fetch(
      `http://127.0.0.1:${address.port}/lifecycle`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value: "test" }),
      },
    );

    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(calls, [
      "middleware",
      "guard",
      "interceptor:before",
      "pipe",
      "handler",
      "interceptor:after",
    ]);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
});
