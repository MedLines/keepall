import {
  PREVIEW_ENRICH_CONCURRENCY,
  PREVIEW_ENRICH_WELCOME_BATCH_SIZE,
  linkNeedsPreviewEnrich,
} from "@/domain/preview-enrich";
import type { LinkItem } from "@/domain/link";
import { listItems } from "@/persistence/items";
import { enrichLinkPreview } from "./enrich-link-preview";
import {
  clearStoredWelcomeBatch,
  readStoredWelcomeBatch,
  writeStoredWelcomeBatch,
  type StoredWelcomeBatch,
} from "./preview-welcome-storage";

type QueueEntry = {
  linkId: string;
  url: string;
  priority: number;
};

export type PreviewEnrichProgress = {
  kind: "welcome";
  total: number;
  done: number;
} | null;

type ProgressListener = (progress: PreviewEnrichProgress) => void;

const queue: QueueEntry[] = [];
const queuedIds = new Set<string>();
const inFlightIds = new Set<string>();
let welcomeIds = new Set<string>();
let welcomeTotal = 0;
let welcomeDone = 0;
const progressListeners = new Set<ProgressListener>();

function notifyProgress() {
  const progress: PreviewEnrichProgress =
    welcomeTotal > 0
      ? { kind: "welcome", total: welcomeTotal, done: welcomeDone }
      : null;
  for (const listener of progressListeners) {
    listener(progress);
  }
}

function persistWelcomeBatch() {
  if (welcomeTotal === 0) {
    clearStoredWelcomeBatch();
    return;
  }
  if (welcomeIds.size === 0) {
    clearStoredWelcomeBatch();
    return;
  }
  writeStoredWelcomeBatch({
    total: welcomeTotal,
    done: welcomeDone,
    remainingLinkIds: [...welcomeIds],
  });
}

function clearWelcomeProgress() {
  welcomeIds = new Set();
  welcomeTotal = 0;
  welcomeDone = 0;
  clearStoredWelcomeBatch();
  notifyProgress();
}

function markWelcomeLinkDone(linkId: string) {
  if (!welcomeIds.has(linkId)) {
    return;
  }
  welcomeIds.delete(linkId);
  welcomeDone += 1;
  notifyProgress();
  if (welcomeIds.size === 0) {
    clearWelcomeProgress();
    return;
  }
  persistWelcomeBatch();
}

/** Test-only reset — module singleton state must not leak between Vitest cases. */
export function resetPreviewEnrichCoordinatorForTests(): void {
  queue.length = 0;
  queuedIds.clear();
  inFlightIds.clear();
  welcomeIds = new Set();
  welcomeTotal = 0;
  welcomeDone = 0;
  clearStoredWelcomeBatch();
}

function enqueue(entry: QueueEntry) {
  if (queuedIds.has(entry.linkId) || inFlightIds.has(entry.linkId)) {
    return;
  }
  queuedIds.add(entry.linkId);
  queue.push(entry);
  queue.sort((a, b) => a.priority - b.priority);
  pumpQueue();
}

function pumpQueue() {
  while (
    inFlightIds.size < PREVIEW_ENRICH_CONCURRENCY &&
    queue.length > 0
  ) {
    const next = queue.shift();
    if (!next) {
      break;
    }
    queuedIds.delete(next.linkId);
    if (inFlightIds.has(next.linkId)) {
      continue;
    }
    inFlightIds.add(next.linkId);
    persistWelcomeBatch();
    void enrichLinkPreview(next.linkId, next.url).finally(() => {
      inFlightIds.delete(next.linkId);
      markWelcomeLinkDone(next.linkId);
      pumpQueue();
    });
  }
}

export function subscribePreviewEnrichProgress(
  listener: ProgressListener,
): () => void {
  progressListeners.add(listener);
  listener(
    welcomeTotal > 0
      ? { kind: "welcome", total: welcomeTotal, done: welcomeDone }
      : null,
  );
  return () => {
    progressListeners.delete(listener);
  };
}

function welcomeLinkStillNeedsWork(link: LinkItem): boolean {
  return linkNeedsPreviewEnrich(link) || link.previewStatus === "pending";
}

async function linksForWelcomeIds(linkIds: string[]): Promise<{
  remaining: LinkItem[];
  finishedWhileAway: number;
}> {
  const items = await listItems();
  const byId = new Map(
    items
      .filter((item): item is LinkItem => item.type === "link")
      .map((link) => [link.id, link]),
  );

  const remaining: LinkItem[] = [];
  let finishedWhileAway = 0;

  for (const id of linkIds) {
    const link = byId.get(id);
    if (!link || !welcomeLinkStillNeedsWork(link)) {
      finishedWhileAway += 1;
      continue;
    }
    remaining.push(link);
  }

  return { remaining, finishedWhileAway };
}

function beginWelcomeBatch(links: LinkItem[], progress: StoredWelcomeBatch) {
  welcomeIds = new Set(links.map((link) => link.id));
  welcomeTotal = progress.total;
  welcomeDone = progress.done;
  notifyProgress();
  persistWelcomeBatch();

  for (const link of links) {
    enqueue({ linkId: link.id, url: link.url, priority: 0 });
  }
}

/** After import: enrich up to 100 idle links from the given ids, queued 1–2 at a time. */
export async function startPreviewWelcomeBatch(
  linkIds: string[],
): Promise<void> {
  if (linkIds.length === 0) {
    return;
  }

  const items = await listItems();
  const idleLinks = items.filter(
    (item): item is LinkItem =>
      item.type === "link" &&
      linkIds.includes(item.id) &&
      linkNeedsPreviewEnrich(item),
  );
  const batch = idleLinks.slice(0, PREVIEW_ENRICH_WELCOME_BATCH_SIZE);
  if (batch.length === 0) {
    return;
  }

  beginWelcomeBatch(batch, {
    total: batch.length,
    done: 0,
    remainingLinkIds: batch.map((link) => link.id),
  });
}

/** Continue a stored welcome batch after reload or tab reopen. */
export async function resumePreviewWelcomeBatch(): Promise<void> {
  const stored = readStoredWelcomeBatch();
  if (!stored) {
    return;
  }

  const { remaining, finishedWhileAway } = await linksForWelcomeIds(
    stored.remainingLinkIds,
  );
  const done = stored.done + finishedWhileAway;

  if (remaining.length === 0) {
    if (done >= stored.total) {
      clearWelcomeProgress();
    } else {
      clearStoredWelcomeBatch();
    }
    return;
  }

  beginWelcomeBatch(remaining, {
    total: stored.total,
    done,
    remainingLinkIds: remaining.map((link) => link.id),
  });
}

/** Viewport / scroll: queue one idle link for enrich when it enters view. */
export function requestPreviewEnrichViewport(linkId: string, url: string): void {
  enqueue({ linkId, url, priority: 1 });
}
