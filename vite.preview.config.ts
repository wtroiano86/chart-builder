import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import type { ChartResult } from "./packages/sdk/src/types.ts";

const fixture = JSON.parse(
    readFileSync(
        new URL("./tests/react/fixtures/revenue.json", import.meta.url),
        "utf8",
    ),
) as Extract<ChartResult, { status: "ready" }>;
const execute = promisify(execFile);
const examplePath = fileURLToPath(
    new URL("./examples/demo.php", import.meta.url),
);
function contractServer(): Plugin {
    let sequence = 0;
    return {
        name: "chart-contract-server",
        handleHotUpdate({ file, server }) {
            if (
                file.includes("/resources/react/") ||
                file.includes("/packages/sdk/src/") ||
                file.includes("/tests/adapters/") ||
                file.endsWith("/tests/browser/main.tsx")
            ) {
                // Registrations run once per page; module replacement would register twice.
                server.ws.send({ type: "full-reload" });
                return [];
            }
        },
        configureServer(server) {
            const reloadExamples = (path: string) => {
                if (path.includes("/examples/") && path.endsWith(".php"))
                    server.ws.send({ type: "full-reload", path: "/demo" });
            };
            server.watcher.add(
                fileURLToPath(new URL("./examples", import.meta.url)),
            );
            server.watcher.on("change", reloadExamples);
            server.httpServer?.once("close", () =>
                server.watcher.off("change", reloadExamples),
            );
            server.middlewares.use(async (request, response, next) => {
                const url = new URL(
                    request.url ?? "/",
                    "http://127.0.0.1:4174",
                );
                if (url.pathname === "/") {
                    response.writeHead(302, { Location: "/demo" });
                    response.end();
                    return;
                }
                if (
                    !["/demo", "/charts", "/gallery", "/shadcn"].includes(
                        url.pathname,
                    )
                )
                    return next();
                const inertia = !!request.headers["x-inertia"];
                const only = String(
                    request.headers["x-inertia-partial-data"] ?? "",
                )
                    .split(",")
                    .filter(Boolean);
                const requestId =
                    typeof request.headers["x-chart-request"] === "string"
                        ? request.headers["x-chart-request"]
                        : null;
                if (url.searchParams.has("network-failure") && inertia) {
                    response.statusCode = 503;
                    response.end("Unavailable");
                    return;
                }
                const props: Record<string, unknown> = {};
                if (url.pathname === "/demo") {
                    try {
                        const { stdout } = await execute(
                            process.env.CHART_PREVIEW_PHP ?? "php",
                            [
                                examplePath,
                                url.search,
                                requestId ?? "",
                                only.join(","),
                            ],
                            {
                                cwd: fileURLToPath(
                                    new URL(".", import.meta.url),
                                ),
                                timeout: 30_000,
                                maxBuffer: 4 * 1024 * 1024,
                            },
                        );
                        Object.assign(props, JSON.parse(stdout));
                    } catch (error) {
                        server.config.logger.error(
                            "PHP preview failed: " + String(error),
                        );
                        response.writeHead(500, {
                            "Content-Type": "text/plain; charset=utf-8",
                        });
                        response.end(
                            "PHP preview could not start. Run composer install, then php examples/demo.php to see the error.",
                        );
                        return;
                    }
                }
                for (const [name, prop] of [
                    ["revenue", "revenueChart"],
                    ["orders", "ordersChart"],
                ]) {
                    if (url.pathname === "/demo") break;
                    if (only.length && !only.includes(prop)) continue;
                    if (
                        !inertia &&
                        name === "revenue" &&
                        url.searchParams.has("deferred")
                    )
                        continue;
                    const result = structuredClone(fixture);
                    result.name = name;
                    result.chart.name = name;
                    result.chart.title =
                        name === "revenue" ? "Revenue" : "Orders";
                    result.requestId = requestId;
                    result.chart.meta.snapshotId = "visit-" + ++sequence;
                    result.chart.appearance.renderingMode = "svg";
                    result.chart.meta.queryNamespace = "charts[" + name + "]";
                    const interval =
                        url.searchParams.get(
                            "charts[" + name + "][interval]",
                        ) ?? "month";
                    result.chart.state = { interval };
                    result.chart.filters = [
                        {
                            kind: "interval",
                            key: "interval",
                            label: "Interval",
                            clearable: false,
                            options: [
                                { value: "day", label: "Day" },
                                { value: "month", label: "Month" },
                                { value: "year", label: "Year" },
                                { value: "denied", label: "Denied" },
                                { value: "error", label: "Error" },
                            ],
                        },
                    ];
                    result.chart.interactions.navigation = [
                        {
                            seriesId: "revenue",
                            datum: {
                                datasetId: "default",
                                kind: "row",
                                id: "jan",
                            },
                            url: "/charts?selected=jan",
                            target: "_self",
                        },
                    ];
                    const common = {
                        schemaVersion: 1 as const,
                        name,
                        requestId,
                        contextKey: result.contextKey,
                    };
                    props[prop] =
                        interval === "denied"
                            ? {
                                  ...common,
                                  status: "denied",
                                  reason: "forbidden",
                              }
                            : interval === "error"
                              ? {
                                    ...common,
                                    status: "error",
                                    error: {
                                        code: "data_unavailable",
                                        message:
                                            "Data is temporarily unavailable.",
                                        retryable: true,
                                        referenceId: "fixture",
                                    },
                                }
                              : result;
                }
                const page = {
                    component:
                        url.pathname === "/shadcn"
                            ? "ShadcnGallery"
                            : url.pathname === "/demo"
                              ? "Demo"
                              : url.pathname === "/gallery"
                                ? "Gallery"
                                : "Dashboard",
                    url: url.pathname + url.search,
                    version: "1",
                    props,
                    ...(!inertia && url.searchParams.has("deferred")
                        ? { deferredProps: { revenue: ["revenueChart"] } }
                        : {}),
                };
                if (inertia) {
                    await new Promise((resolve) => setTimeout(resolve, 80));
                    response.setHeader("Content-Type", "application/json");
                    response.setHeader("X-Inertia", "true");
                    response.setHeader("Vary", "X-Inertia");
                    response.end(JSON.stringify(page));
                    return;
                }
                const template = readFileSync(
                    new URL("./tests/browser/preview.html", import.meta.url),
                    "utf8",
                ).replace(
                    "__PAGE__",
                    JSON.stringify(page)
                        .replaceAll("&", "&amp;")
                        .replaceAll('"', "&quot;")
                        .replaceAll("<", "&lt;"),
                );
                response.setHeader("Content-Type", "text/html");
                response.end(
                    await server.transformIndexHtml(url.pathname, template),
                );
            });
        },
    };
}
export default defineConfig({
    plugins: [react(), tailwindcss(), contractServer()],
    resolve: {
        alias: {
            "@wtroiano/chart-builder-sdk": new URL(
                "./packages/sdk/src/index.ts",
                import.meta.url,
            ).pathname,
        },
    },
    optimizeDeps: {
        entries: ["tests/browser/main.tsx"],
        include: [
            "react",
            "react-dom/client",
            "@inertiajs/react",
            "echarts",
            "ajv/dist/2020.js",
        ],
    },
    server: {
        host: "127.0.0.1",
        port: 4174,
        strictPort: true,
        watch: { ignored: ["**/tmp/**", "**/vendor/**", "**/.github/**"] },
    },
    build: {
        outDir: "tmp/preview",
        rollupOptions: { input: "tests/browser/preview.html" },
    },
});
