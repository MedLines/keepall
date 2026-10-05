export type AutomaticBackupIdentity = {
  libraryId: string;
  snapshotId: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function parseAutomaticBackupIdentity(value: unknown): AutomaticBackupIdentity | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || !("libraryId" in value) || !("snapshotId" in value) ||
      typeof value.libraryId !== "string" || !UUID.test(value.libraryId) ||
      typeof value.snapshotId !== "string" || !UUID.test(value.snapshotId)) {
    throw new Error("Invalid automatic backup identity");
  }
  return { libraryId: value.libraryId, snapshotId: value.snapshotId };
}

export function automaticBackupFileName(identity: AutomaticBackupIdentity, exportedAt: number): string {
  parseAutomaticBackupIdentity(identity);
  const timestamp = new Date(exportedAt).toISOString().replaceAll(":", "-");
  return `keepall-auto-${identity.libraryId}-${timestamp}-${identity.snapshotId}.keepall.zip`;
}
