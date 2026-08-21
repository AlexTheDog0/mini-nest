import { Constructor } from "./container";
import { CONTROLLER_PREFIX_METADATA } from "./decorators/controller";
import { HttpMethod, METHOD_METADATA, MethodMetadata} from "./decorators/methods";

export type Route = {
    method: HttpMethod,
    path: string,
    controller: Constructor,
    controllerHandlerName: string,
}

export type PathParams = Record<string, string>;

export type RouteMatch = {
  route: Route;
  params: PathParams;
};

export function concatFullRoute(prefix: string = "", path: string = ""): string {
  const segments = [prefix, path]
    .map((segment) => segment.replace(/^\/+|\/+$/g, ""))
    .filter((segment) => segment.length > 0);

  return `/${segments.join("/")}`;
}

export function matchPath(
  routePath: string,
  requestPath: string,
): PathParams | undefined {
  const toSegments = (value: string): string[] => {
    const normalized = value.replace(/^\/+|\/+$/g, "");
    return normalized.length === 0 ? [] : normalized.split("/");
  };

  const routeSegments = toSegments(routePath);
  const requestSegments = toSegments(requestPath);

  if (routeSegments.length !== requestSegments.length) {
    return undefined;
  }

  const params: PathParams = {};

  for (let index = 0; index < routeSegments.length; index += 1) {
    const routeSegment = routeSegments[index];
    const requestSegment = requestSegments[index];

    if (routeSegment.startsWith(":")) {
      const parameterName = routeSegment.slice(1);

      if (parameterName.length === 0) {
        return undefined;
      }

      params[parameterName] = requestSegment;
      continue;
    }

    if (routeSegment !== requestSegment) {
      return undefined;
    }
  }

  return params;
}

export function findRoute(
  routes: Route[],
  httpMethod: string | undefined,
  requestPath: string,
): RouteMatch | undefined {
  for (const route of routes) {
    if (route.method !== httpMethod) {
      continue;
    }

    const params = matchPath(route.path, requestPath);

    if (params !== undefined) {
      return { route, params };
    }
  }

  return undefined;
}

export function collectRoutes(controllers: Constructor[]): Route[] {
    let routes: Route[] = [];
    for (const controller of controllers) {
        if (!Reflect.hasOwnMetadata(CONTROLLER_PREFIX_METADATA, controller))
          continue;

        const prefix = Reflect.getMetadata(CONTROLLER_PREFIX_METADATA,controller);

        let controllerMethodNames = Object.getOwnPropertyNames(controller.prototype).filter(methodName => methodName !== 'constructor');
        for(const controllerMethodName of controllerMethodNames) {
                const methodMetadata: MethodMetadata | undefined = Reflect.getMetadata(
                  METHOD_METADATA,
                  controller.prototype,
                  controllerMethodName,
                );

                if (methodMetadata?.method) {
                  let currentRoute: Route = {
                    method: methodMetadata.method,
                    path: concatFullRoute(prefix, methodMetadata.path),
                    controller: controller,
                    controllerHandlerName: controllerMethodName,
                  };

                  routes.push(currentRoute);
                }
        }

    }

    return routes;
}
