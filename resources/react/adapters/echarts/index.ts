import {
    validateCapabilities,
    type AdapterManifest,
    type ChartAdapter,
} from "@wtroiano/chart-builder-sdk";
import manifestJson from "./manifest.json";

export const echartsManifest: AdapterManifest = manifestJson as AdapterManifest;
export const echartsAdapter: ChartAdapter = {
    name: "echarts",
    apiVersion: 1,
    manifest: echartsManifest,
    validate: (chart) => validateCapabilities(chart, echartsManifest),
    load: () => import("./rendering"),
};
