import { afterEach, expect, test, vi } from "vitest";
import { captureVideoPoster, prepareLocalVideo, snapshotVideoPoster, videoFrameHasContent } from "./prepare-local-video";

afterEach(() => vi.restoreAllMocks());

test("poster selection skips a black opening and releases the video file", async () => {
  const video = document.createElement("video");
  let time = 0;
  const seeks: number[] = [];
  Object.defineProperties(video, {
    videoWidth: { value: 1920 }, videoHeight: { value: 1080 }, duration: { value: 20 },
    currentTime: { get: () => time, set: value => { time = value; seeks.push(value); queueMicrotask(() => video.dispatchEvent(new Event("seeked"))); } },
  });
  vi.spyOn(video, "canPlayType").mockReturnValue("probably");
  const load = vi.spyOn(video, "load").mockImplementation(() => { if (video.getAttribute("src")) queueMicrotask(() => video.dispatchEvent(new Event("loadeddata"))); });
  const create = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation((tag, options) => tag === "video" ? video : create(tag, options));
  const pixels = new Uint8ClampedArray(12 * 12 * 4);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => ({ drawImage: vi.fn(), getImageData: () => { pixels.fill(time < 5 ? 0 : 100); return { data: pixels }; } }) as unknown as CanvasRenderingContext2D);
  const poster = new Blob(["poster"], { type: "image/webp" });
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(callback => callback(poster));
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:import-video");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  expect(await prepareLocalVideo(new File(["video"], "clip.webm", { type: "video/webm" }))).toBe(poster);
  expect(seeks).toEqual([2.4, 8.4]);
  expect(video.getAttribute("src")).toBeNull();
  expect(load).toHaveBeenCalledTimes(2);
  expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:import-video");
});

test("posters preserve proportions with a maximum dimension of 640", async () => {
  const video = document.createElement("video");
  Object.defineProperties(video, { videoWidth: { value: 1920 }, videoHeight: { value: 1080 } });
  const drawImage = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
  const encode = vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(callback => callback(new Blob(["poster"])));
  await captureVideoPoster(video);
  expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 640, 360);
  expect(encode).toHaveBeenCalledWith(expect.any(Function), "image/webp", 0.8);
});

test("black-frame detection ignores isolated bright pixels", () => {
  const pixels = new Uint8ClampedArray(12 * 12 * 4);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn(), getImageData: () => ({ data: pixels }) } as unknown as CanvasRenderingContext2D);
  const video = document.createElement("video");
  pixels[0] = 255;
  expect(videoFrameHasContent(video)).toBe(false);
  for (let index = 0; index < 24; index += 4) pixels[index] = 100;
  expect(videoFrameHasContent(video)).toBe(true);
});

test("freezes the preview's starting frame before deferring WebP encoding", async () => {
  const video = document.createElement("video");
  Object.defineProperties(video, { videoWidth: { value: 1920 }, videoHeight: { value: 1080 } });
  video.currentTime = 2.4;
  const frames: number[] = [];
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: () => frames.push(video.currentTime) } as unknown as CanvasRenderingContext2D);
  const encode = vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(callback => callback(new Blob(["poster"])));
  const snapshot = snapshotVideoPoster(video);
  expect(frames).toEqual([2.4]);
  expect(encode).not.toHaveBeenCalled();
  video.currentTime = 2.6;
  await snapshot();
  expect(frames).toEqual([2.4]);
  expect(encode).toHaveBeenCalledOnce();
});
