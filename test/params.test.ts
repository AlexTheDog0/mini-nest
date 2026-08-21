import assert from "node:assert/strict";
import test from "node:test";
import {
  Query,
  Body,
  Param,
  PARAMS_METADATA,
} from "../src/decorators/params.js";
import 'reflect-metadata';

import type { ParamInstruction } from "../src/decorators/params.js";

class TestController {
  testMethod(
    @Query("notify") notify: boolean,
    @Param("id") id: number,
    @Body() body: unknown,
  ) {}
}

test('Reading params metadata', () => {
    const metadata: ParamInstruction[] =
      Reflect.getMetadata(
        PARAMS_METADATA,
        TestController.prototype,
        "testMethod",
      ) ?? [];

    assert.deepStrictEqual(metadata, [
      {
        name: "notify",
        source: "query",
        index: 0,
      },
      {
        name: "id",
        source: "param",
        index: 1,
      },
      {
        name: undefined,
        source: "body",
        index: 2,
      },
    ]);
})