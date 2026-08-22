import { AsyncLocalStorage } from "node:async_hooks";

type RequestContextStore = {
  requestId: string;
};

const storage = new AsyncLocalStorage<RequestContextStore>();

export function runWithRequestContext<T>(
  requestId: string,
  callback: () => T,
): T {
  return storage.run({ requestId }, callback);
}

export function getRequestId(): string {
  const store = storage.getStore();

  if (store === undefined) {
    throw new Error("Request context is not available");
  }

  return store.requestId;
}
