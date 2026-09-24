import type { Metadata } from "next";
import Link from "next/link";
import { BackupPanel } from "../backup-panel";
import { ArrowLeftIcon, LogoIcon } from "../shell-icons";
import { ThemeControl } from "../theme-control";
import { StorageHealth } from "./storage-health";

export const metadata: Metadata = {
  title: "Settings · Keepall",
};

export default function SettingsPage() {
  return (
    <main className="ui-scrollbar h-dvh overflow-y-auto bg-bg-shell p-2.5">
      <div className="library-panel min-h-full bg-bg-canvas px-5 py-5 sm:px-8 sm:py-7">
        <header className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4">
          <Link
            href="/"
            aria-label="Keepall home"
            className="keepall-logo-link flex min-h-11 items-center gap-0 rounded-control-lg px-2 text-text-primary"
          >
            <LogoIcon className="size-8" />
            <span className="text-lg font-medium">keepall</span>
          </Link>
        </header>

        <div className="mx-auto mt-12 w-full max-w-3xl pb-16 sm:mt-16">
          <Link
            href="/"
            className="ui-control inline-flex min-h-10 items-center gap-2 px-3 text-sm font-medium"
          >
            <ArrowLeftIcon className="size-4" />
            Back to library
          </Link>

          <div className="mt-7">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-secondary">
              Keepall
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-text-primary sm:text-4xl">
              Settings
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary sm:text-base">
              Change how Keepall looks, manage your library data, and see what is planned.
            </p>
          </div>

          <div className="mt-8 space-y-4">
            <section
              className="library-panel border border-border-control bg-bg-surface p-5 sm:p-7"
              aria-labelledby="appearance-heading"
            >
              <h2 id="appearance-heading" className="text-lg font-semibold text-text-primary">
                Appearance
              </h2>
              <p className="mt-1 text-sm leading-6 text-text-secondary">
                Choose light or dark. Your choice stays on this device.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border-control pt-5">
                <div>
                  <p className="text-sm font-medium text-text-primary">Theme</p>
                  <p className="text-xs text-text-secondary">Switch between light and dark.</p>
                </div>
                <ThemeControl />
              </div>
              <p className="mt-4 text-xs text-text-secondary">
                <span className="font-medium">Planned:</span> automatically switch when your device theme changes.
              </p>
            </section>

            <BackupPanel />

            <section
              className="library-panel border border-border-control bg-bg-surface p-5 sm:p-7"
              aria-labelledby="storage-heading"
            >
              <h2 id="storage-heading" className="text-lg font-semibold text-text-primary">
                Storage
              </h2>
              <p className="mt-1 text-sm leading-6 text-text-secondary">
                Your library currently lives in this browser. A downloaded backup is the way to recover it if browser data is cleared.
              </p>
              <StorageHealth />
              <p className="mt-4 text-xs text-text-secondary">
                <span className="font-medium">Planned:</span> a local file vault for large originals and recovery from that vault.
              </p>
            </section>

            <section
              className="library-panel border border-border-control bg-bg-surface p-5 sm:p-7"
              aria-labelledby="help-heading"
            >
              <h2 id="help-heading" className="text-lg font-semibold text-text-primary">
                Help
              </h2>
              <p className="mt-1 text-sm leading-6 text-text-secondary">
                Press <kbd className="font-mono text-text-primary">Alt + K</kbd> to open capture. On a Mac, use Option + K.
              </p>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-text-primary">
                <Link href="/help" className="underline underline-offset-2">Help guides</Link>
                <Link href="/about" className="underline underline-offset-2">About Keepall</Link>
                <Link href="/extension-privacy" className="underline underline-offset-2">Keepall Capture privacy</Link>
              </div>
            </section>

            <section
              className="library-panel border border-border-control bg-bg-surface p-5 sm:p-7"
              aria-labelledby="network-heading"
            >
              <h2 id="network-heading" className="text-lg font-semibold text-text-primary">
                Link previews
              </h2>
              <p className="mt-1 text-sm leading-6 text-text-secondary">
                Keepall fetches link previews when you are online.
              </p>
              <p className="mt-4 text-xs text-text-secondary">
                <span className="font-medium">Planned:</span> controls for preview fetching and privacy.
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
