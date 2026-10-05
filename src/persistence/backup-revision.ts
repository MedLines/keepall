import type Dexie from "dexie";

export type BackupRevision = { id: "library"; revision: string };
export const BACKUP_TABLES = ["items", "tags", "collections", "assets", "videoAssets", "thumbnails", "preferences", "documentAssets"];

/** Keep the revision atomic with every exported write, including bulk deletes and restores. */
export function trackBackupRevision(db: Dexie) {
  db.use({
    stack: "dbcore", name: "keepall-backup-revision",
    create(core) {
      if (!core.schema.tables.some((table) => table.name === "backupState")) return core;
      const state = core.table("backupState");
      return {
        ...core,
        transaction(stores, mode, options) {
          const tracked = mode === "readwrite" && stores.some((name) => BACKUP_TABLES.includes(name));
          return core.transaction(tracked ? [...new Set([...stores, "backupState"])] : stores, mode, options);
        },
        table(name) {
          const table = core.table(name);
          if (!BACKUP_TABLES.includes(name)) return table;
          return {
            ...table,
            async mutate(request) {
              const result = await table.mutate(request);
              const count = request.type === "deleteRange" ? 1 : request.type === "delete" ? request.keys.length : request.values.length;
              if (count > result.numFailures) {
                const changed = await state.mutate({
                  type: "put", trans: request.trans,
                  values: [{ id: "library", revision: crypto.randomUUID() }],
                });
                if (changed.numFailures) {
                  request.trans.abort();
                  throw changed.failures[0];
                }
              }
              return result;
            },
          };
        },
      };
    },
  });
}
