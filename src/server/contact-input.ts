import { z } from "zod";
import { contactLimits, type ContactFields } from "@/app/contact/contact-fields";

const invalidControls = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const contactEmail = z.email().max(contactLimits.email);

export function isContactEmail(value: string) {
  return contactEmail.safeParse(value).success;
}

const text = (limit: number) => z.string().refine(value => value.length <= limit && !invalidControls.test(value)).trim();
const contactInput: z.ZodType<ContactFields> = z.strictObject({
  topic: z.enum(["help", "bug", "idea", "other"]),
  name: text(contactLimits.name).refine(value => value.length > 0 && !/[\r\n]/.test(value)),
  email: text(contactLimits.email).pipe(contactEmail),
  message: text(contactLimits.message).refine(value => value.length > 0),
  browser: text(contactLimits.browser),
  steps: text(contactLimits.steps),
  expected: text(contactLimits.expected),
  actual: text(contactLimits.actual),
  website: text(contactLimits.website).refine(value => value.length === 0),
});

export function parseContactInput(input: unknown): ContactFields | null {
  const result = contactInput.safeParse(input);
  return result.success ? result.data : null;
}
