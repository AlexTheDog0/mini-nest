import assert from "node:assert/strict";
import test from "node:test";
import { Get,Post, METHOD_METADATA} from "../src/decorators/methods.js";
import type { MethodMetadata } from '../src/decorators/methods.js'
import 'reflect-metadata'

class TestClass {
    @Get('/:id')
    getMethod(){}

    @Post('/add')
    postMethod() {}
}

test('get methods metadata', () => {
    const prototype = TestClass.prototype;
    let routesMetadata: MethodMetadata[] = [];

    for (const methodName of Object.getOwnPropertyNames(prototype)) {
      if (methodName === "constructor") {
        continue;
      }

        routesMetadata.push(Reflect.getMetadata(
          METHOD_METADATA,
          prototype,
          methodName,
        ));
    }

    assert.deepStrictEqual(routesMetadata, [
      { method: "GET", path: "/:id" },
      { method: "POST", path: "/add" },
    ]);
})