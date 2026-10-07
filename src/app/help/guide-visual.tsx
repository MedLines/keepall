import Image from "next/image";
import { HugeiconsIcon } from "@hugeicons/react";
import { ComputerIcon, ComputerArrowDownIcon, MoreVerticalIcon, Share08Icon, SmartPhone01Icon, WifiOff01Icon } from "@hugeicons/core-free-icons";
import { ArrowRightIcon, BackupIcon, ImageIcon, LinkIcon, LogoIcon, NoteIcon, TextFileIcon, VideoIcon } from "../shell-icons";

export type GuideVisual =
  | { kind: "image"; src: string; width: number; height: number; alt: string; caption: string; portrait?: boolean }
  | { kind: "video"; src: string; poster: string; caption: string }
  | { kind: "install"; platform: "computer" | "android" | "iphone" }
  | { kind: "offline" | "transfer" };

export function InstallVisual({ platform = "computer", compact = false }: { platform?: "computer" | "android" | "iphone"; compact?: boolean }) {
  const desktop = platform === "computer";
  const iphone = platform === "iphone";
  return <div className={`kh-install-visual ${desktop ? "" : "kh-install-phone"} ${compact ? "kh-install-compact" : ""}`} aria-hidden="true">
    <div className="kh-browser">
      <div className="kh-browser-tab"><LogoIcon className="size-4" /><span>Keepall</span><span>×</span></div>
      <div className="kh-browser-address"><span>www.keepall.app</span><span className="kh-install-target"><HugeiconsIcon icon={desktop ? ComputerArrowDownIcon : iphone ? Share08Icon : MoreVerticalIcon} size={20} /></span></div>
      <div className="kh-browser-library"><Image src="/marketing/app-library.webp" alt="" width={1440} height={860} sizes="(max-width: 600px) 90vw, 700px" /></div>
      <div className="kh-install-popover">
        <LogoIcon className="size-9" />
        <strong>{desktop ? "Install Keepall" : iphone ? "Add to Home Screen" : "Install and create shortcut"}</strong>
        <span>www.keepall.app</span>
        <span className="kh-illustrated-button">{iphone ? "Add" : "Install"}</span>
      </div>
    </div>
    <div className="kh-install-label"><span>01</span>{desktop ? "Find the install icon" : iphone ? "Open Safari’s Share menu" : "Open Chrome’s menu"}<ArrowRightIcon /><span>02</span>{iphone ? "Add to Home Screen" : "Confirm installation"}</div>
  </div>;
}

export function GuideFigure({ visual }: { visual: GuideVisual }) {
  if (visual.kind === "install") return <figure className="kh-figure"><InstallVisual platform={visual.platform} /><figcaption>Illustrated steps. {visual.platform === "computer" ? "Look at the right of Chrome’s address bar. If the icon is missing, use Chrome’s menu → Cast, save, and share → Install page as app." : visual.platform === "iphone" ? "In Safari, use Share → Add to Home Screen. Turn on Open as Web App if offered, then tap Add." : "In Chrome, use the menu → Install and create shortcut → Install. Some versions say Add to Home screen."} Browser appearance varies by version.</figcaption></figure>;
  if (visual.kind === "image") return <figure className={`kh-figure ${visual.portrait ? "kh-figure-portrait" : ""}`}><div className="kh-figure-image"><Image src={visual.src} alt={visual.alt} width={visual.width} height={visual.height} sizes="(max-width: 800px) 90vw, 740px" /></div><figcaption>{visual.caption}</figcaption></figure>;
  if (visual.kind === "video") return <figure className="kh-figure kh-video"><video controls playsInline preload="none" poster={visual.poster} aria-label={visual.caption}><source src={`${visual.src}.webm`} type="video/webm" /><source src={`${visual.src}.mp4`} type="video/mp4" /></video><figcaption>{visual.caption} <span>Recorded in Keepall. No audio.</span></figcaption></figure>;
  if (visual.kind === "transfer") return <figure className="kh-figure"><div className="kh-transfer"><div><HugeiconsIcon icon={ComputerIcon} size={30} /><strong>Your current library</strong><span>Settings → Export backup</span></div><ArrowRightIcon /><div><BackupIcon className="size-8" /><strong>.keepall.zip</strong><span>Keep a separate copy</span></div><ArrowRightIcon /><div><HugeiconsIcon icon={SmartPhone01Icon} size={30} /><strong>Your other device</strong><span>Settings → Import backup</span></div></div><figcaption>A backup moves a copy of your library. It does not turn on automatic sync.</figcaption></figure>;
  return <figure className="kh-figure"><div className="kh-offline"><div><HugeiconsIcon icon={WifiOff01Icon} size={26} /><h3>Available offline</h3><span><NoteIcon />Saved notes</span><span><LinkIcon />Saved articles</span><span><TextFileIcon />Saved documents</span><span><ImageIcon />Saved image files</span><span><VideoIcon />Saved video files</span></div><div><LinkIcon className="size-7" /><h3>Needs the internet</h3><span>Opening original websites</span><span>Fetching new link previews</span><span>Downloading images from the web</span></div></div><figcaption>Open Keepall online first. Offline access depends on your browser retaining the app and its local data.</figcaption></figure>;
}
