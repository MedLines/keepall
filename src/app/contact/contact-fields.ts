export const contactTopics = {
  help: "I need help",
  bug: "Bug report",
  idea: "An idea for Keepall",
  other: "Something else",
} as const;

export type ContactTopic = keyof typeof contactTopics;
export type ContactFields = {
  name: string;
  email: string;
  topic: ContactTopic;
  message: string;
  browser: string;
  steps: string;
  expected: string;
  actual: string;
  website: string;
};

export const contactLimits = {
  name: 100, email: 254, message: 5000, browser: 200,
  steps: 2000, expected: 2000, actual: 2000, website: 200,
};

export function contactReport(fields: ContactFields, includeIdentity = false) {
  const lines = [`Topic: ${contactTopics[fields.topic]}`];
  if (includeIdentity) lines.push(`Name: ${fields.name}`, `Email: ${fields.email}`);
  lines.push("", "Message", fields.message);
  if (fields.topic === "bug") {
    lines.push("", "Browser and device", fields.browser, "", "Steps to reproduce", fields.steps,
      "", "Expected result", fields.expected, "", "Actual result", fields.actual);
  }
  return lines.join("\n");
}
