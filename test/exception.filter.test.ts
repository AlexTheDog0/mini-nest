import "reflect-metadata";

import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { Container } from "../src/container.js";
import { Controller } from "../src/decorators/controller.js";
import { Injectable } from "../src/decorators/injectable.js";
import { Get } from "../src/decorators/methods.js";
import { createDispatcher } from "../src/dispatcher.js";
import { NotFoundError } from "../src/errors/not-found.error.js";
import type { Interceptor } from "../src/lifecycle.js";
import { collectRoutes } from "../src/router.js";

test("ExceptionFilter maps known errors and hides unexpected errors", async () => {
  @Controller("errors")
  @Injectable()
  class ErrorController {
    @Get("missing")
    missing(): never {
      throw new NotFoundError("User 42 was not found");
    }

    @Get("boom")
    boom(): never {
      throw new Error("boom");
    }

    @Get("interceptor")
    intercepted() {
      return { unreachable: true };
    }
  }

  const throwingInterceptor: Interceptor = {
    async intercept(context, next) {
      if (context.routeMatch.route.path === "/errors/interceptor") {
        throw new Error("interceptor secret");
      }

      return next();
    },
  };
  const container = new Container();
  const routes = collectRoutes([ErrorController]);
  const server = createServer(
    createDispatcher(container, routes, {
      interceptors: [throwingInterceptor],
    }),
  );

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  try {
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}/errors`;

    const notFoundResponse = await fetch(`${baseUrl}/missing`);
    assert.strictEqual(notFoundResponse.status, 404);
    assert.deepStrictEqual(await notFoundResponse.json(), {
      error: "User 42 was not found",
    });

    const unexpectedResponse = await fetch(`${baseUrl}/boom`);
    const unexpectedBody = await unexpectedResponse.text();
    assert.strictEqual(unexpectedResponse.status, 500);
    assert.doesNotMatch(unexpectedBody, /boom|at .*\.ts:/);
    assert.deepStrictEqual(JSON.parse(unexpectedBody), {
      error: "Internal server error",
    });

    const interceptorResponse = await fetch(`${baseUrl}/interceptor`);
    const interceptorBody = await interceptorResponse.text();
    assert.strictEqual(interceptorResponse.status, 500);
    assert.doesNotMatch(interceptorBody, /interceptor secret|at .*\.ts:/);
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
