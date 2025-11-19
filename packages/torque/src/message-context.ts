import { AsyncLocalStorage } from "async_hooks";
import type { IMessageSchemaContext } from "./types";

type MaybePromise<T> = T | Promise<T>;

const messageContextStorage = new AsyncLocalStorage<IMessageSchemaContext>();

export function runWithMessageContext<T>(
  context: IMessageSchemaContext,
  fn: () => MaybePromise<T>
): MaybePromise<T> {
  const currentStore = messageContextStorage.getStore();
  if (currentStore === context) {
    return fn();
  }

  return messageContextStorage.run(context, fn);
}

export function getCurrentMessageContext(): IMessageSchemaContext | undefined {
  return messageContextStorage.getStore();
}
