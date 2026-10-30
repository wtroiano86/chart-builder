import type { ImageExportRequest } from "@wtroiano/chart-builder-sdk";

const namespace = "http://www.w3.org/2000/svg";
const maxSide = 16384;
const maxPixels = 16_777_216;
const styles = [
    "color",
    "fill",
    "fill-opacity",
    "fill-rule",
    "stroke",
    "stroke-width",
    "stroke-opacity",
    "stroke-dasharray",
    "stroke-dashoffset",
    "stroke-linecap",
    "stroke-linejoin",
    "stroke-miterlimit",
    "opacity",
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "letter-spacing",
    "text-anchor",
    "dominant-baseline",
    "paint-order",
    "vector-effect",
    "visibility",
    "display",
    "clip-path",
    "filter",
];

function element(
    name: string,
    attributes: Record<string, string | number> = {},
): SVGElement {
    const node = document.createElementNS(namespace, name);
    for (const [key, value] of Object.entries(attributes))
        node.setAttribute(key, String(value));
    return node;
}

function localReferences(value: string): string {
    return value.replace(/url\(["']?([^\s)"']+)["']?\)/g, (_, url: string) => {
        const hash = url.indexOf("#");
        if (
            hash < 0 ||
            (hash > 0 &&
                new URL(url, document.baseURI).href.split("#")[0] !==
                    document.URL.split("#")[0])
        )
            throw new Error("Image export requires local SVG resources.");
        return "url(" + url.slice(hash) + ")";
    });
}

function copySvg(source: SVGElement): SVGElement {
    if (source.querySelector("foreignObject, image, use"))
        throw new Error(
            "Image export requires inline SVG paths and text, without linked images or HTML.",
        );
    const copy = source.cloneNode(true) as SVGElement;
    const originals = [source, ...source.querySelectorAll<SVGElement>("*")];
    const copies = [copy, ...copy.querySelectorAll<SVGElement>("*")];
    originals.forEach((original, index) => {
        const target = copies[index];
        if (original.matches(".recharts-tooltip-cursor")) {
            target.remove();
            return;
        }
        const computed = getComputedStyle(original);
        target.removeAttribute("class");
        target.removeAttribute("style");
        for (const property of styles) {
            const value = computed.getPropertyValue(property);
            if (value) {
                target.removeAttribute(property);
                target.style.setProperty(property, localReferences(value));
            }
        }
        for (const attribute of [...target.attributes]) {
            if (
                attribute.name.startsWith("on") ||
                attribute.name === "tabindex"
            )
                target.removeAttribute(attribute.name);
        }
    });
    copy.querySelectorAll(
        "script, foreignObject, image, use, style, .recharts-tooltip-cursor",
    ).forEach((node) => node.remove());
    return copy;
}

// Shadcn legends are HTML siblings of the SVG. Preserve their measured text,
// swatches and SVG icons as vectors, without foreignObject or page CSS.
function appendLegend(
    output: SVGElement,
    host: HTMLElement,
    origin: DOMRect,
): void {
    const legend = host.querySelector<HTMLElement>(".recharts-legend-wrapper");
    if (!legend) return;
    const visit = (node: Node) => {
        if (node instanceof Element) {
            const computed = getComputedStyle(node);
            if (computed.display === "none" || computed.visibility === "hidden")
                return;
            const bounds = node.getBoundingClientRect();
            if (node instanceof SVGSVGElement) {
                const icon = copySvg(node);
                icon.setAttribute("x", String(bounds.left - origin.left));
                icon.setAttribute("y", String(bounds.top - origin.top));
                icon.setAttribute("width", String(bounds.width));
                icon.setAttribute("height", String(bounds.height));
                output.append(icon);
                return;
            }
            const background = computed.backgroundColor;
            if (
                bounds.width &&
                bounds.height &&
                background &&
                background !== "transparent" &&
                background !== "rgba(0, 0, 0, 0)"
            ) {
                output.append(
                    element("rect", {
                        x: bounds.left - origin.left,
                        y: bounds.top - origin.top,
                        width: bounds.width,
                        height: bounds.height,
                        fill: background,
                        rx: parseFloat(computed.borderRadius) || 0,
                    }),
                );
            }
        } else if (
            node.nodeType === Node.TEXT_NODE &&
            node.textContent?.trim() &&
            node.parentElement
        ) {
            const range = document.createRange();
            range.selectNodeContents(node);
            const bounds = range.getBoundingClientRect();
            const computed = getComputedStyle(node.parentElement);
            const text = element("text", {
                x: bounds.left - origin.left,
                y: bounds.top - origin.top,
                fill: computed.color,
                "dominant-baseline": "text-before-edge",
            });
            for (const property of [
                "font-family",
                "font-size",
                "font-weight",
                "font-style",
                "letter-spacing",
            ])
                text.style.setProperty(
                    property,
                    computed.getPropertyValue(property),
                );
            text.textContent = node.textContent;
            output.append(text);
        }
        node.childNodes.forEach(visit);
    };
    visit(legend);
}

function backgroundColor(host: HTMLElement, requested: string | null): string {
    if (requested !== null) {
        const probe = document.createElement("span");
        probe.style.color = requested;
        if (!probe.style.color)
            throw new Error("Invalid export background color.");
        probe.style.display = "none";
        host.append(probe);
        try {
            return getComputedStyle(probe).color;
        } finally {
            probe.remove();
        }
    }
    for (let node: HTMLElement | null = host; node; node = node.parentElement) {
        const color = getComputedStyle(node).backgroundColor;
        if (color && color !== "transparent" && color !== "rgba(0, 0, 0, 0)")
            return color;
    }
    return "transparent";
}

/** Capture only the mounted chart; never retain a data URL or DOM snapshot. */
export async function exportChartImage(
    host: HTMLElement,
    request: ImageExportRequest,
    signal: AbortSignal,
): Promise<Blob> {
    signal.throwIfAborted();
    if (
        !["svg", "png"].includes(request.format) ||
        !Number.isFinite(request.scale) ||
        request.scale <= 0 ||
        (request.format === "svg" && request.scale !== 1)
    )
        throw new Error(
            "Unsupported image format or scale. SVG requires scale 1; PNG requires a positive finite scale.",
        );
    // Wait for application fonts before measuring the legend or cloning text.
    await new Promise<void>((resolve, reject) => {
        const abort = () => reject(signal.reason);
        signal.addEventListener("abort", abort, { once: true });
        Promise.resolve(document.fonts?.ready).then(
            () => {
                signal.removeEventListener("abort", abort);
                resolve();
            },
            (error) => {
                signal.removeEventListener("abort", abort);
                reject(error);
            },
        );
    });
    signal.throwIfAborted();
    if (!host.isConnected) throw new Error("Chart has been disposed.");
    const source = host.querySelector<SVGSVGElement>("svg.recharts-surface");
    if (!source) throw new Error("Chart is not ready for image export.");
    const width = Number(source.getAttribute("width"));
    const height = Number(source.getAttribute("height"));
    const pixelWidth = Math.ceil(width * request.scale);
    const pixelHeight = Math.ceil(height * request.scale);
    if (
        ![width, height, pixelWidth, pixelHeight].every(
            (value) => Number.isFinite(value) && value > 0,
        ) ||
        pixelWidth > maxSide ||
        pixelHeight > maxSide ||
        pixelWidth * pixelHeight > maxPixels
    )
        throw new Error(
            "Export dimensions exceed the 16,384px side or 16 megapixel limit.",
        );
    const output = copySvg(source);
    output.setAttribute("role", "img");
    const title = element("title");
    title.textContent =
        host.querySelector(".cb-shadcn")?.getAttribute("aria-label") ?? "Chart";
    output.querySelectorAll("title").forEach((node) => node.remove());
    output.prepend(title);
    output.setAttribute("width", String(width));
    output.setAttribute("height", String(height));
    output.setAttribute("viewBox", `0 0 ${width} ${height}`);
    output.insertBefore(
        element("rect", {
            width,
            height,
            fill: backgroundColor(host, request.background),
        }),
        output.firstChild,
    );
    appendLegend(output, host, source.getBoundingClientRect());
    const blob = new Blob([new XMLSerializer().serializeToString(output)], {
        type: "image/svg+xml;charset=utf-8",
    });
    if (request.format === "svg") return blob;

    const canvas = document.createElement("canvas");
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable for PNG export.");
    const image = new Image();
    const url = URL.createObjectURL(blob);
    try {
        await new Promise<void>((resolve, reject) => {
            const cleanup = () => {
                image.onload = null;
                image.onerror = null;
                signal.removeEventListener("abort", abort);
            };
            const abort = () => {
                cleanup();
                image.src = "";
                reject(signal.reason);
            };
            image.onload = () => {
                cleanup();
                resolve();
            };
            image.onerror = () => {
                cleanup();
                reject(new Error("Unable to decode the chart image."));
            };
            signal.addEventListener("abort", abort, { once: true });
            image.src = url;
        });
        signal.throwIfAborted();
        context.drawImage(image, 0, 0, pixelWidth, pixelHeight);
        const png = await new Promise<Blob>((resolve, reject) =>
            canvas.toBlob((value) => {
                if (value?.type === "image/png") resolve(value);
                else reject(new Error("Unable to encode the chart as PNG."));
            }, "image/png"),
        );
        signal.throwIfAborted();
        return png;
    } finally {
        URL.revokeObjectURL(url);
        canvas.width = canvas.height = 0;
    }
}
