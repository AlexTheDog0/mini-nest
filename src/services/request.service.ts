import { Injectable } from "../decorators/injectable.js";
import { RequestIdLoggerService } from "./request-id-logger.service.js";

@Injectable()
export class RequestService {
  constructor(private readonly logger: RequestIdLoggerService) {}

  async readContextAfterDelay(): Promise<string> {
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
    return this.logger.logCurrentRequest();
  }
}
