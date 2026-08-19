export function isHttpUrl(text: string): boolean {
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export type Classification =
  | { type: "link"; url: string }
  | { type: "note"; content: string };

export type CaptureOverride = "link" | "note" | null;

export function classifyCapture(text: string): Classification {
  const trimmed = text.trim();

  if (isHttpUrl(trimmed)) {
    return { type: "link", url: trimmed };
  }

  return { type: "note", content: trimmed };
}

export function resolveCapture(
  input: string,
  override: CaptureOverride,
):
  | { ok: true; classification: Classification }
  | { ok: false; error: string } {
  const trimmed = input.trim();

  if (!trimmed) {
    return { ok: false, error: "Enter a link or note" };
  }

  const type = override ?? classifyCapture(trimmed).type;

  if (type === "link") {
    if (!isHttpUrl(trimmed)) {
      return { ok: false, error: "Enter an http or https URL" };
    }

    return { ok: true, classification: { type: "link", url: trimmed } };
  }

  return { ok: true, classification: { type: "note", content: trimmed } };
}
