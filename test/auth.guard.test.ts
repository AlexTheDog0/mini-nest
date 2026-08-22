import "reflect-metadata";

import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { Container } from "../src/container.js";
import { Controller } from "../src/decorators/controller.js";
import { Get } from "../src/decorators/methods.js";
import { Injectable } from "../src/decorators/injectable.js";
import { createDispatcher } from "../src/dispatcher.js";
import { AuthGuard } from "../src/guards/auth.guard.js";
import { collectRoutes } from "../src/router.js";

test("AuthGuard blocks unauthorized requests before the handler", async () => {
  @Controller("protected")
  @Injectable()
  class ProtectedController {
    handlerCalls = 0;

    @Get("")
    getProtectedResource() {
      this.handlerCalls += 1;
      return { protected: true };
    }
  }

  const container = new Container();
  const controller = container.resolve(ProtectedController);
  const routes = collectRoutes([ProtectedController]);
  const server = createServer(
    createDispatcher(container, routes, {
      guards: [new AuthGuard()],
    }),
  );

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  try {
    const address = server.address() as AddressInfo;
    const url = `http://127.0.0.1:${address.port}/protected`;

    const unauthorizedResponse = await fetch(url);

    assert.strictEqual(unauthorizedResponse.status, 403);
    assert.deepStrictEqual(await unauthorizedResponse.json(), {
      error: "Forbidden",
    });
    assert.strictEqual(controller.handlerCalls, 0);

    const authorizedResponse = await fetch(url, {
      headers: { authorization: "Bearer test-token" },
    });

    assert.strictEqual(authorizedResponse.status, 200);
    assert.deepStrictEqual(await authorizedResponse.json(), {
      protected: true,
    });
    assert.strictEqual(controller.handlerCalls, 1);
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
