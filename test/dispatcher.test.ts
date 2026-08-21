import "reflect-metadata";

import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { Container } from "../src/container.js";
import { Controller } from "../src/decorators/controller.js";
import { Injectable } from "../src/decorators/injectable.js";
import { Get, Post } from "../src/decorators/methods.js";
import { Body, Param, Query } from "../src/decorators/params.js";
import { createDispatcher } from "../src/dispatcher.js";
import { CreateUserDto } from "../src/dto/create-user.dto.js";
import { collectRoutes } from "../src/router.js";

test("dispatches HTTP requests using route and parameter metadata", async () => {
  @Injectable()
  class UserService {}

  @Controller("users")
  @Injectable()
  class UsersController {
    requestCount = 0;
    receivedBody: CreateUserDto | undefined;

    constructor(readonly userService: UserService) {}

    @Get(":id")
    findOne(
      @Param("id") id: string,
      @Query("limit") limit: string | undefined,
    ) {
      this.requestCount += 1;
      return { id, limit };
    }

    @Get("")
    findAll(@Query("limit") limit: string | undefined) {
      this.requestCount += 1;
      return { limit };
    }

    @Post("")
    create(@Body() body: CreateUserDto) {
      this.requestCount += 1;
      this.receivedBody = body;
      return { body };
    }
  }

  const container = new Container();
  const controller = container.resolve(UsersController);
  const routes = collectRoutes([UsersController]);
  const server = createServer(createDispatcher(container, routes));

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  try {
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const getResponse = await fetch(`${baseUrl}/users/42?limit=5`);
    assert.strictEqual(getResponse.status, 200);
    assert.deepStrictEqual(await getResponse.json(), {
      id: "42",
      limit: "5",
    });

    const queryResponse = await fetch(`${baseUrl}/users?limit=5`);
    assert.strictEqual(queryResponse.status, 200);
    assert.deepStrictEqual(await queryResponse.json(), { limit: "5" });

    const requestBody = { email: "user@example.com" };
    const postResponse = await fetch(`${baseUrl}/users`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    assert.strictEqual(postResponse.status, 200);
    assert.deepStrictEqual(await postResponse.json(), { body: requestBody });
    assert.ok(controller.receivedBody instanceof CreateUserDto);
    assert.strictEqual(controller.receivedBody.email, requestBody.email);

    assert.strictEqual(container.resolve(UsersController), controller);
    const userService = container.resolve(UserService);
    assert.strictEqual(controller.userService, userService);
    assert.strictEqual(container.resolve(UserService), userService);
    assert.strictEqual(controller.requestCount, 3);

    const invalidDtoResponse = await fetch(`${baseUrl}/users`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "not-an-email" }),
    });
    assert.strictEqual(invalidDtoResponse.status, 400);
    assert.deepStrictEqual(await invalidDtoResponse.json(), [
      {
        field: "email",
        constraints: ["must be a valid email address"],
      },
    ]);

    const invalidJsonResponse = await fetch(`${baseUrl}/users`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{invalid",
    });
    assert.strictEqual(invalidJsonResponse.status, 400);
    assert.deepStrictEqual(await invalidJsonResponse.json(), {
      error: "Invalid JSON body",
    });

    const missingRouteResponse = await fetch(`${baseUrl}/missing`);
    assert.strictEqual(missingRouteResponse.status, 404);
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
