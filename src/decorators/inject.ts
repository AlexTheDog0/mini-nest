import { INJECT_TOKENS_METADATA } from "../tokens.js";
import type { InjectionToken } from "../tokens.js";

export function Inject(token: InjectionToken): ParameterDecorator {
  return (target, _propertyKey, parameterIndex) => {
    const tokens =
      (Reflect.getOwnMetadata(INJECT_TOKENS_METADATA, target) as
        | Array<InjectionToken | undefined>
        | undefined) ?? [];

    tokens[parameterIndex] = token;
    Reflect.defineMetadata(INJECT_TOKENS_METADATA, tokens, target);
  };
}
