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
import { collectRoutes } from "../src/router.js";
import { RequestService } from "../src/services/request.service.js";

test("keeps request ids isolated across concurrent requests", async () => {
  @Controller("context")
  @Injectable()
  class ContextController {
    constructor(private readonly requestService: RequestService) {}

    @Get("")
    async getRequestContext() {
      return {
        requestId: await this.requestService.readContextAfterDelay(),
      };
    }
  }

  const logs: string[] = [];
  const originalConsoleLog = console.log;
  const container = new Container();
  const routes = collectRoutes([ContextController]);
  const server = createServer(createDispatcher(container, routes));

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  console.log = (...values: unknown[]) => {
    logs.push(values.map(String).join(" "));
  };

  try {
    const address = server.address() as AddressInfo;
    const url = `http://127.0.0.1:${address.port}/context`;
    const expectedRequestIds = Array.from(
      { length: 10 },
      (_, index) => `request-${index}`,
    );

    const results = await Promise.all(
      expectedRequestIds.map(async (expectedRequestId) => {
        const response = await fetch(url, {
          headers: { "x-request-id": expectedRequestId },
        });

        return {
          status: response.status,
          responseRequestId: response.headers.get("x-request-id"),
          body: (await response.json()) as { requestId: string },
        };
      }),
    );

    results.forEach((result, index) => {
      const expectedRequestId = expectedRequestIds[index];
      assert.strictEqual(result.status, 200);
      assert.strictEqual(result.responseRequestId, expectedRequestId);
      assert.strictEqual(result.body.requestId, expectedRequestId);
    });

    assert.deepStrictEqual(
      [...logs].sort(),
      expectedRequestIds
        .map((requestId) => `requestId=${requestId}`)
        .sort(),
    );

    const generatedIdResponse = await fetch(url);
    const generatedId = generatedIdResponse.headers.get("x-request-id");
    const generatedIdBody = (await generatedIdResponse.json()) as {
      requestId: string;
    };

    assert.ok(generatedId);
    assert.strictEqual(generatedIdBody.requestId, generatedId);
  } finally {
    console.log = originalConsoleLog;
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
