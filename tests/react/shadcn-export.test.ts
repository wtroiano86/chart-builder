import { afterEach, expect, it, vi } from "vitest";
import { exportChartImage } from "../../resources/react/adapters/shadcn/export";
import type { ImageExportRequest } from "@wtroiano/chart-builder-sdk";

const request: ImageExportRequest = {
    format: "svg",
    scale: 1,
    background: null,
};
function host() {
    const node = document.createElement("div");
    node.style.backgroundColor = "rgb(15, 23, 42)";
    node.innerHTML =
        '<svg class="recharts-surface" xmlns="http://www.w3.org/2000/svg" width="640" height="320"><defs><clipPath id="clip"><rect width="600" height="280" /></clipPath></defs><path d="M10 20 L60 80" style="stroke: rgb(255, 0, 0); fill: none; clip-path: url(#clip)"/><text x="20" y="20">$12,500.00</text><path class="recharts-tooltip-cursor" d="M0 0"/></svg>';
    document.body.append(node);
    return node;
}
function text(blob: Blob): Promise<string> {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.readAsText(blob);
    });
}
afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

it("produces a standalone SVG with paths, formatting, clipping and the resolved background", async () => {
    const source = host();
    const before = source.innerHTML;
    const blob = await exportChartImage(
        source,
        request,
        new AbortController().signal,
    );
    expect(blob.type).toBe("image/svg+xml;charset=utf-8");
    const result = new DOMParser().parseFromString(
        await text(blob),
        "image/svg+xml",
    );
    expect(result.querySelector("parsererror")).toBeNull();
    expect(result.documentElement.getAttribute("viewBox")).toBe("0 0 640 320");
    expect(result.querySelector("path")?.getAttribute("d")).toBe(
        "M10 20 L60 80",
    );
    expect(result.querySelector("path")?.getAttribute("style")).toContain(
        "rgb(255, 0, 0)",
    );
    expect(result.querySelector("path")?.getAttribute("style")).toMatch(
        /url\(["']?#clip["']?\)/,
    );
    expect(result.documentElement.firstElementChild?.getAttribute("fill")).toBe(
        "rgb(15, 23, 42)",
    );
    expect(result.querySelector("text")?.textContent).toBe("$12,500.00");
    expect(result.querySelectorAll("path")).toHaveLength(1);
    expect(source.innerHTML).toBe(before);
});

it.each<Partial<ImageExportRequest>>([
    { format: "pdf" },
    { format: "jpeg" },
    { scale: 2 },
    { scale: 0 },
    { format: "png", scale: -1 },
    { format: "png", scale: NaN },
    { format: "png", scale: Infinity },
    { format: "png", scale: 10000 },
    { background: "not-a-color" },
])(
    "rejects unsupported requests before allocating a canvas: %j",
    async (options) => {
        const canvas = vi.spyOn(HTMLCanvasElement.prototype, "getContext");
        await expect(
            exportChartImage(
                host(),
                { ...request, ...options },
                new AbortController().signal,
            ),
        ).rejects.toThrow();
        expect(canvas).not.toHaveBeenCalled();
    },
);

it("rejects hidden, missing and detached chart surfaces", async () => {
    const source = host();
    source.querySelector("svg")!.setAttribute("width", "0");
    await expect(
        exportChartImage(source, request, new AbortController().signal),
    ).rejects.toThrow("dimensions");
    source.innerHTML = "";
    await expect(
        exportChartImage(source, request, new AbortController().signal),
    ).rejects.toThrow("not ready");
    source.remove();
    await expect(
        exportChartImage(source, request, new AbortController().signal),
    ).rejects.toThrow("disposed");
});

it("cancels while waiting for fonts when the chart is disposed", async () => {
    const original = Object.getOwnPropertyDescriptor(document, "fonts");
    Object.defineProperty(document, "fonts", {
        configurable: true,
        value: { ready: new Promise(() => {}) },
    });
    try {
        const controller = new AbortController();
        const pending = exportChartImage(host(), request, controller.signal);
        controller.abort();
        await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    } finally {
        if (original) Object.defineProperty(document, "fonts", original);
        else Reflect.deleteProperty(document, "fonts");
    }
});

it("releases the image URL when decoding a PNG source fails", async () => {
    vi.stubGlobal(
        "Image",
        class {
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            set src(_: string) {
                queueMicrotask(() => this.onerror?.());
            }
        },
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
        drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    const create = vi.fn(() => "blob:export-test");
    const revoke = vi.fn();
    vi.stubGlobal(
        "URL",
        class extends URL {
            static createObjectURL = create;
            static revokeObjectURL = revoke;
        },
    );
    await expect(
        exportChartImage(
            host(),
            { ...request, format: "png" },
            new AbortController().signal,
        ),
    ).rejects.toThrow("decode");
    expect(revoke).toHaveBeenCalledWith("blob:export-test");
});

it("cleans up when PNG encoding fails or cancellation arrives during encoding", async () => {
    vi.stubGlobal(
        "Image",
        class {
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            set src(_: string) {
                queueMicrotask(() => this.onload?.());
            }
        },
    );
    const draw = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
        drawImage: draw,
    } as unknown as CanvasRenderingContext2D);
    const revoke = vi.fn();
    vi.stubGlobal(
        "URL",
        class extends URL {
            static createObjectURL = () => "blob:export-test";
            static revokeObjectURL = revoke;
        },
    );
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
        (callback) => callback(null),
    );
    await expect(
        exportChartImage(
            host(),
            { ...request, format: "png", scale: 2 },
            new AbortController().signal,
        ),
    ).rejects.toThrow("encode");
    expect(draw).toHaveBeenCalledWith(expect.anything(), 0, 0, 1280, 640);
    expect(revoke).toHaveBeenCalledTimes(1);
    const controller = new AbortController();
    vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation(
        (callback) => {
            controller.abort();
            callback(new Blob([], { type: "image/png" }));
        },
    );
    await expect(
        exportChartImage(
            host(),
            { ...request, format: "png" },
            controller.signal,
        ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(revoke).toHaveBeenCalledTimes(2);
});
