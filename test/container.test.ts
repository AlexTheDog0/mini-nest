import "reflect-metadata";

import assert from "node:assert/strict";
import test from "node:test";

import { Container } from "../src/container.js";
import { Inject } from "../src/decorators/inject.js";
import { Injectable } from "../src/decorators/injectable.js";

test("resolves a dependency graph from design:paramtypes", () => {
  @Injectable()
  class Database {}

  @Injectable()
  class Repository {
    constructor(public readonly database: Database) {}
  }

  @Injectable()
  class UserService {
    constructor(public readonly repository: Repository) {}
  }

  const service = new Container().resolve(UserService);

  assert.ok(service instanceof UserService);
  assert.ok(service.repository instanceof Repository);
  assert.ok(service.repository.database instanceof Database);
});

test("returns the same instance for the default singleton scope", () => {
  @Injectable()
  class SingletonService {}

  const container = new Container();

  assert.strictEqual(
    container.resolve(SingletonService),
    container.resolve(SingletonService),
  );
});

test("returns different instances for the transient scope", () => {
  @Injectable({ scope: "transient" })
  class TransientService {}

  const container = new Container();

  assert.notStrictEqual(
    container.resolve(TransientService),
    container.resolve(TransientService),
  );
});

test("reports the complete circular dependency chain", () => {
  const A_TOKEN = Symbol("A_TOKEN");
  const B_TOKEN = Symbol("B_TOKEN");

  interface ADependency {}
  interface BDependency {}

  @Injectable()
  class ServiceA {
    constructor(@Inject(B_TOKEN) public readonly dependency: BDependency) {}
  }

  @Injectable()
  class ServiceB {
    constructor(@Inject(A_TOKEN) public readonly dependency: ADependency) {}
  }

  const container = new Container();
  container.register(A_TOKEN, ServiceA);
  container.register(B_TOKEN, ServiceB);

  assert.throws(
    () => container.resolve(ServiceA),
    /Circular dependency detected: ServiceA -> ServiceB -> ServiceA/,
  );
});

test("resolves an explicit injection token", () => {
  const CONFIG_TOKEN = Symbol.for("CONFIG");

  interface Config {
    environment: string;
  }

  @Injectable()
  class AppConfig implements Config {
    readonly environment = "test";
  }

  @Injectable()
  class ConfigConsumer {
    constructor(
      @Inject(CONFIG_TOKEN) public readonly config: Config,
    ) {}
  }

  const container = new Container();
  container.register(CONFIG_TOKEN, AppConfig);

  const consumer = container.resolve(ConfigConsumer);

  assert.ok(consumer.config instanceof AppConfig);
  assert.equal(consumer.config.environment, "test");
});

test("rejects a class that is not marked as injectable", () => {
  class UndecoratedService {}

  assert.throws(
    () => new Container().resolve(UndecoratedService),
    /The UndecoratedService is not injectable\. Mark it as @Injectable\(\)/,
  );
});

test("reports an unregistered injection token", () => {
  const MISSING_TOKEN = Symbol("MISSING_TOKEN");

  interface MissingDependency {}

  @Injectable()
  class NeedsMissingProvider {
    constructor(
      @Inject(MISSING_TOKEN) public readonly dependency: MissingDependency,
    ) {}
  }

  assert.throws(
    () => new Container().resolve(NeedsMissingProvider),
    /There is no provider for Symbol\(MISSING_TOKEN\)/,
  );
});
