# Product Hunt launch

Prepared November 23, 2026 from `main` at `4e7395a`; scheduled November 27 for November 30. Field limits come from Product Hunt's Help Center: [Build your product page](https://help.producthunt.com/en/articles/17834537-4-build-your-product-page), [Set your goals and pick your launch date](https://help.producthunt.com/en/articles/17734355), [Launch FAQ and myths](https://help.producthunt.com/en/articles/17734646-8-launch-faq-and-myths), and the [Featuring Guidelines](https://help.producthunt.com/en/articles/9883485).

## Listing fields

| Field | Limit | Value |
| --- | --- | --- |
| Name | 40 | Keepall |
| Product link | — | `https://www.keepall.app/about` |
| Tagline | 60 | Save anything, find it fast, or let your AI agent do it all (59) |
| Description | 260 in the form | See below (257) |
| Launch tags | 1–3 | Productivity, Artificial Intelligence, Open Source |
| Pricing | — | Free |
| Logo | 240×240, JPG/PNG/GIF, 2 MB | `.qa/product-hunt/out/thumbnail-240.png` |
| Gallery | 1+ images, 1270×760 | Five frames from the film in `.qa/product-hunt/gallery/` (2540×1520) |
| Video | optional, by link | https://youtu.be/Lzl_rAK93zk (Unlisted) |
| Open source | optional | Yes: `https://github.com/MedLines/keepall` |
| Role | — | I made this |
| Company info | optional | Open source, Bootstrapped, team size 1–10 |
| MCP server | optional | Left empty: it asks for a hosted endpoint, and Keepall's connector runs locally through npx (`@keepall/mcp`) |

**Product link.** The About page, not the app root: a first visit to the root opens an empty library, while About shows the walkthroughs and has **Start your library** one click away.

**Other links.** Chrome Web Store: `https://chromewebstore.google.com/detail/keepall-capture/ehloefgfecmfjbncknaoleakbnjhkpea`. Agent guide: `https://www.keepall.app/help/ai-agents`.

**Tags.** Product Hunt has no Bookmarks tag. Productivity is where people browse for it, Artificial Intelligence carries the agent and MCP story, and Open Source marks it as free to inspect.

**Other taglines** (checked under 60):

- Keep anything. Find it fast. Or let your AI agent do it all. (60)
- Save and find anything yourself, or let your AI agent do it (59)

### Description

The submit form would not accept a longer description, so this is kept under 260. It opens with the no-sign-up start, since that is the first thing a visitor can try.

```text
Skip the sign-up: open Keepall and your first save takes seconds. A free, open-source home for links with pictures, images, videos, PDFs and notes. Sort it yourself, or let Claude Code, Codex or any MCP agent find, save and organize it. 100% on your device.
```

## Gallery

Frames from the launch film, so the listing and the video match. Order matters: the first is the one people see in the feed.

1. **Anything you want to keep. One place.** The library, full of everyday saves.
2. **Paste a link. Get a picture.** A recipe link bloomed into its preview card, with a trip and a wishlist link beside it.
3. **Images, videos, PDFs, notes. All of it.** One labeled card of each kind.
4. **…or ask your AI agent to do it.** The real review screen: Claude Code suggests a Recipes collection, waiting for Apply.
5. **100% on your device. 100% free.** No account · Works offline · Open source.

## Shoutouts

Each one is posted as a founder review on that product's page when the launch goes live.

- **Claude Code:** I built Keepall with Claude Code, and it was the first agent I connected to Keepall's own MCP connector. It follows a project's rules and design system, which kept a big local-first app consistent.
- **Figma:** Keepall's design system lives in Figma, matched to the code token for token, and the sample images in the launch video were generated in Figma too.
- **Vercel:** keepall.app runs on Vercel with Next.js. Your library stays in your browser, and Vercel only serves the app and fetches link previews.

## Maker comment

Limit 5,000 characters. It is pinned at the top when the launch goes live. The second paragraph was drafted for you; change it if it isn't how you'd say it.

```markdown
Hi Product Hunt! I'm Med, and I made Keepall.

I was saving things all over the place: bookmarks, screenshot folders, notes apps, read-later apps that later shut down. I wanted one place for all of it that shows what I saved, stays on my device, and that my AI agent can use too.

Keepall is a library for anything you want to keep: a recipe link, a random image you liked, a PDF you need, a note, a video, an article for later. Links show their picture, so your library looks like what you saved. It's free, open source (MIT), and it lives in your browser. There's no account to create and nothing to install, so your first save is seconds away. No cloud copy, either.

**Keep it**
- One click from any page with the Chrome extension, or right-click an image, a link or a passage.
- Images, videos, PDFs, Markdown and text files, articles you can read offline, and notes.

**Find it**
- Collections, tags and a quick Preview with Space.
- Search looks inside notes, PDFs, saved articles and the text in your screenshots. You can even search images by color.

**Or let your AI agent do it**
Keepall has an MCP connector. In Settings, Agents, pick Claude Code, Codex, OpenCode, Claude Desktop or another MCP client and paste one setup line. Your agent can then search your library, look at your images, save links, notes and files, and suggest collections and tags. You choose what it may do (read only, suggest changes, or make changes), suggestions wait for your review, and every agent change can be undone. Messages are end-to-end encrypted through a small relay that can't read them.

**What it doesn't do (yet)**
No sync between devices: each browser has its own library. A backup file moves it.

One question for you: **what would you ask an agent to do with everything you've saved?**
```

## Replies to prepare

- **"What if my browser clears my data?"** Browsers can evict site storage. Settings, Backup exports a `.keepall.zip`, and folder backups save a copy every 30 minutes while Keepall is open. Settings shows storage health.
- **"Does it sync?"** No. Each browser profile has its own library. A backup moves it to another browser or device.
- **"Does the AI read my library?"** Only an agent you connect, only with the access you choose (Read only, Suggest changes, or Make changes), and only while Keepall can be reached. The relay forwards encrypted messages it can't read. What the agent reads goes to its AI provider, as with anything else you share with that agent.
- **"How is this different from Raindrop / mymind / Pocket?"** It's local-first, free, and open source. It keeps files, PDFs, video, and offline articles alongside links, and your own agent can use it. Pocket and Omnivore have both shut down; a library on your device can't be shut down from under you.
- **"Firefox / Safari? Windows?"** The web app works in modern browsers on any operating system. The capture extension is Chrome only.
- **"Mobile?"** The web app works on phones and can be installed to the home screen. Each device has its own library.
- **"What happens when the page goes away?"** Save the article from a link's details and Keepall keeps a readable copy, with its images, that works offline. Capture can also add up to eight screenshots of the page to the saved link.
- **"What about duplicates?"** Saving a link you already have updates that item instead of adding a copy, and asks before changing its collection or tags.
- **"How is this different from Resurf?"** Resurf is a native app for Mac, iPhone, and iPad, with optional iCloud sync. Keepall runs in any modern browser, is free and open source, and an agent's changes wait for your review and can be undone.

## Reference: Resurf on Product Hunt

[Resurf](https://www.producthunt.com/products/resurf-2) is the closest comparison, and it launched again on November 22, 2026, the day before this was written. Read on November 23:

- **Launches.** September 13: "A Personal Context Library for Mac", #1 of the day, about 300 upvotes. November 22: "Personal Knowledge Base & Bookmark Manager for Mac", #3 of the day, 180 upvotes.
- **Pitch.** "A fully local personal context library for Mac, iPhone, and iPad. Save notes, links, images, and documents. Hand off context to AI through MCP or the CLI on Mac." That's close to Keepall's own pitch, so Product Hunt voters will compare the two. Lead with what Resurf doesn't have: any browser and OS, free and open source, and review before an agent changes anything.
- **Listing.** Topics: Productivity, Notes, Artificial Intelligence. Pricing: Free Options. Five PNG images in the gallery, with no video.
- **Maker comment.** About 350 words, first person and low-key: who he is, the problem (references scattered across bookmarks, screenshots, folders, and notes), how it grew from a capture widget, why personal context matters with MCP, five bold bullets of what's new, and where the library lives. It asks no question and has no offer.
- **Comments asked:** Windows support, what happens when a saved page disappears, how similarity search scales, why switch from Obsidian or Raindrop, and duplicates. The replies above cover each one for Keepall.

Only the product overview page was readable; the launch pages and the September launch's comments were not.

## Before launch

Scheduled for **Monday, November 30, 2026**: 12:01 AM PT, which is 08:01 UTC (10:01 in GMT+2). The launch day ends at 08:00 UTC on December 1.

- [x] **Keepall Capture.** Version 0.6.1 is live on the Chrome Web Store (checked November 27, 2026).
- [x] **GitHub.** Description and topics added on November 27, 2026.
- [x] **Video.** Uploaded as Unlisted on November 27, 2026: https://youtu.be/Lzl_rAK93zk, and set on the listing. The 62-second launch film is rendered in the separate `video-editor` Remotion project: `renders/keepall-launch-film-1080p60.mp4` (composition `KeepallLaunchFilm`, source in `src/kp2`). App scenes are Keepall's real DOM and CSS captured from the running app, Chrome scenes are real 2× captures of Chrome with Keepall Capture, and the sample saves are original images generated in Figma.
- [x] **Listing.** Every field is filled and the launch is scheduled. The date can still be changed from the draft.
- [x] **Contact form.** The live form sends through Resend. A test message sent on November 27, 2026 arrived.
- [x] **Relay capacity.** Deployed November 27, 2026: one IP address can open 60 new connections a minute and send 600 frames a minute across its channels (`docs/agent-access-plan.md`). That stops one address from flooding, not many addresses or a slow trickle that keeps Durable Objects awake. If abuse still exhausts the free plan's daily quota, agent access stops for everyone until midnight UTC. Watch the Cloudflare dashboard on launch day; Workers Paid turns that into a bill instead.
- [ ] **Link previews.** `/api/preview`, `/api/preview-image` and `/api/article` run on Vercel with no rate limit or caching. Check the plan's function and bandwidth usage on launch day.
- [ ] **Analytics.** `@vercel/analytics` is in the root layout. Confirm the Vercel dashboard records visits.
- [ ] **Product Hunt account.** Upvotes from established members count for more, so be active on the site before launch.

## Launch day

- A launch runs from 12:01 AM to midnight Pacific. In November that's 08:01 to 08:00 UTC the next day.
- Monday was picked over Thanksgiving weekend (US travel, Black Friday deals) and over Tuesday to Thursday (the most competing launches). It's a workday nearly everywhere, with fewer launches than midweek.
- Be present for the first hours and for the US morning (about 14:00–18:00 UTC). Reply to every comment.
- Share the link and ask for feedback. Never ask for upvotes: Product Hunt flags it as spam.
- Pick one or two goals, for example 30 pieces of feedback, or a number of agents connected.
