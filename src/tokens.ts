export type InjectionToken = string | symbol;

export const INJECTABLE_METADATA = Symbol("injectable");
export const SCOPE_METADATA = Symbol("scope");
export const INJECT_TOKENS_METADATA = Symbol("inject_tokens");
export const PARAM_TYPES_METADATA = "design:paramtypes";
