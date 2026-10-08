import { expect, test } from "vitest";
import { isWebsitePathname } from "./website-routes";

test.each([
  "/about", "/help", "/help/storage-and-backups", "/contact", "/changelog",
  "/privacy", "/extension-privacy", "/blog", "/blog/design-references",
])("%s uses the scrollable website layout", (pathname) => {
  expect(isWebsitePathname(pathname)).toBe(true);
});

test.each(["/", "/settings", "/items/one", "/blogger", "/helpful", "/contact-card"])(
  "%s keeps the app layout", (pathname) => {
    expect(isWebsitePathname(pathname)).toBe(false);
  },
);
