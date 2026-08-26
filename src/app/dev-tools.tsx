"use client";

import { Agentation } from "agentation";
import { InterfaceKit } from "interface-kit/react";

const AGENTATION_ENDPOINT =
  process.env.NEXT_PUBLIC_AGENTATION_ENDPOINT ?? "http://localhost:4747";

/** Visual dev overlays — imported only when NODE_ENV is development. */
export function DevTools() {
  return (
    <>
      <InterfaceKit />
      <Agentation endpoint={AGENTATION_ENDPOINT} />
    </>
  );
}
