"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { RadioCard } from "@/components/ui/radio-card";
import type { AgentAccess } from "@/domain/agent-changes";
import { agentDisplayName } from "@/domain/agent-review";
import {
  acceptPairing, channelSocketUrl, concatBytes, parsePairingFragment, splitConnectionFrame, verifyPairConfirm, type Bytes, type PairingLink,
} from "@/domain/agent-protocol";
import { AGENT_PAIRINGS_CHANNEL, saveAgentPairing } from "@/persistence/agent-pairings";
import { LogoIcon } from "../shell-icons";
import { wakeExtensionBridge } from "../extension-wake";
import { ACCESS_CHOICES } from "../settings/agents-panel";

const CONFIRM_TIMEOUT_MS = 20_000;

type State =
  | { step: "loading" }
  | { step: "invalid" | "cancelled" }
  | { step: "ready" | "connecting"; link: PairingLink }
  | { step: "done"; link: PairingLink; extension: boolean }
  | { step: "error"; link: PairingLink; message: string };

/** Runs the library's half of pairing over the relay. Resolves once the agent proves it derived the same key. */
function pair(link: PairingLink): Promise<Bytes> {
  return new Promise((resolve, reject) => {
    void acceptPairing(link).then(({ pairKey, acceptFrame }) => {
      const socket = new WebSocket(channelSocketUrl(link.relayUrl, link.channelId, "library"));
      socket.binaryType = "arraybuffer";
      let agent: Bytes | undefined;
      const timer = setTimeout(() => finish(new Error("The agent stopped waiting. Ask it for a new link.")), CONFIRM_TIMEOUT_MS);
      function finish(error: Error | null) {
        clearTimeout(timer);
        socket.close(1000, "Pairing finished");
        if (error) reject(error);
        else resolve(pairKey);
      }
      socket.addEventListener("error", () => finish(new Error("Couldn't reach the Keepall relay. Check your connection and try again.")));
      socket.addEventListener("message", (event: MessageEvent<string | ArrayBuffer>) => {
        if (typeof event.data === "string") return;
        const split = splitConnectionFrame(new Uint8Array(event.data));
        if (!split) return;
        if (!agent) {
          agent = split.prefix;
          socket.send(concatBytes(split.prefix, acceptFrame));
          return;
        }
        void verifyPairConfirm(pairKey, split.frame).then((valid) => {
          if (valid) finish(null);
        });
      });
    }, reject);
  });
}

export function ConnectAgent() {
  const [state, setState] = useState<State>({ step: "loading" });
  const [access, setAccess] = useState<AgentAccess>("suggest");
  const started = useRef(false);
  const parsed = useRef<PairingLink | null>(undefined);

  useEffect(() => {
    // Read once: the fragment is gone after the first run, and Strict Mode runs effects twice.
    if (parsed.current === undefined) {
      const link = parsePairingFragment(location.hash);
      // MCP clients report names like "claude-code"; show and store the product name.
      parsed.current = link ? { ...link, agentName: agentDisplayName(link.agentName) } : null;
    }
    const link = parsed.current;
    // The fragment holds the pairing secret. Drop it from the address bar once read.
    if (location.hash) history.replaceState(null, "", location.pathname);
    setState(link ? { step: "ready", link } : { step: "invalid" });
  }, []);

  async function allow(link: PairingLink) {
    if (started.current) return;
    started.current = true;
    setState({ step: "connecting", link });
    try {
      const pairKey = await pair(link);
      await saveAgentPairing({ id: link.channelId, relayUrl: link.relayUrl, agentName: link.agentName, pairKey, createdAt: Date.now(), access });
      const channel = new BroadcastChannel(AGENT_PAIRINGS_CHANNEL);
      channel.postMessage("changed");
      channel.close();
      setState({ step: "done", link, extension: await wakeExtensionBridge() });
    } catch (error) {
      started.current = false;
      setState({ step: "error", link, message: error instanceof Error ? error.message : "Couldn't connect. Ask the agent for a new link." });
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-bg-shell p-4">
      <section aria-labelledby="connect-title" className="w-full max-w-md rounded-panel bg-bg-surface p-6 sm:p-8">
        <LogoIcon className="size-8 text-text-primary" />
        {state.step === "loading" ? <p className="mt-6 text-sm text-text-secondary">Loading…</p> : null}
        {state.step === "invalid" ? (
          <>
            <h1 id="connect-title" className="mt-6 text-heading font-semibold text-text-primary">This link doesn&apos;t work</h1>
            <p className="mt-3 text-sm leading-6 text-text-secondary">Ask your agent for a new Keepall link and open it in this browser.</p>
            <Link href="/" className="mt-6 inline-block text-sm font-medium text-text-primary underline underline-offset-2">Go to your library</Link>
          </>
        ) : null}
        {state.step === "cancelled" ? (
          <>
            <h1 id="connect-title" className="mt-6 text-heading font-semibold text-text-primary">Not connected</h1>
            <p className="mt-3 text-sm leading-6 text-text-secondary">The agent can&apos;t reach your library. You can close this tab.</p>
          </>
        ) : null}
        {state.step === "ready" || state.step === "connecting" || state.step === "error" ? (
          <>
            <h1 id="connect-title" className="mt-6 text-heading font-semibold text-text-primary">Connect {state.link.agentName} to Keepall?</h1>
            <p className="mt-3 text-sm leading-6 text-text-secondary">
              {state.link.agentName} will be able to search this library and read everything you&apos;ve saved, including notes, saved articles, documents, and images. Images are sent as resized copies.
            </p>
            <fieldset className="mt-5 grid gap-2" disabled={state.step === "connecting"}>
              <legend className="mb-2 text-sm font-medium text-text-primary">What {state.link.agentName} can do</legend>
              {ACCESS_CHOICES.map((choice) => (
                <RadioCard key={choice.value} name="access" value={choice.value} checked={access === choice.value} onChange={() => setAccess(choice.value)}>
                  <span><span className="block font-medium text-text-primary">{choice.label}</span><span className="mt-0.5 block text-text-secondary">{choice.description}</span></span>
                </RadioCard>
              ))}
            </fieldset>
            <p className="mt-4 text-xs leading-5 text-text-secondary">
              You can change this later in Settings, Agents. Keepall keeps a copy of everything an agent changes, so any change can be undone.
            </p>
            <p className="mt-3 text-sm leading-6 text-text-secondary">
              Requests are encrypted between the agent and this browser. Keepall&apos;s relay passes them along without being able to read them.
            </p>
            {state.step === "error" ? <p role="alert" className="mt-4 text-sm text-text-danger">{state.message}</p> : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <Button variant="primary" disabled={state.step === "connecting"} onClick={() => void allow(state.link)}>
                {state.step === "connecting" ? "Connecting…" : "Connect"}
              </Button>
              <Button disabled={state.step === "connecting"} onClick={() => setState({ step: "cancelled" })}>Cancel</Button>
            </div>
          </>
        ) : null}
        {state.step === "done" ? (
          <>
            <h1 id="connect-title" className="mt-6 text-heading font-semibold text-text-primary">{state.link.agentName} is connected</h1>
            {state.extension ? (
              <p className="mt-3 text-sm leading-6 text-text-secondary">
                Go back to {state.link.agentName} and ask it to search Keepall. Keepall Capture answers while Chrome is open, so you can close this tab.
              </p>
            ) : (
              <>
                <p className="mt-3 text-sm leading-6 text-text-secondary">
                  Go back to {state.link.agentName} and ask it to search Keepall.
                </p>
                <p role="status" className="mt-3 text-sm leading-6 text-text-warning">
                  Keepall Capture didn&apos;t respond, so {state.link.agentName} can reach this library only while a Keepall tab is open. Keep this tab open, or install Keepall Capture and set its library address to {location.origin} so it answers without a tab.
                </p>
              </>
            )}
          </>
        ) : null}
      </section>
    </main>
  );
}
