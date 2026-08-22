import "reflect-metadata";

import { createServer } from "node:http";

import { Container } from "./container.js";
import { Controller } from "./decorators/controller.js";
import { Injectable } from "./decorators/injectable.js";
import { Get } from "./decorators/methods.js";
import { Param } from "./decorators/params.js";
import { createDispatcher } from "./dispatcher.js";
import { AuthGuard } from "./guards/auth.guard.js";
import { LoggingInterceptor } from "./interceptors/logging.interceptor.js";
import { collectRoutes } from "./router.js";
import { RequestService } from "./services/request.service.js";

@Controller("users")
@Injectable()
class UsersController {
  constructor(private readonly requestService: RequestService) {}

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return {
      id,
      requestId: await this.requestService.readContextAfterDelay(),
    };
  }
}

const port = Number.parseInt(process.env.PORT ?? "3000", 10);

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

const container = new Container();
const routes = collectRoutes([UsersController]);
const dispatcher = createDispatcher(container, routes, {
  guards: [new AuthGuard()],
  interceptors: [new LoggingInterceptor()],
});
const server = createServer(dispatcher);

server.listen(port, () => {
  console.log(`mini-nest is listening on http://localhost:${port}`);
});
