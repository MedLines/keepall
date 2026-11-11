import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, test, vi } from "vitest";

const workerSource = readFileSync("extension/worker.js", "utf8");
const MP4 = new Uint8Array([0, 0, 0, 24, ...[..."ftypisom"].map((c) => c.charCodeAt(0)), 0, 0, 2, 0]);
const HLS = "https://v1.pinimg.com/videos/iht/hls/d4/e2/8c/clip";

type Feedback = [number, string, boolean, ...unknown[]];
type Routes = Record<string, Uint8Array | string | ResponseInit & { body?: Uint8Array | string }>;

function worker(routes: Routes, found: string[] = []) {
  const sessions: Array<{ operation: string; payload: Record<string, unknown> }> = [];
  let manifest: { itemIds: string[]; files: { name: string; type: string; size: number }[]; metadata: object } | undefined;
  const chrome = {
    storage: { local: { setAccessLevel: vi.fn(async () => {}) }, session: { set: vi.fn(async () => {}) }, onChanged: { addListener: vi.fn() } },
    alarms: { create: vi.fn(), onAlarm: { addListener: vi.fn() } },
    runtime: {
      onInstalled: { addListener: vi.fn() }, onMessage: { addListener: vi.fn() },
      sendMessage: vi.fn(async (message: { operation: string; payload: Record<string, unknown> }) => {
        sessions.push(message);
        if (message.operation === "begin") manifest = message.payload as typeof manifest;
        if (message.operation === "commit") return { success: true, sessionId: "s", stage: "saving", results: [] };
        if (message.operation === "status") return { success: true, sessionId: "s", stage: "complete", results: [{ fileIndex: 0, status: "saved", itemId: manifest!.itemIds[0] }] };
        return { success: true, sessionId: "s", stage: "receiving", results: [] };
      }),
    },
    contextMenus: { onClicked: { addListener: vi.fn() } },
    permissions: { request: vi.fn(async () => true), contains: vi.fn(async () => true) },
    scripting: { executeScript: vi.fn(async () => [{ result: found }]) },
    tabs: { onUpdated: { addListener: vi.fn() }, onRemoved: { addListener: vi.fn() } },
    action: { onClicked: { addListener: vi.fn() }, setBadgeText: vi.fn(async () => {}), setTitle: vi.fn(async () => {}) },
    commands: { onCommand: { addListener: vi.fn() } },
  };
  const fetch = vi.fn(async (url: string) => {
    const route = routes[url];
    if (route === undefined) return new Response("missing", { status: 403 });
    if (typeof route === "string" || route instanceof Uint8Array) return new Response(route as BodyInit);
    const { body, ...init } = route;
    return new Response((body ?? null) as BodyInit | null, init);
  });
  const feedback: Feedback[] = [];
  const context: Record<string, unknown> = { chrome, crypto, URL, Response, AbortSignal, btoa, fetch, TextDecoder, setTimeout: (fn: () => void) => setTimeout(fn, 0) };
  runInNewContext(workerSource, context);
  Object.assign(context, {
    keepallOrigin: async () => "https://www.keepall.app",
    ensureOffscreen: async () => {}, requireLibraryAccess: async () => {}, notifyOpenKeepallTabs: async () => {},
    showFeedback: async (...args: Feedback) => { feedback.push(args); },
  });
  const save = (srcUrl: string, pageUrl = "https://example.com/post") =>
    (context.saveVideo as (tab: object, src: string, info: object) => Promise<void>)({ id: 3, url: pageUrl, title: "Neat interaction" }, srcUrl, { pageUrl, frameId: 2 });
  return { chrome, fetch, feedback, sessions, save, manifest: () => manifest };
}

test("downloads an MP4, sends it through the file transfer, and confirms with Open and Organize", async () => {
  const src = "https://cdn.example.com/media/hover%20demo.mov?x=1";
  const { chrome, feedback, sessions, save, manifest } = worker({ [src]: { body: MP4, headers: { "content-type": "application/octet-stream" } } });
  await save(src);
  expect(chrome.permissions.request).toHaveBeenCalledWith({ origins: ["https://cdn.example.com/*"] });
  expect(manifest()).toMatchObject({
    files: [{ name: "hover demo.mp4", type: "video/mp4", size: MP4.length }],
    imageMode: "separate", organization: {}, metadata: { title: "Neat interaction", sourceUrl: "https://example.com/post" },
  });
  expect(sessions.map(({ operation }) => operation)).toEqual(["begin", "chunk", "commit", "status"]);
  expect(atob(sessions[1].payload.data as string)).toBe(String.fromCharCode(...MP4));
  expect(feedback.at(-1)).toEqual([3, "Video saved to Keepall", true, "toolbar", undefined, expect.objectContaining({ canUndo: false })]);
});

test("finds a streamed Pinterest video's MP4 copy from the page", async () => {
  const { chrome, fetch, feedback, manifest, save } = worker(
    { "https://v1.pinimg.com/videos/iht/720p/d4/e2/8c/clip.mp4": MP4 },
    ["https://example.com/thumb.jpg", `${HLS}_240w.m3u8`],
  );
  await save("blob:https://www.pinterest.com/abc", "https://www.pinterest.com/pin/1/");
  expect(chrome.scripting.executeScript).toHaveBeenCalledWith(expect.objectContaining({
    target: { tabId: 3, frameIds: [2] }, world: "MAIN", args: ["blob:https://www.pinterest.com/abc"],
  }));
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(manifest()?.files[0].name).toBe("clip.mp4");
  expect(feedback.at(-1)?.slice(1, 3)).toEqual(["Video saved to Keepall", true]);
});

test("falls back to the stream's single fragmented-MP4 file, picking the largest variant up to 1080p", async () => {
  const master = [
    "#EXTM3U",
    '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="a",URI="clip_audio.m3u8"',
    "#EXT-X-STREAM-INF:BANDWIDTH=200000,RESOLUTION=256x144", "clip_240w.m3u8",
    "#EXT-X-STREAM-INF:BANDWIDTH=900000,RESOLUTION=720x1280", "clip_720w.m3u8",
    "#EXT-X-STREAM-INF:BANDWIDTH=4000000,RESOLUTION=2160x3840", "clip_2160w.m3u8",
  ].join("\n");
  const media = ['#EXT-X-MAP:URI="clip_720w.cmfv",BYTERANGE="972@0"', "#EXT-X-BYTERANGE:100@1168", "clip_720w.cmfv", "#EXT-X-BYTERANGE:100@1268", "clip_720w.cmfv"].join("\n");
  const { feedback, manifest, save } = worker(
    { [`${HLS}.m3u8`]: master, [`${HLS}_720w.m3u8`]: media, [`${HLS}_720w.cmfv`]: MP4 },
    [`${HLS}.m3u8`],
  );
  await save("blob:https://www.pinterest.com/abc", "https://www.pinterest.com/pin/1/");
  expect(manifest()?.files[0]).toEqual({ name: "clip_720w.mp4", type: "video/mp4", size: MP4.length });
  expect(feedback.at(-1)?.slice(1, 3)).toEqual(["Video saved to Keepall without sound", true]);
});

test("explains streams split into many segments, unknown blobs, and other formats without saving", async () => {
  const segmented = worker(
    { "https://example.com/v.m3u8": "#EXTM3U\n#EXTINF:2\nseg1.ts\n#EXTINF:2\nseg2.ts" },
    ["https://example.com/v.m3u8"],
  );
  await segmented.save("blob:https://example.com/123");
  expect(segmented.sessions).toEqual([]);
  expect(segmented.feedback.at(-1)?.slice(1, 3)).toEqual(["This video streams in pieces, so Keepall can't save it as a file.", false]);

  const unknown = worker({});
  await unknown.save("blob:https://example.com/123");
  expect(unknown.fetch).not.toHaveBeenCalled();
  expect(unknown.feedback.at(-1)?.slice(1, 3)).toEqual(["This video streams in pieces, so Keepall can't save it as a file.", false]);

  const other = worker({ "https://example.com/video.avi": "RIFF....AVI " });
  await other.save("https://example.com/video.avi");
  expect(other.sessions).toEqual([]);
  expect(other.feedback.at(-1)?.slice(1, 3)).toEqual(["Keepall can save MP4 or WebM videos. This one uses another format.", false]);
});

test("rejects a video over 100 MiB from its declared size", async () => {
  const src = "https://example.com/big.mp4";
  const { feedback, sessions, save } = worker({ [src]: { body: MP4, headers: { "content-length": String(101 * 1024 * 1024) } } });
  await save(src);
  expect(sessions).toEqual([]);
  expect(feedback.at(-1)?.slice(1, 3)).toEqual(["Video must be 100 MiB or smaller.", false]);
});

test("finds the clicked player's address in nested React props and ignores other players", () => {
  const context: Record<string, unknown> = { chrome: { storage: { local: { setAccessLevel: async () => {} }, onChanged: { addListener() {} } }, alarms: { create() {}, onAlarm: { addListener() {} } }, runtime: { onInstalled: { addListener() {} }, onMessage: { addListener() {} } }, contextMenus: { onClicked: { addListener() {} } }, tabs: { onUpdated: { addListener() {} }, onRemoved: { addListener() {} } }, action: { onClicked: { addListener() {} } }, commands: { onCommand: { addListener() {} } } }, crypto, URL };
  runInNewContext(workerSource, context);
  // Chrome serializes the function into the page, so run its source against this document.
  const find = new Function(`return ${String(context.findVideoSources)}`)() as (blobUrl: string) => string[];
  const player = (blob: string, src: unknown) => {
    const video = document.createElement("video");
    video.src = blob;
    Object.assign(video, { "__reactFiber$test": { memoizedProps: { className: "v" }, return: {
      memoizedProps: { poster: "https://i.pinimg.com/p.jpg", children: { $$typeof: Symbol.for("react.element"), props: { src: "https://evil.example/x.mp4" } }, src },
      return: null,
    } } });
    document.body.append(video);
  };
  player("blob:https://www.pinterest.com/a", [{ type: "video/m3u8", src: `${HLS}.m3u8` }]);
  player("blob:https://www.pinterest.com/b", "https://v1.pinimg.com/videos/iht/hls/other.m3u8");
  expect(find("blob:https://www.pinterest.com/a")).toEqual([`${HLS}.m3u8`]);
  expect(find("blob:https://www.pinterest.com/b")).toEqual(["https://v1.pinimg.com/videos/iht/hls/other.m3u8"]);
  expect(find("blob:https://www.pinterest.com/missing")).toEqual([]);
});
