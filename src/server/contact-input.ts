import { contactLimits, contactTopics, type ContactFields } from "@/app/contact/contact-fields";

export function isContactEmail(value: string) {
  return value.length <= 254 && /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(value);
}

export function parseContactInput(input: unknown): ContactFields | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const source = input as Record<string, unknown>;
  const allowed = [...Object.keys(contactLimits), "topic"];
  if (Object.keys(source).some(key => !allowed.includes(key))) return null;
  if (typeof source.topic !== "string" || !Object.hasOwn(contactTopics, source.topic)) return null;
  const fields = { topic: source.topic } as ContactFields;
  for (const [key, limit] of Object.entries(contactLimits)) {
    const value = source[key];
    if (typeof value !== "string" || value.length > limit || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) return null;
    fields[key as keyof typeof contactLimits] = value.trim();
  }
  if (!fields.name || /[\r\n]/.test(fields.name) || !fields.message || !isContactEmail(fields.email) || fields.website) return null;
  return fields;
}
