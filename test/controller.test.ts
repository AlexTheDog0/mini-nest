import assert from "node:assert/strict";
import test from "node:test";
import {
  Controller,
  CONTROLLER_PREFIX_METADATA,
} from "../src/decorators/controller.js";
import 'reflect-metadata';

@Controller('users')
class TestClass {}

test('get prefix from test class', () => {
    const controllerMetadata = Reflect.getMetadata(
      CONTROLLER_PREFIX_METADATA,
      TestClass,
    );

    assert.strictEqual(controllerMetadata,'users');
})