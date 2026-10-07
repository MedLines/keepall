import "server-only";
import { contactReport, contactTopics, type ContactFields } from "@/app/contact/contact-fields";
import { isContactEmail } from "./contact-input";

type ContactEmailConfig = { apiKey: string; from: string; to: string };

export function getContactEmailConfig(): ContactEmailConfig | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.CONTACT_FROM_EMAIL?.trim();
  const to = process.env.CONTACT_TO_EMAIL?.trim();
  if (!apiKey || /[\r\n]/.test(apiKey) || !from || !to || !isContactEmail(from) || !isContactEmail(to)) return null;
  return { apiKey, from, to };
}

export async function sendContactEmail(fields: ContactFields, config: ContactEmailConfig) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: config.from,
      to: [config.to],
      reply_to: fields.email,
      subject: `Keepall contact: ${contactTopics[fields.topic]}`,
      text: contactReport(fields, true),
    }),
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
    redirect: "error",
  });
  if (!response.ok) throw new Error("Contact delivery failed");
  const result: unknown = await response.json();
  if (!result || typeof result !== "object" || !("id" in result) || typeof result.id !== "string" || !result.id) {
    throw new Error("Contact delivery failed");
  }
}
