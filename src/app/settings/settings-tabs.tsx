"use client";

import { Tabs } from "@base-ui/react/tabs";
import { useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { ArrowRightIcon, BackupIcon, GridIcon, HelpIcon, SettingsIcon } from "../shell-icons";
import { useShellMobile } from "../use-shell-mobile";

const sections = [
  { value: "general", label: "General", icon: SettingsIcon },
  { value: "storage", label: "Storage & backups", icon: BackupIcon },
  { value: "installation", label: "Installation", icon: GridIcon },
] as const;
type Section = typeof sections[number]["value"];

const hashSections: Record<string, Section> = {
  general: "general", "appearance-heading": "general", "network-heading": "general", "keyboard-shortcuts-heading": "general",
  storage: "storage", "storage-heading": "storage", "backup-heading": "storage", "import-heading": "storage",
  installation: "installation", "installation-heading": "installation",
};

function subscribeToSection(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  window.addEventListener("popstate", onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener("popstate", onChange);
  };
}

function currentHash() {
  return window.location.hash.slice(1);
}

export function SettingsTabs(content: Record<Section, ReactNode>) {
  const hash = useSyncExternalStore(subscribeToSection, currentHash, () => "");
  const section = Object.hasOwn(hashSections, hash) ? hashSections[hash] : "general";
  const mobile = useShellMobile();
  const contentRef = useRef<HTMLDivElement>(null);
  const tabListRef = useRef<HTMLDivElement>(null);
  const transitionRef = useRef<ViewTransition | null>(null);
  const requestRef = useRef(0);
  const keyboardRef = useRef(false);

  useLayoutEffect(() => () => {
    requestRef.current += 1;
    transitionRef.current?.skipTransition();
  }, []);

  useLayoutEffect(() => {
    const viewport = contentRef.current?.closest<HTMLElement>('[data-slot="scroll-area-viewport"]');
    if (viewport) viewport.scrollTop = 0;
    // Heading links also work when their tab is already active.
    const heading = document.getElementById(hash);
    if (heading && contentRef.current?.contains(heading)) {
      heading.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }, [hash]);

  return <Tabs.Root
    value={section}
    orientation={mobile ? "horizontal" : "vertical"}
    onKeyDownCapture={() => { keyboardRef.current = true; }}
    onPointerDownCapture={() => { keyboardRef.current = false; }}
    onValueChange={(value, details) => {
      const request = ++requestRef.current;
      transitionRef.current?.skipTransition();
      const update = () => {
        if (request !== requestRef.current) return;
        window.history.replaceState(window.history.state, "", `#${value}`);
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      };
      const content = contentRef.current;
      if (!content || !document.startViewTransition || keyboardRef.current || details.event instanceof KeyboardEvent) {
        update();
        return;
      }
      content.style.viewTransitionName = "settings-content";
      const forward = sections.findIndex((entry) => entry.value === value) > sections.findIndex((entry) => entry.value === section);
      const reverse = mobile && getComputedStyle(content).direction === "rtl" ? forward : !forward;
      content.style.viewTransitionClass = `settings-${mobile ? "horizontal" : "vertical"}-${reverse ? "back" : "forward"}`;
      const indicator = tabListRef.current?.querySelector<HTMLElement>(".settings-tab-indicator");
      if (indicator) indicator.style.viewTransitionName = "settings-selection";
      const transition = document.startViewTransition(() => flushSync(update));
      transitionRef.current = transition;
      void transition.ready.catch(() => {});
      const cleanup = () => {
        if (transitionRef.current !== transition) return;
        content.style.viewTransitionName = "";
        content.style.viewTransitionClass = "";
        if (indicator) indicator.style.viewTransitionName = "";
        transitionRef.current = null;
      };
      void transition.finished.then(cleanup, cleanup);
    }}
    className="grid items-start gap-3 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-6"
  >
    <div className="sticky top-0 z-10 border-b border-border-control bg-bg-canvas py-3 md:top-6 md:border-b-0 md:border-r md:py-0 md:pr-4">
      <Tabs.List ref={tabListRef} aria-label="Settings" activateOnFocus className="settings-tab-list relative isolate grid grid-cols-3 gap-1 md:flex md:flex-col">
        {sections.map(({ value, label, icon: Icon }) => <Tabs.Tab
          key={value}
          value={value}
          onPointerDownCapture={() => {
            if (value !== section || !transitionRef.current) return;
            requestRef.current += 1;
            transitionRef.current.skipTransition();
          }}
          className="settings-tab relative z-10 flex min-h-11 items-center justify-center gap-2 rounded-control-lg border border-transparent px-2 py-2 text-center text-xs font-medium text-text-secondary hover:text-text-primary data-[active]:text-text-primary sm:text-sm md:justify-start md:px-3 md:text-left"
        >
          <Icon className="hidden size-4 shrink-0 md:block" />
          <span className="md:whitespace-nowrap">{label}</span>
        </Tabs.Tab>)}
        <Tabs.Indicator renderBeforeHydration className="settings-tab-indicator" />
      </Tabs.List>
      <div className="fixed bottom-6 hidden w-52 md:block"><HelpLink /></div>
    </div>
    <div ref={contentRef} data-testid="settings-content" className="settings-panels min-w-0">
      {sections.map(({ value }) => <Tabs.Panel key={value} value={value} keepMounted hidden={section !== value} aria-hidden={section !== value || undefined} className="settings-panel space-y-4">
        {content[value]}
      </Tabs.Panel>)}
    </div>
    <div className="fixed inset-x-6 bottom-6 z-20 md:hidden"><HelpLink /></div>
  </Tabs.Root>;
}

function HelpLink() {
  return <Link href="/help" className="ui-control flex min-h-11 w-full items-center gap-2 px-3 py-2 text-sm font-medium">
    <HelpIcon className="size-4" />
    <span>Help & guides</span>
    <ArrowRightIcon className="ml-auto size-4" />
  </Link>;
}
