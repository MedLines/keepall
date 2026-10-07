import { KeyboardShortcutsSettings } from "./keyboard-shortcuts-settings";
import { BackupPanel } from "../backup-panel";
import { BackupIcon, DeviceIcon, GridIcon, InternetIcon, NoteIcon, OfflineIcon } from "../shell-icons";
import { ThemeControl } from "../theme-control";
import { SettingsLink } from "./settings-link";
import { StorageHealth } from "./storage-health";

const sectionClass = "library-panel border border-border-control bg-bg-surface p-5 sm:p-6";
const headingClass = "text-lg font-semibold text-text-primary";
const paragraphClass = "mt-1 text-sm leading-6 text-text-secondary";
const iconClass = "mt-0.5 size-5 text-text-secondary";

export function GeneralSettings() {
  return <>
    <section className={sectionClass} aria-labelledby="appearance-heading">
      <h2 id="appearance-heading" className={headingClass}>Appearance</h2>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-text-primary">Theme</p>
          <p className="mt-1 text-xs text-text-secondary">Saved on this device.</p>
        </div>
        <ThemeControl />
      </div>
    </section>
    <KeyboardShortcutsSettings />
    <section className={sectionClass} aria-labelledby="network-heading">
      <h2 id="network-heading" className={headingClass}>Link previews</h2>
      <p className={paragraphClass}>Fetch titles and images while online. Links save even without a preview.</p>
      <ul className="my-5 space-y-3 text-sm text-text-secondary">
        <li className="flex items-start gap-3"><InternetIcon className={iconClass} /><span>Only the page address is sent to the preview service.</span></li>
        <li className="flex items-start gap-3"><NoteIcon className={iconClass} /><span>Notes, collections, and tags stay on this device.</span></li>
      </ul>
      <SettingsLink href="/help/storage-and-backups#previews">How link previews work</SettingsLink>
    </section>
  </>;
}

export function StorageSettings() {
  return <>
    <section className={sectionClass} aria-labelledby="storage-heading">
      <h2 id="storage-heading" className={headingClass}>Storage</h2>
      <p className={paragraphClass}>Saved locally in this browser profile on this device.</p>
      <dl className="mt-5 grid gap-x-6 gap-y-5 text-sm sm:grid-cols-2">
        <div className="flex items-start gap-3">
          <DeviceIcon className={iconClass} />
          <div><dt className="font-medium text-text-primary">Where saves live</dt>
            <dd className="mt-1 leading-5 text-text-secondary">This browser only. Other profiles and devices have separate libraries.</dd></div>
        </div>
        <div className="flex items-start gap-3">
          <OfflineIcon className={iconClass} />
          <div><dt className="font-medium text-text-primary">Works offline</dt>
            <dd className="mt-1 leading-5 text-text-secondary">Open Keepall online first. Then browse, search, and edit local saves.</dd></div>
        </div>
        <div className="flex items-start gap-3">
          <InternetIcon className={iconClass} />
          <div><dt className="font-medium text-text-primary">Needs the internet</dt>
            <dd className="mt-1 leading-5 text-text-secondary">Original websites, new previews, and web image downloads.</dd></div>
        </div>
        <div className="flex items-start gap-3">
          <BackupIcon className={iconClass} />
          <div><dt className="font-medium text-text-primary">Keep a recovery copy</dt>
            <dd className="mt-1 leading-5 text-text-secondary">Clearing site data erases this library. Export a backup or enable folder backups below.</dd></div>
        </div>
      </dl>
      <StorageHealth />
      <div className="mt-4 flex flex-wrap gap-2">
        <SettingsLink href="/help/storage-and-backups">Storage and recovery guide</SettingsLink>
        <SettingsLink href="/help/offline">Offline guide</SettingsLink>
      </div>
    </section>
    <BackupPanel />
  </>;
}

export function InstallationSettings() {
  return <>
    <section className={sectionClass} aria-labelledby="installation-heading">
      <div className="flex items-start gap-3">
        <GridIcon className="mt-1 size-6 text-text-secondary" />
        <div><h2 id="installation-heading" className={headingClass}>Install Keepall</h2>
          <p className={paragraphClass}>Add an app icon to open your library.</p></div>
      </div>
      <div className="mt-5"><SettingsLink href="/help/install-keepall" primary>Installation guide</SettingsLink></div>
      <div className="mt-5 border-t border-border-control pt-5">
        <h3 className="text-sm font-medium text-text-primary">On iPhone and iPad</h3>
        <p className={paragraphClass}>The Home Screen app has separate storage from Safari. Move existing saves with a backup.</p>
        <ol className="my-4 flex flex-wrap gap-2 text-xs text-text-secondary">
          {["Export in Safari", "Open the installed app", "Import backup"].map((step, index) => <li key={step} className="flex items-center gap-2">
            <span className="flex size-5 items-center justify-center rounded-full bg-bg-raised font-medium text-text-primary">{index + 1}</span>{step}
          </li>)}
        </ol>
        <SettingsLink href="#backup-heading">Back up or transfer your library</SettingsLink>
        <p className="mt-3 text-xs text-text-secondary">Keep the original copy until you have checked the import.</p>
      </div>
    </section>
    <section className={sectionClass} aria-labelledby="offline-heading">
      <div className="flex items-start gap-3">
        <OfflineIcon className={iconClass} />
        <div><h2 id="offline-heading" className="text-sm font-medium text-text-primary">Open online first</h2>
          <p className={paragraphClass}>Let the browser cache Keepall. A first visit or an uncached page needs a connection.</p></div>
      </div>
      <div className="mt-4"><SettingsLink href="/help/offline">What works offline</SettingsLink></div>
    </section>
    <section className={sectionClass} aria-labelledby="extension-heading">
      <div className="flex items-start gap-3">
        <DeviceIcon className={iconClass} />
        <div><h2 id="extension-heading" className="text-sm font-medium text-text-primary">Chrome extension</h2>
          <p className={paragraphClass}>Save from other websites to Keepall in the same Chrome profile.</p></div>
      </div>
      <div className="mt-4"><SettingsLink href="/help/chrome-capture">Chrome extension guide</SettingsLink></div>
    </section>
  </>;
}
