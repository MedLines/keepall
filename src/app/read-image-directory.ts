export type ReadableImageDirectory = {
  kind: "directory";
  name: string;
  values: () => AsyncIterable<ReadableImageDirectory | Pick<FileSystemFileHandle, "kind" | "name" | "getFile">>;
};

export type ImageDirectoryPicker = (options: { mode: "read"; id: string }) => Promise<ReadableImageDirectory>;

export async function readImageDirectory(
  directory: ReadableImageDirectory,
  onFile: (count: number, name: string) => void,
): Promise<File[]> {
  const files: File[] = [];
  async function visit(folder: ReadableImageDirectory) {
    for await (const entry of folder.values()) {
      if (entry.kind === "directory") {
        await visit(entry);
      } else {
        files.push(await entry.getFile());
        onFile(files.length, entry.name);
      }
    }
  }
  await visit(directory);
  return files;
}
