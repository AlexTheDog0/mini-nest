import "reflect-metadata";

import {
  INJECTABLE_METADATA,
  INJECT_TOKENS_METADATA,
  PARAM_TYPES_METADATA,
  SCOPE_METADATA,
} from "./tokens.js";
import type { Scope } from "./decorators/injectable.js";
import type { InjectionToken } from "./tokens.js";

export type Constructor<T = unknown> = new (...args: any[]) => T;

export class Container {
  private readonly providers = new Map<InjectionToken, Constructor>();
  private readonly singletonInstances = new Map<Constructor, unknown>();

  register(token: InjectionToken, provider: Constructor): void {
    this.providers.set(token, provider);
  }

  resolve<T>(Target: Constructor<T>): T {
    return this.resolveWithPath(Target, new Set<Constructor>());
  }

  private resolveWithPath<T>(
    Target: Constructor<T>,
    path: Set<Constructor>,
  ): T {
    const isInjectable = Reflect.getOwnMetadata(
      INJECTABLE_METADATA,
      Target,
    );

    if (isInjectable !== true) {
      throw new Error(
        `The ${Target.name} is not injectable. Mark it as @Injectable()`,
      );
    }

    const scope =
      (Reflect.getOwnMetadata(SCOPE_METADATA, Target) as Scope | undefined) ??
      "singleton";
    const isSingleton = scope === "singleton";

    if (isSingleton && this.singletonInstances.has(Target)) {
      return this.singletonInstances.get(Target) as T;
    }

    if (path.has(Target)) {
      const chain = [...path, Target]
        .map((constructor) => constructor.name)
        .join(" -> ");

      throw new Error(`Circular dependency detected: ${chain}`);
    }

    const nextPath = new Set(path);
    nextPath.add(Target);

    const dependencyTypes =
      (Reflect.getMetadata(PARAM_TYPES_METADATA, Target) as
        | Constructor[]
        | undefined) ?? [];
    const injectTokens =
      (Reflect.getOwnMetadata(INJECT_TOKENS_METADATA, Target) as
        | Array<InjectionToken | undefined>
        | undefined) ?? [];

    const dependencyInstances = dependencyTypes.map(
      (dependencyType, parameterIndex) => {
        const explicitToken = injectTokens[parameterIndex];

        if (explicitToken === undefined) {
          return this.resolveWithPath(dependencyType, nextPath);
        }

        const provider = this.providers.get(explicitToken);

        if (provider === undefined) {
          throw new Error(
            `There is no provider for ${String(explicitToken)}`,
          );
        }

        return this.resolveWithPath(provider, nextPath);
      },
    );

    const instance = new Target(...dependencyInstances);

    if (isSingleton) {
      this.singletonInstances.set(Target, instance);
    }

    return instance;
  }
}
