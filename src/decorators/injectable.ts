import { INJECTABLE_METADATA, SCOPE_METADATA } from "../tokens.js";

export type Scope = "singleton" | "transient";

export interface InjectableOptions {
  scope?: Scope;
}

export function Injectable(options: InjectableOptions = {}): ClassDecorator {
  const scope = options.scope ?? "singleton";

  return (target) => {
    Reflect.defineMetadata(INJECTABLE_METADATA, true, target);
    Reflect.defineMetadata(SCOPE_METADATA, scope, target);
  };
}
