import type * as ECharts from "echarts";
import {
    validateCapabilities,
    type AdapterManifest,
    type ChartAdapter,
} from "@wtroiano/chart-builder-sdk";

// The caller supplies an engine loader and a matching restricted PHP/JS manifest.
export function createModularEChartsAdapter(
    manifest: AdapterManifest,
    loadEngine: () => Promise<Pick<typeof ECharts, "init" | "registerMap">>,
): ChartAdapter {
    return {
        name: manifest.name,
        apiVersion: 1,
        manifest,
        validate: (chart) => validateCapabilities(chart, manifest),
        load: async () => {
            const [engine, module] = await Promise.all([
                loadEngine(),
                import("./component"),
            ]);
            return { Component: module.createEChartsComponent(engine) };
        },
    };
}
