import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { Controller } from "../src/decorators/controller.js";
import { Get, Post } from "../src/decorators/methods.js";
import {
  collectRoutes,
  concatFullRoute,
  findRoute,
  matchPath,
} from "../src/router.js";
import type { Route } from "../src/router.js";

test('test route concatination', () => {
  assert.strictEqual(concatFullRoute("users", ":id"), "/users/:id" , '#1');
  assert.strictEqual(concatFullRoute("/users/", "/:id"), "/users/:id", "#2");
  assert.strictEqual(concatFullRoute("users", ""), "/users", "#3");
  assert.strictEqual(concatFullRoute("", ""), "/", "#4");
  assert.strictEqual(concatFullRoute("", "health"), "/health", "#5");
  assert.strictEqual(
    concatFullRoute("api/v1", "user/:id"),
    "/api/v1/user/:id",
    "#6",
  );
  assert.strictEqual(concatFullRoute("/users///"), "/users", "#7"); 
  assert.strictEqual(concatFullRoute("///"), "/", "#8"); 
})

test("collects decorated controller methods and skips unrelated classes and methods", () => {
  @Controller("users")
  class UsersController {
    @Get("/:id")
    findOne() {}

    helper() {}
  }

  @Controller("")
  class RootController {
    @Post("health")
    health() {}
  }

  class UndecoratedController {
    @Get("ignored")
    ignored() {}
  }

  const routes = collectRoutes([
    UsersController,
    RootController,
    UndecoratedController,
  ]);

  assert.deepStrictEqual(routes, [
    {
      method: "GET",
      path: "/users/:id",
      controller: UsersController,
      controllerHandlerName: "findOne",
    },
    {
      method: "POST",
      path: "/health",
      controller: RootController,
      controllerHandlerName: "health",
    },
  ]);
});

test("matches an exact static path without parameters", () => {
  assert.deepStrictEqual(matchPath("/users", "/users"), {});
});

test("extracts a named parameter from a dynamic path segment", () => {
  assert.deepStrictEqual(matchPath("/users/:id", "/users/42"), {
    id: "42",
  });
});

test("extracts multiple named parameters", () => {
  assert.deepStrictEqual(
    matchPath("/users/:userId/posts/:postId", "/users/42/posts/7"),
    {
      userId: "42",
      postId: "7",
    },
  );
});

test("does not match a different static segment", () => {
  assert.strictEqual(matchPath("/users/:id", "/posts/42"), undefined);
});

test("does not match when the request has fewer segments", () => {
  assert.strictEqual(matchPath("/users/:id", "/users"), undefined);
});

test("does not match when the request has extra segments", () => {
  assert.strictEqual(
    matchPath("/users/:id", "/users/42/details"),
    undefined,
  );
});

test("finds a route by HTTP method and pathname and returns path params", () => {
  class UsersController {}

  const route: Route = {
    method: "GET",
    path: "/users/:id",
    controller: UsersController,
    controllerHandlerName: "findOne",
  };

  assert.deepStrictEqual(findRoute([route], "GET", "/users/42"), {
    route,
    params: { id: "42" },
  });
});

test("does not find a route with a different HTTP method", () => {
  class UsersController {}

  const route: Route = {
    method: "GET",
    path: "/users/:id",
    controller: UsersController,
    controllerHandlerName: "findOne",
  };

  assert.strictEqual(findRoute([route], "POST", "/users/42"), undefined);
});

test("does not find a route with a different pathname", () => {
  class UsersController {}

  const route: Route = {
    method: "GET",
    path: "/users/:id",
    controller: UsersController,
    controllerHandlerName: "findOne",
  };

  assert.strictEqual(findRoute([route], "GET", "/posts/42"), undefined);
});
