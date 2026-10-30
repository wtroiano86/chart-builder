import type {
    AdapterManifest,
    ChartAdapter,
} from "@wtroiano/chart-builder-sdk";
import manifestJson from "./manifest.json";
import { validateShadcnChart } from "./model";
import type { ShadcnChartComponents } from "./types";

export type { ShadcnChartComponents } from "./types";
export const shadcnManifest = manifestJson as AdapterManifest;

/** Pass a lazy import of the application's generated shadcn chart module. */
export function createShadcnAdapter(
    loadComponents: () => Promise<ShadcnChartComponents>,
): ChartAdapter {
    return {
        name: "shadcn",
        apiVersion: 1,
        manifest: shadcnManifest,
        validate: (chart) => validateShadcnChart(chart, shadcnManifest),
        load: async () => {
            const [components, { createShadcnComponent }] = await Promise.all([
                loadComponents(),
                import("./rendering"),
            ]);
            return { Component: createShadcnComponent(components) };
        },
    };
}
