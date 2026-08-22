import "reflect-metadata";

import type { ZodType } from 'zod';

import type { Constructor } from "../container.js";

export type ValidationErrorDetail = {
  field: string;
  constraints: string[];
};

export class ValidationError extends Error {
  constructor(readonly errors: ValidationErrorDetail[]) {
    super("Validation failed");
  }
}

const ZOD_SCHEMA_METADATA = Symbol("ZOD_SCHEMA_METADATA");

export function UseZodSchema<T>(schema: ZodType<T>): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(ZOD_SCHEMA_METADATA, schema, target);
  };
}

export class ZodValidationPipe {
  transform(value: unknown, Target: Constructor): unknown {
    const schema = Reflect.getOwnMetadata(
      ZOD_SCHEMA_METADATA,
      Target,
    ) as ZodType<unknown> | undefined;

    if (schema === undefined) {
      throw new Error(`No Zod schema registered for ${Target.name}`);
    }

    const result = schema.safeParse(value);

    if (!result.success) {
      const errorsByField = new Map<string, string[]>();

      for (const issue of result.error.issues) {
        const field = issue.path.map(String).join(".") || "body";
        const constraints = errorsByField.get(field) ?? [];
        constraints.push(issue.message);
        errorsByField.set(field, constraints);
      }

      throw new ValidationError(
        [...errorsByField].map(([field, constraints]) => ({
          field,
          constraints,
        })),
      );
    }

    if (
      typeof result.data !== "object" ||
      result.data === null ||
      Array.isArray(result.data)
    ) {
      throw new Error(`Zod schema for ${Target.name} must return an object`);
    }

    return Object.assign(new Target() as object, result.data);
  }
}
