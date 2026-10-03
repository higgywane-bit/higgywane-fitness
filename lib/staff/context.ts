import { AsyncLocalStorage } from "node:async_hooks";

/*
 * Who is doing this? Server actions run inside withActor(staffId, …) so every
 * activity row gets a staff_id without threading it through every function.
 */
const store = new AsyncLocalStorage<{ staffId: string | null }>();

export function withActor<T>(staffId: string | null, fn: () => Promise<T>): Promise<T> {
  return store.run({ staffId }, fn);
}

export function currentActor(): string | null {
  return store.getStore()?.staffId ?? null;
}
