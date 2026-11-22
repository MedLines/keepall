"use client";

import { useEffect, useRef, useState, type Ref } from "react";
import { Button } from "@/components/ui/button";
import { RadioCard } from "@/components/ui/radio-card";
import type { AgentAccess } from "@/domain/agent-changes";
import { SETUP_AGENT_NAMES, SETUP_AGENTS, type SetupAgent, type SetupInstructions } from "@/domain/agent-setup";
import { ACCESS_CHOICES } from "./agents-panel";
import { headingClass, paragraphClass, sectionClass } from "./settings-sections";

export type ConnectAgentPanelProps = {
  /** Agent access needs a relay for this Keepall address; without one, the section explains instead. */
  available: boolean;
  agent: SetupAgent;
  access: AgentAccess;
  busy: boolean;
  created: { agentName: string; instructions: SetupInstructions } | null;
  error: string | null;
  onAgent(agent: SetupAgent): void;
  onAccess(access: AgentAccess): void;
  onCreate(): void;
  /** Back to the choices, to set up another agent. */
  onReset(): void;
};

function CopyButton({ text, ref }: { text: string; ref?: Ref<HTMLButtonElement> }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button ref={ref} variant="primary" onClick={() => {
      void navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }, () => {});
    }}>{copied ? "Copied" : "Copy"}</Button>
  );
}

/** The setup to paste, shown where Create setup was. It scrolls into view and takes focus so nothing above it moves. */
function CreatedSetup({ created, onReset }: { created: NonNullable<ConnectAgentPanelProps["created"]>; onReset(): void }) {
  const result = useRef<HTMLDivElement>(null);
  const copy = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const node = result.current;
    // Centred, clear of bars pinned to the screen edges; from its top when it is taller than most of the screen.
    if (node) node.scrollIntoView({ block: node.offsetHeight < window.innerHeight * 0.7 ? "center" : "start", behavior: reduce ? "auto" : "smooth" });
    copy.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div ref={result} className="mt-5 border-t border-border-control pt-5">
      <p className="text-sm font-medium text-text-primary">{created.instructions.where}</p>
      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded-input border border-border-control bg-bg-raised p-3 font-mono text-xs leading-5 text-text-primary">{created.instructions.text}</pre>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <CopyButton ref={copy} text={created.instructions.text} />
        <Button onClick={onReset}>Set up another agent</Button>
      </div>
      <p className="mt-3 text-sm leading-6 text-text-secondary">{created.instructions.then}</p>
      <p className="mt-2 text-xs leading-5 text-text-secondary">
        This contains a key to your library. Don&apos;t share it. {created.agentName} appears under Connected agents, where Disconnect revokes it.
      </p>
    </div>
  );
}

/**
 * Settings → Agents: make a one-step setup for Claude Code, Codex, OpenCode, or another MCP agent. The choices stay in
 * place, locked, once the setup exists, so the setup appears below them instead of replacing them.
 */
export function ConnectAgentPanel({ available, agent, access, busy, created, error, onAgent, onAccess, onCreate, onReset }: ConnectAgentPanelProps) {
  const locked = busy || !!created;
  return (
    <section className={sectionClass} aria-labelledby="agents-connect-heading">
      <h2 id="agents-connect-heading" className={headingClass}>Connect an agent</h2>
      <p className={paragraphClass}>
        Let Claude Code, Codex, OpenCode, or another agent search and organize this library. Keepall makes one setup step for it; you don&apos;t install anything else.
      </p>
      {!available ? (
        <p className="mt-4 text-sm leading-6 text-text-secondary">Agent access isn&apos;t available at this address yet.</p>
      ) : (
        <>
          <fieldset className="mt-5 grid gap-2 sm:grid-cols-2" disabled={locked}>
            <legend className="mb-2 text-sm font-medium text-text-primary">Agent</legend>
            {SETUP_AGENTS.map((value) => (
              <RadioCard key={value} name="setup-agent" value={value} checked={agent === value} onChange={() => onAgent(value)}>
                <span className="font-medium text-text-primary">{SETUP_AGENT_NAMES[value]}</span>
              </RadioCard>
            ))}
          </fieldset>
          <fieldset className="mt-5 grid gap-2" disabled={locked}>
            <legend className="mb-2 text-sm font-medium text-text-primary">What it can do</legend>
            {ACCESS_CHOICES.map((choice) => (
              <RadioCard key={choice.value} name="setup-access" value={choice.value} checked={access === choice.value} onChange={() => onAccess(choice.value)}>
                <span><span className="block font-medium text-text-primary">{choice.label}</span><span className="mt-0.5 block text-text-secondary">{choice.description}</span></span>
              </RadioCard>
            ))}
          </fieldset>
          {created ? <CreatedSetup created={created} onReset={onReset} /> : (
            <>
              {error ? <p role="alert" className="mt-4 text-sm text-text-danger">{error}</p> : null}
              <Button variant="primary" className="mt-5" disabled={busy} onClick={onCreate}>{busy ? "Creating…" : "Create setup"}</Button>
            </>
          )}
        </>
      )}
    </section>
  );
}
