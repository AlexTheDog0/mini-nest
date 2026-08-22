import type { ExecutionContext, Guard } from "../lifecycle.js";

export class AuthGuard implements Guard {
  canActivate(context: ExecutionContext): boolean {
    const authorization = context.request.headers.authorization;

    return typeof authorization === "string" && authorization.trim().length > 0;
  }
}
