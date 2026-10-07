import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ read: vi.fn(), revision: vi.fn(), open: vi.fn() }));
vi.mock("./preview-layouts", () => ({ rememberPreviewLayout: vi.fn(async () => {}) }));
vi.mock("./db", () => ({ getDb: () => ({ documentAssets: { get: mocks.read } }) }));
vi.mock("./documents", () => ({ getDocumentRevision: mocks.revision }));
vi.mock("./pdf-document", () => ({ openPdf: mocks.open }));

beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks();
  mocks.revision.mockResolvedValue("one");
  mocks.read.mockResolvedValue({ bytes: new Uint8Array([1, 2, 3]) });
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/jpeg;base64,thumbnail");
});

test("renders only the first page, bounds pixels, shares the result, and releases the PDF", async () => {
  const render = vi.fn<(options: { canvas: HTMLCanvasElement }) => { promise: Promise<void> }>().mockReturnValue({ promise: Promise.resolve() });
  const getPage = vi.fn(async () => ({ getViewport: ({ scale }: { scale: number }) => ({ width: 1000 * scale, height: 2000 * scale }), render }));
  const destroy = vi.fn(async () => {});
  mocks.open.mockResolvedValue({ promise: Promise.resolve({ getPage }), destroy });
  const { getPdfThumbnail, peekPdfThumbnail } = await import("./pdf-thumbnail");
  expect(peekPdfThumbnail("a")).toBeNull();
  expect(await getPdfThumbnail("a")).toContain("data:image/jpeg");
  expect(peekPdfThumbnail("a")).toBe("data:image/jpeg;base64,thumbnail");
  expect(await getPdfThumbnail("a")).toContain("data:image/jpeg");
  expect(mocks.open).toHaveBeenCalledTimes(1);
  expect(getPage).toHaveBeenCalledExactlyOnceWith(1);
  const canvas = render.mock.calls[0][0].canvas as HTMLCanvasElement;
  expect(canvas.width).toBeLessThanOrEqual(480);
  expect(canvas.height).toBeLessThanOrEqual(640);
  const { rememberPreviewLayout } = await import("./preview-layouts");
  expect(rememberPreviewLayout).toHaveBeenCalledWith("a", canvas.width, canvas.height);
  expect(destroy).toHaveBeenCalledOnce();
  mocks.revision.mockResolvedValue("restored");
  await getPdfThumbnail("a");
  expect(mocks.open).toHaveBeenCalledTimes(2);
});

test("never renders more than two PDFs concurrently and continues after a failed page", async () => {
  const jobs: { resolve: () => void; reject: (error: Error) => void }[] = [];
  const destroys: ReturnType<typeof vi.fn>[] = [];
  mocks.open.mockImplementation(async () => {
    const promise = new Promise<void>((resolve, reject) => jobs.push({ resolve, reject }));
    const destroy = vi.fn(async () => {}); destroys.push(destroy);
    return { promise: Promise.resolve({ getPage: async () => ({ getViewport: () => ({ width: 480, height: 640 }), render: () => ({ promise }) }) }), destroy };
  });
  const { getPdfThumbnail } = await import("./pdf-thumbnail");
  const results = [getPdfThumbnail("a"), getPdfThumbnail("b"), getPdfThumbnail("c")];
  await vi.waitFor(() => expect(jobs).toHaveLength(2));
  jobs[0].reject(new Error("Broken page"));
  await vi.waitFor(() => expect(jobs).toHaveLength(3));
  jobs[1].resolve(); jobs[2].resolve();
  expect(await Promise.all(results)).toEqual([null, "data:image/jpeg;base64,thumbnail", "data:image/jpeg;base64,thumbnail"]);
  for (const destroy of destroys) expect(destroy).toHaveBeenCalledOnce();
});
