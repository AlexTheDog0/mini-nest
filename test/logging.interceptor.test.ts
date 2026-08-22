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
import { LoggingInterceptor } from "../src/interceptors/logging.interceptor.js";
import { collectRoutes } from "../src/router.js";

test("LoggingInterceptor logs the route and request duration", async () => {
  @Controller("timed")
  @Injectable()
  class TimedController {
    @Get("")
    getTimedResource() {
      return { timed: true };
    }
  }

  const logs: string[] = [];
  const interceptor = new LoggingInterceptor((message) => {
    logs.push(message);
  });
  const container = new Container();
  const routes = collectRoutes([TimedController]);
  const server = createServer(
    createDispatcher(container, routes, {
      interceptors: [interceptor],
    }),
  );

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  try {
    const address = server.address() as AddressInfo;
    const response = await fetch(
      `http://127.0.0.1:${address.port}/timed?source=test`,
    );

    assert.strictEqual(response.status, 200);
    assert.strictEqual(logs.length, 1);
    assert.match(logs[0], /^GET \/timed — [0-9]+(?:\.[0-9]+)? ms$/);
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
