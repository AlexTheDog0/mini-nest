import "reflect-metadata";

const INJECTABLE = Symbol("injectable");
const SCOPE = Symbol("scope");
const PARAM_TYPES = 'design:paramtypes';

type InjectionToken = string | symbol;
const INJECT_TOKENS = Symbol("inject_tokens");

const STORAGE_TOKEN = Symbol('STORAGE_TOKEN');

type Scope = "singleton" | "transient";

interface InjectableOptions {
  scope?: Scope;
}

function Injectable(options: InjectableOptions = {scope: 'singleton'}): ClassDecorator {
  return function (target: Function) {
    Reflect.defineMetadata(INJECTABLE, true, target);
    Reflect.defineMetadata(SCOPE, options.scope ?? "singleton", target);
  };
}

//========= First bunch of classes to test Injectable functionality =========

@Injectable({ scope: "transient" })
class Database {}

@Injectable({ scope: "transient" })
class Logger {
  constructor(public readonly database: Database) {}
}

@Injectable()
class UserService {
  constructor(public readonly logger: Logger) {}
}

// ============================================================

type Constructor<T = unknown> = new (...args: any[]) => T;

class Container {
  private readonly providers: Map<InjectionToken, Constructor> = new Map<
    InjectionToken,
    Constructor
  >();

  //Map to see if there any instance of specific target
  private readonly instances: Map<Constructor, unknown> = new Map<
    Constructor,
    unknown
  >();

  resolve<T>(Target: Constructor<T>): T {
    return this.resolveWithPath(Target, new Set<Constructor>());
  }

  private resolveWithPath<T>(
    Target: Constructor<T>,
    path: Set<Constructor>,
  ): T {
    const isInjectable = Reflect.getMetadata(INJECTABLE, Target);

    if (!isInjectable) {
      const errMsg = `The ${Target.name} is not injectable. Mark it as @Injectable()`;
      throw new Error(errMsg);
    }
    const scope: Scope = Reflect.getOwnMetadata(SCOPE, Target) ?? "singleton";
    const isSingleton = scope === "singleton";

    if (isSingleton && this.instances.has(Target))
      return this.instances.get(Target) as T;

    if(path.has(Target)){
      let pathStr = '';
      for(const pathItem of path) {
        pathStr += `${pathItem.name} -> `;
      }
      pathStr += Target.name;
      throw new Error(`Circular dependency detected: ${pathStr}`);
    }

    const nextPath = new Set(path);
    nextPath.add(Target);

    const dependencyTypes: Constructor[] =
      Reflect.getMetadata("design:paramtypes", Target) ?? [];
    const injectTokens: Array<undefined | InjectionToken> =
      Reflect.getOwnMetadata(INJECT_TOKENS, Target) ?? [];

    const dependencyInstances = dependencyTypes.map(
      (paramTarget, parameterIndex) => {
        const parametrInjectToken = injectTokens[parameterIndex];

        if (parametrInjectToken !== undefined) {
          const provider = this.providers.get(parametrInjectToken);

          if (!provider)
            throw new Error(
              `There is no provider for ${String(parametrInjectToken)}`,
            );

          return this.resolveWithPath(provider, nextPath);
        }

        return this.resolveWithPath(paramTarget, nextPath);
      },
    );

    const instance = new Target(...dependencyInstances);
    if (isSingleton) this.instances.set(Target, instance);
    return instance;
  }

  register(token: InjectionToken, provider: Constructor): void {
    this.providers.set(token, provider);
  }
}


function Inject(token: InjectionToken): ParameterDecorator {
    return function(target, _propertyKey, parameterIndex) {
        const tokens: Array<InjectionToken | undefined> = Reflect.getOwnMetadata(INJECT_TOKENS,target) ?? [];
        tokens[parameterIndex] = token;
        Reflect.defineMetadata(INJECT_TOKENS,tokens,target);
    }
}

//========= Second bunch of classes to test param-decorator functionality =========

interface Storage {
  save(): void;
}

@Injectable({scope: 'transient'})
class MemoryStorage implements Storage {
  save(): void {}
}

@Injectable({ scope: "transient" })
class FileService {
  constructor(@Inject(STORAGE_TOKEN) public readonly storage: Storage) {}
}

// ============================================================


//========= Third bunch of classes to test cucrcular deps =========

const A_TOKEN = Symbol('A_TOKEN');
const B_TOKEN = Symbol('B_TOKEN');

interface A {}
interface B {}

@Injectable()
class ServiceB {
  constructor(@Inject(A_TOKEN) obj: A){};
}

@Injectable()
class ServiceA {
  constructor(@Inject(B_TOKEN) obj: B) {}
}

// ============================================================

const container = new Container();
try {
 container.register(A_TOKEN, ServiceA);
 container.register(B_TOKEN, ServiceB);
 container.resolve(ServiceA); 
} catch (error: any) {
  console.error(error.message)
}

const user1 = container.resolve(UserService);
const user2 = container.resolve(UserService);
console.log(user1 === user2); // true

const logger1 = container.resolve(Logger);
const logger2 = container.resolve(Logger);
console.log(logger1 === logger2); // false
