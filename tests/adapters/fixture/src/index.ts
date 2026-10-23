import {
    validateCapabilities,
    type AdapterManifest,
    type ChartAdapter,
} from "@wtroiano/chart-builder-sdk";
import manifestJson from "../manifest.json";
export const fixtureManifest = manifestJson as AdapterManifest;
export const fixtureAdapter: ChartAdapter = {
    name: "fixture",
    apiVersion: 1,
    manifest: fixtureManifest,
    validate: (chart) => validateCapabilities(chart, fixtureManifest),
    load: () => import("./rendering"),
};
