/**
 * Read clipboard preferring an image when present; also return any text.
 * Falls back to readText when ClipboardItem read is unavailable.
 */
export async function readClipboardImageAndText(): Promise<{
  image: Blob | null;
  text: string;
}> {
  let image: Blob | null = null;
  let text = "";

  const clipboard = navigator.clipboard;
  if (!clipboard) {
    return { image: null, text: "" };
  }

  if (clipboard.read) {
    try {
      const items = await clipboard.read();
      for (const item of items) {
        if (!image) {
          const imageType = item.types.find((type) => type.startsWith("image/"));
          if (imageType) {
            image = await item.getType(imageType);
          }
        }
        if (!text && item.types.includes("text/plain")) {
          const textBlob = await item.getType("text/plain");
          text = await textBlob.text();
        }
      }
    } catch {
      // Permissions or unsupported. Try text-only below.
    }
  }

  if (!text && clipboard.readText) {
    try {
      text = await clipboard.readText();
    } catch {
      // ignore
    }
  }

  return { image, text };
}
