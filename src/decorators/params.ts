type ParamSource = 'query' | 'body' | 'param';

export type ParamInstruction = {
    index: number,
    source: ParamSource,
    name: string | undefined
}

export const PARAMS_METADATA = Symbol('PARAMS_METADATA');

function createParameterDecorator(source: ParamSource, name?: string): ParameterDecorator {
    return function(target, propertyKey, parameterIndex) {
        if(propertyKey === undefined) {
            throw new Error('Params decorator is allowed only for method parameters');
        }

        const instructions = Reflect.getOwnMetadata(PARAMS_METADATA,target,propertyKey) ?? [];

        const instruction: ParamInstruction = {
            index: parameterIndex,
            source,
            name
        }

        instructions[parameterIndex] = instruction;

        Reflect.defineMetadata(PARAMS_METADATA,instructions,target,propertyKey);
    }
}

export function Query(name: string) {
    return createParameterDecorator('query', name);
}

export function Body() {
    return createParameterDecorator('body');
}

export function Param(name: string) {
    return createParameterDecorator('param', name);
}