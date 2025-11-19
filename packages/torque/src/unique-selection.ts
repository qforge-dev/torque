import { AsyncLocalStorage } from "async_hooks";

type MaybePromise<T> = T | Promise<T>;
type UniqueSelectionStore = Map<string, Set<string>>;

const uniqueSelectionStorage = new AsyncLocalStorage<UniqueSelectionStore>();
let fallbackStore: UniqueSelectionStore | undefined;

function createStore(): UniqueSelectionStore {
  return new Map<string, Set<string>>();
}

function getScopedStore(): UniqueSelectionStore | undefined {
  return uniqueSelectionStorage.getStore();
}

function getFallbackStore(): UniqueSelectionStore {
  if (!fallbackStore) {
    fallbackStore = createStore();
  }
  return fallbackStore;
}

function getActiveStore(): UniqueSelectionStore {
  return getScopedStore() ?? getFallbackStore();
}

export function runWithUniqueSelectionScope<T>(
  fn: () => MaybePromise<T>
): MaybePromise<T> {
  return uniqueSelectionStorage.run(createStore(), fn);
}

export function peekUsedValues(collection: string): Set<string> | undefined {
  const store = getScopedStore();
  if (store) {
    return store.get(collection);
  }
  return fallbackStore?.get(collection);
}

export function markValueAsUsed(
  collection: string,
  uniqueValue: string
): void {
  const store = getActiveStore();
  let used = store.get(collection);
  if (!used) {
    used = new Set();
    store.set(collection, used);
  }
  used.add(uniqueValue);
}

export function hasValueBeenUsed(
  collection: string,
  uniqueValue: string
): boolean {
  const used = peekUsedValues(collection);
  return used ? used.has(uniqueValue) : false;
}

export function resetGlobalUniqueSelectionStore(): void {
  fallbackStore?.clear();
}
