import agentsSettingsImage from "../../../public/help/agents-settings.webp";
import type { Guide } from "./guides";

/** Connecting AI agents to the library, and exporting saves for agents as files. */
export const agentsGuide: Guide = {
  slug: "ai-agents", category: "Use with AI", title: "Use Keepall with AI agents",
  summary: "Let Claude Code, Codex, OpenCode, or another agent search your library and suggest how to organize it, or hand it a Context Pack.", minutes: "4 min read",
  sections: [
    {
      id: "connect",
      title: "Connect an agent",
      paragraphs: [
        "A connected agent can search your library, read items in full, and look at saved images. Depending on what you allow, it can also tag, add notes, move items between collections, rename collections, move items to Trash, and save new links, notes, and files.",
        "Agents save what you can: links, plain or Markdown notes, images and galleries, MP4 and WebM videos, PDFs, and Markdown or text files, with the same size limits as Add files. Files can come from the agent's computer or a web address.",
        "Keepall makes one setup step for each agent. The agent runs Keepall's connector with npx, so you need Node.js 22 or later on that computer. You don't install anything else.",
      ],
      steps: [
        "In Keepall, open Settings, then Agents.",
        "Under Connect an agent, choose Claude Code, Codex, OpenCode, Claude Desktop, or Another agent.",
        "Choose what it can do, then select Create setup.",
        "Select Copy, and paste the setup where it tells you: a terminal command, or your agent's settings file.",
        "Restart the agent and ask it to search Keepall.",
      ],
      note: "The setup contains a key to your library. Don't share it.",
      visual: { kind: "image", src: agentsSettingsImage.src, width: agentsSettingsImage.width, height: agentsSettingsImage.height, alt: "Connect an agent in Keepall Settings, with agent choices, access choices, and Create setup", caption: "Choose the agent and what it can do. Keepall makes the setup to paste." },
      links: [{ label: "Open Agents settings", href: "/settings#agents-connect-heading" }],
    },
    {
      id: "access",
      title: "Choose what an agent can do",
      paragraphs: [
        "Read only lets the agent search and read your library, including images. It can't change anything.",
        "Suggest changes is the default. The agent's changes wait for your review, and nothing changes until you apply them.",
        "Make changes applies small changes right away. Changes to more than 10 items still wait for your review.",
        "Change an agent's access at any time under Connected agents.",
      ],
    },
    {
      id: "review",
      title: "Review suggestions",
      paragraphs: [
        "When an agent suggests changes, Agent review in the sidebar shows a count. With Keepall Capture, the toolbar icon shows it too.",
        "Agent review shows each suggested item as a library card, including new notes and files that aren't saved yet. Open one to see the item and the agent's reason. Accept the suggestion, change the collection or tags first, or skip it. For a new item, Save to library saves it, and Don't save leaves it out.",
      ],
      steps: [
        "Select Agent review in the sidebar.",
        "Select an item, or Review one at a time.",
        "Accept, change, or skip each suggestion.",
        "Or choose Apply the rest as suggested, or Decline the rest.",
      ],
    },
    {
      id: "undo",
      title: "Undo an agent's changes",
      paragraphs: [
        "Keepall keeps a copy of everything an agent change touches. Recent changes in Settings, Agents lists what each agent did, newest first.",
        "Undo puts back the copy Keepall kept. Anything you edited since the agent's change stays as you left it.",
        "If folder backups are on, applying suggestions saves a backup first.",
      ],
      links: [{ label: "Set up folder backups", href: "/help/storage-and-backups" }],
    },
    {
      id: "reach",
      title: "When an agent can reach your library",
      paragraphs: [
        "Your library lives in your browser, so the browser answers the agent. With Keepall Capture installed, agents reach your library whenever Chrome is running. Without it, keep a Keepall tab open.",
        "If the agent says it can't reach Keepall, open Keepall in Chrome and ask again.",
      ],
      links: [{ label: "Install Keepall Capture", href: "/help/chrome-capture" }],
    },
    {
      id: "privacy",
      title: "What the relay and the agent receive",
      paragraphs: [
        "Requests and answers are end-to-end encrypted between your browser and the agent's computer. Keepall's relay passes them along without being able to read them.",
        "What an agent reads leaves your browser. The agent usually sends it to its AI provider, under that provider's privacy practices.",
        "To revoke an agent's key, select Disconnect under Connected agents.",
      ],
      links: [{ label: "Privacy details", href: "/privacy#agents" }],
    },
    {
      id: "context-pack",
      title: "Export a Context Pack instead",
      paragraphs: [
        "A Context Pack is a ZIP file for an agent to read, with no connection. It has a Markdown card for each item, a manifest, and, if you choose, the original files.",
        "Export the current results with Export in the library toolbar, or export selected items from the selection bar. Before downloading, you see the item count and an estimate of the text size.",
      ],
      steps: [
        "Search or filter to the items you want, or select them.",
        "Select Export, name the pack, and choose Include files or Text only.",
        "Unzip it into your project, for example under references/.",
        "Copy the line Keepall offers into your project's AGENTS.md so agents know where to look.",
      ],
    },
  ],
  action: { label: "Connect an agent", href: "/settings#agents-connect-heading" },
};
