import { getRequestId } from "../context/request-context.js";
import { Injectable } from "../decorators/injectable.js";

@Injectable()
export class RequestIdLoggerService {
  logCurrentRequest(): string {
    const requestId = getRequestId();
    console.log(`requestId=${requestId}`);
    return requestId;
  }
}
