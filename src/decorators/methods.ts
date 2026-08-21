export const METHOD_METADATA = Symbol("METHOD_METADATA");

export type HttpMethod = 'GET' | 'POST';

export type MethodMetadata = {
  method: HttpMethod;
  path: string;
};

function createMethodDecorator(
  method: HttpMethod,
  path: string,
): MethodDecorator {
  return function (target, propertyKey) {
    const methodMetadata: MethodMetadata = {
      method,
      path,
    };

    Reflect.defineMetadata(
      METHOD_METADATA,
      methodMetadata,
      target,
      propertyKey,
    );
  };
}

export function Get(path: string): MethodDecorator {
    return createMethodDecorator("GET", path);
}

export function Post(path: string): MethodDecorator {
    return createMethodDecorator("POST", path);
}