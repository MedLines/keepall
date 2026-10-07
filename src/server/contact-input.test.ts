import { expect, test } from "vitest";
import { contactTopics } from "@/app/contact/contact-fields";
import { parseContactInput } from "./contact-input";
const fields = { name: "Ada", email: "ada@example.com", topic: "help", message: "Please help", browser: "", steps: "", expected: "", actual: "", website: "" };
test.each(Object.keys(contactTopics))("accepts existing topic %s", topic => {
  expect(parseContactInput({ ...fields, topic })?.topic).toBe(topic);
});
test("trims fields but enforces raw input size before trimming", () => {
  expect(parseContactInput({ ...fields, name: " Ada ", message: " Please help " })).toMatchObject({ name: "Ada", message: "Please help" });
  expect(parseContactInput({ ...fields, name: " ".repeat(101) + "Ada" })).toBeNull();
});
test.each([
  { ...fields, email: ".ada@example.com" },
  { ...fields, email: "ada..test@example.com" },
  { ...fields, message: "bad\u0000text" },
  { ...fields, name: "Ada\nOther" },
  { ...fields, name: " " },
  { ...fields, message: "😀".repeat(2501) },
  { ...fields, recipient: "attacker@example.com" },
  { ...fields, browser: undefined },
  [], null,
])("rejects malformed or unbounded inputs", value => {
  expect(parseContactInput(value)).toBeNull();
});
