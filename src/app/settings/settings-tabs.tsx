"use client";

import { Tabs } from "@base-ui/react/tabs";
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
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
  general: "general", "appearance-heading": "general", "network-heading": "general",
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

function currentSection(): Section {
  const hash = window.location.hash.slice(1);
  return Object.hasOwn(hashSections, hash) ? hashSections[hash] : "general";
}

export function SettingsTabs(content: Record<Section, ReactNode>) {
  const section = useSyncExternalStore(subscribeToSection, currentSection, (): Section => "general");
  const mobile = useShellMobile();
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Recovery links can point to headings inside a panel that was initially hidden.
    const heading = document.getElementById(window.location.hash.slice(1));
    if (!heading) return;
    const frame = requestAnimationFrame(() => heading.scrollIntoView({ block: "start" }));
    return () => cancelAnimationFrame(frame);
  }, [section]);

  return <Tabs.Root
    value={section}
    orientation={mobile ? "horizontal" : "vertical"}
    onValueChange={(value) => {
      const page = contentRef.current?.closest("main");
      if (page) page.scrollTop = 0;
      window.history.replaceState(window.history.state, "", `#${value}`);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }}
    className="grid items-start gap-3 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-6"
  >
    <div className="sticky top-0 z-10 border-b border-border-control bg-bg-canvas py-3 md:top-6 md:border-b-0 md:border-r md:py-0 md:pr-4">
      <Tabs.List aria-label="Settings" activateOnFocus className="settings-tab-list relative isolate grid grid-cols-3 gap-1 md:flex md:flex-col">
        {sections.map(({ value, label, icon: Icon }) => <Tabs.Tab
          key={value}
          value={value}
          className="settings-tab relative z-10 flex min-h-11 items-center justify-center gap-2 rounded-control-lg border border-transparent px-2 py-2 text-center text-xs font-medium text-text-secondary hover:text-text-primary data-[active]:text-text-primary sm:text-sm md:justify-start md:px-3 md:text-left"
        >
          <Icon className="hidden size-4 shrink-0 md:block" />
          <span className="md:whitespace-nowrap">{label}</span>
        </Tabs.Tab>)}
        <Tabs.Indicator renderBeforeHydration className="settings-tab-indicator" />
      </Tabs.List>
      <div className="fixed bottom-6 hidden w-52 md:block"><HelpLink /></div>
    </div>
    <div ref={contentRef} data-testid="settings-content" className="settings-panels relative grid min-w-0 items-start">
      {sections.map(({ value }) => <Tabs.Panel key={value} value={value} keepMounted aria-hidden={section !== value || undefined} className="settings-panel space-y-4">
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
