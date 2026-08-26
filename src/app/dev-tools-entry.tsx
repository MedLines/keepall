"use client";

import dynamic from "next/dynamic";

const DevTools = dynamic(
  () =>
    process.env.NODE_ENV === "development"
      ? import("./dev-tools").then((mod) => mod.DevTools)
      : Promise.resolve(function DevToolsStub() {
          return null;
        }),
  { ssr: false },
);

export function DevToolsEntry() {
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return <DevTools />;
}
