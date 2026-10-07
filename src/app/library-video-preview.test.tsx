import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { getVideoBlob } from "@/persistence/videos";
import { LibraryVideoPreview } from "./library-video-preview";
import { captureVideoPoster, snapshotVideoPoster } from "./prepare-local-video";

vi.mock("@/persistence/videos", () => ({ getVideoBlob: vi.fn() }));
vi.mock("./prepare-local-video", async importOriginal => {
  const actual = await importOriginal<typeof import("./prepare-local-video")>();
  const capture = vi.fn().mockResolvedValue(new Blob(["poster"]));
  return { ...actual, captureVideoPoster: capture, snapshotVideoPoster: vi.fn(() => capture), videoFrameHasContent: vi.fn().mockReturnValue(true) };
});
vi.mock("@/persistence/thumbnails", () => ({ putThumbnail: vi.fn().mockResolvedValue(undefined) }));
vi.mock("./asset-object-url-cache", () => ({ invalidateThumbnailObjectUrl: vi.fn() }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(getVideoBlob).mockReset().mockResolvedValue(new Blob(["video"]));
  vi.mocked(captureVideoPoster).mockClear();
  vi.mocked(snapshotVideoPoster).mockClear();
  vi.spyOn(window, "matchMedia").mockImplementation(query => ({ matches: query.includes("hover: hover"), media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:hover-preview");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

async function dwell() { await act(async () => { await vi.advanceTimersByTimeAsync(150); }); }

test("does not read a video or mount a decoder until hover intent settles", async () => {
  const onStop = vi.fn();
  const view = render(<LibraryVideoPreview assetId="video" active={false} onStop={onStop} />);
  await dwell();
  expect(getVideoBlob).not.toHaveBeenCalled();
  expect(view.container.querySelector("video")).toBeNull();
  view.rerender(<LibraryVideoPreview assetId="video" active onStop={onStop} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(149); });
  expect(getVideoBlob).not.toHaveBeenCalled();
  view.rerender(<LibraryVideoPreview assetId="video" active={false} onStop={onStop} />);
  await dwell();
  expect(getVideoBlob).not.toHaveBeenCalled();
});

test("abandons a slow file read after leaving the card", async () => {
  let resolve!: (blob: Blob) => void;
  vi.mocked(getVideoBlob).mockReturnValue(new Promise(done => { resolve = done; }));
  const onStop = vi.fn();
  const view = render(<LibraryVideoPreview assetId="video" active onStop={onStop} />);
  await dwell();
  view.rerender(<LibraryVideoPreview assetId="video" active={false} onStop={onStop} />);
  await act(async () => resolve(new Blob(["late"])));
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});

test("samples three parts, stops on scroll, and releases the file before re-entering", async () => {
  const onStop = vi.fn();
  const view = render(<LibraryVideoPreview assetId="video" active onStop={onStop} />);
  await dwell();
  const video = view.container.querySelector("video")!;
  expect(video).toHaveAttribute("src", "blob:hover-preview");
  Object.defineProperty(video, "duration", { configurable: true, value: 100 });
  fireEvent.loadedMetadata(video);
  expect(video.currentTime).toBe(5);
  fireEvent.seeked(video);
  video.currentTime = 6.5;
  fireEvent.timeUpdate(video);
  expect(video.currentTime).toBe(42);
  fireEvent.seeked(video);
  video.currentTime = 43.5;
  fireEvent.timeUpdate(video);
  expect(video.currentTime).toBe(72);
  fireEvent.scroll(window);
  expect(onStop).toHaveBeenCalledTimes(1);
  expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:hover-preview");
  expect(view.container.querySelector("video")).toBeNull();
  view.rerender(<LibraryVideoPreview assetId="video" active={false} onStop={onStop} />);
  view.rerender(<LibraryVideoPreview assetId="video" active onStop={onStop} />);
  expect(view.container.querySelector("video")).toBeNull();
  await dwell();
  expect(getVideoBlob).toHaveBeenCalledTimes(2);
  expect(view.container.querySelector("video")).toHaveAttribute("src", "blob:hover-preview");
});

test.each(["reduced motion", "coarse pointer"])("honors %s without reading the video", async preference => {
  vi.mocked(window.matchMedia).mockImplementation(query => ({ matches: query.includes("prefers-reduced-motion") ? preference === "reduced motion" : preference !== "coarse pointer", media: query } as MediaQueryList));
  const view = render(<LibraryVideoPreview assetId="video" active onStop={vi.fn()} />);
  await dwell();
  expect(getVideoBlob).not.toHaveBeenCalled();
  expect(view.container.querySelector("video")).toBeNull();
});

test("only one card owns a decoder and a preview stops after six seconds", async () => {
  const firstStop = vi.fn();
  const first = render(<LibraryVideoPreview assetId="first" active onStop={firstStop} />);
  await dwell();
  const secondStop = vi.fn();
  const second = render(<LibraryVideoPreview assetId="second" active onStop={secondStop} />);
  await dwell();
  expect(firstStop).toHaveBeenCalledTimes(1);
  expect(first.container.querySelector("video")).toBeNull();
  const video = second.container.querySelector("video")!;
  Object.defineProperty(video, "duration", { value: 100 });
  fireEvent.loadedMetadata(video);
  fireEvent.seeked(video);
  await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
  expect(secondStop).toHaveBeenCalledTimes(1);
  expect(second.container.querySelector("video")).toBeNull();
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
});

test("starts playback before poster work and cancels that work when scrolling", async () => {
  const view = render(<LibraryVideoPreview assetId="poster-timing" active onStop={vi.fn()} />);
  await dwell();
  const video = view.container.querySelector("video")!;
  Object.defineProperties(video, { duration: { value: 100 }, videoWidth: { value: 1920 }, videoHeight: { value: 1080 } });
  fireEvent.loadedMetadata(video);
  await act(async () => { fireEvent.seeked(video); });
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
  expect(snapshotVideoPoster).toHaveBeenCalledExactlyOnceWith(video);
  expect(captureVideoPoster).not.toHaveBeenCalled();
  await act(async () => { await vi.advanceTimersByTimeAsync(199); });
  expect(captureVideoPoster).not.toHaveBeenCalled();
  fireEvent.scroll(window);
  await act(async () => { await vi.advanceTimersByTimeAsync(200); });
  expect(captureVideoPoster).not.toHaveBeenCalled();
});

test("refreshes the poster after playback has started", async () => {
  const view = render(<LibraryVideoPreview assetId="delayed-poster" active onStop={vi.fn()} />);
  await dwell();
  const video = view.container.querySelector("video")!;
  Object.defineProperties(video, { duration: { value: 100 }, videoWidth: { value: 1920 }, videoHeight: { value: 1080 } });
  fireEvent.loadedMetadata(video);
  await act(async () => { fireEvent.seeked(video); });
  await act(async () => { await vi.advanceTimersByTimeAsync(200); });
  expect(captureVideoPoster).toHaveBeenCalledOnce();
});

test("keeps the thumbnail visible until a video frame is presented and cancels pending callbacks", async () => {
  let present!: VideoFrameRequestCallback;
  const request = vi.fn((callback: VideoFrameRequestCallback) => { present = callback; return 7; });
  const cancel = vi.fn();
  const view = render(<LibraryVideoPreview assetId="presented-frame" active onStop={vi.fn()} />);
  await dwell();
  const video = view.container.querySelector("video")!;
  Object.assign(video, { requestVideoFrameCallback: request, cancelVideoFrameCallback: cancel });
  Object.defineProperties(video, { duration: { value: 100 }, videoWidth: { value: 1920 }, videoHeight: { value: 1080 } });
  fireEvent.loadedMetadata(video);
  await act(async () => { fireEvent.seeked(video); });
  fireEvent.play(video);
  fireEvent.playing(video);
  expect(video).toHaveAttribute("data-video-preview", "loading");
  act(() => present(0, {} as VideoFrameCallbackMetadata));
  expect(video).toHaveAttribute("data-video-preview", "playing");
  fireEvent.scroll(window);
  expect(cancel).not.toHaveBeenCalled();
  view.rerender(<LibraryVideoPreview assetId="unpresented-frame" active onStop={vi.fn()} />);
  await dwell();
  const next = view.container.querySelector("video")!;
  Object.assign(next, { requestVideoFrameCallback: request, cancelVideoFrameCallback: cancel });
  Object.defineProperty(next, "duration", { value: 100 });
  fireEvent.loadedMetadata(next);
  await act(async () => { fireEvent.seeked(next); });
  fireEvent.scroll(window);
  expect(cancel).toHaveBeenCalledExactlyOnceWith(7);
  act(() => present(0, {} as VideoFrameCallbackMetadata));
  expect(view.container.querySelector("video")).toBeNull();
});
