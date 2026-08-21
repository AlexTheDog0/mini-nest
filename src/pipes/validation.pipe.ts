import "reflect-metadata";

import type { Constructor } from "../container.js";

type ValidationRule = {
  constraint: string;
  isValid: (value: unknown) => boolean;
};

type PropertyValidation = {
  field: string;
  rules: ValidationRule[];
};

export type ValidationErrorDetail = {
  field: string;
  constraints: string[];
};

const VALIDATION_RULES_METADATA = Symbol("VALIDATION_RULES_METADATA");

function addValidationRule(rule: ValidationRule): PropertyDecorator {
  return (target, propertyKey) => {
    const dto = target.constructor;
    const validations =
      (Reflect.getOwnMetadata(
        VALIDATION_RULES_METADATA,
        dto,
      ) as PropertyValidation[] | undefined) ?? [];
    const field = String(propertyKey);
    const existingValidation = validations.find(
      (validation) => validation.field === field,
    );

    if (existingValidation === undefined) {
      validations.push({ field, rules: [rule] });
    } else {
      existingValidation.rules.push(rule);
    }

    Reflect.defineMetadata(VALIDATION_RULES_METADATA, validations, dto);
  };
}

export function IsEmail(): PropertyDecorator {
  return addValidationRule({
    constraint: "must be a valid email address",
    isValid: (value) =>
      typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
  });
}

export class ValidationPipeError extends Error {
  constructor(readonly errors: ValidationErrorDetail[]) {
    super("Validation failed");
  }
}

export class ValidationPipe {
  transform<T>(value: unknown, Dto: Constructor<T>): T {
    const instance = new Dto();

    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      for (const [key, propertyValue] of Object.entries(value)) {
        if (key === "__proto__" || key === "prototype" || key === "constructor") {
          continue;
        }

        Reflect.set(instance as object, key, propertyValue);
      }
    }

    const validations =
      (Reflect.getMetadata(
        VALIDATION_RULES_METADATA,
        Dto,
      ) as PropertyValidation[] | undefined) ?? [];
    const errors: ValidationErrorDetail[] = [];

    for (const validation of validations) {
      const propertyValue = Reflect.get(instance as object, validation.field);
      const constraints = validation.rules
        .filter((rule) => !rule.isValid(propertyValue))
        .map((rule) => rule.constraint);

      if (constraints.length > 0) {
        errors.push({ field: validation.field, constraints });
      }
    }

    if (errors.length > 0) {
      throw new ValidationPipeError(errors);
    }

    return instance;
  }
}
