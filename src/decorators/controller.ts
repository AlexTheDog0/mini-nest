export const CONTROLLER_PREFIX_METADATA = Symbol("CONTROLLER_PREFIX_METADATA");

export function Controller(prefix: string): ClassDecorator {
    return function(target) {
        Reflect.defineMetadata(CONTROLLER_PREFIX_METADATA, prefix, target);
    }
}