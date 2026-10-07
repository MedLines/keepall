import Dexie, { type Table, type Transaction } from "dexie";
import type { KeepallDB } from "./db";

export async function cancellableWrite<T>(
  db: KeepallDB, tables: Table[], signal: AbortSignal | undefined, write: () => Promise<T>,
): Promise<T> {
  signal?.throwIfAborted();
  let transaction: Transaction | undefined;
  const abort = () => { if (transaction?.active) transaction.abort(); };
  signal?.addEventListener("abort", abort, { once: true });
  try {
    return await db.transaction("rw", tables, async () => {
      transaction = Dexie.currentTransaction;
      signal?.throwIfAborted();
      return write();
    });
  } catch (error) {
    if (signal?.aborted) throw signal.reason;
    throw error;
  } finally {
    signal?.removeEventListener("abort", abort);
  }
}
