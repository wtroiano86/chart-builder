import {
    assertAdapterManifest,
    type ChartAdapter,
    type ChartAdapterModule,
    type ExtensionReference,
} from "@wtroiano/chart-builder-sdk";

const adapters = new Map<string, ChartAdapter>();
const modules = new Map<string, Promise<ChartAdapterModule>>();
const extensions = new Map<string, unknown>();

export function registerChartAdapter(
    name: string,
    adapter: ChartAdapter,
): void {
    assertAdapterManifest(adapter.manifest);
    if (
        name !== adapter.name ||
        name !== adapter.manifest.name ||
        adapter.apiVersion !== 1 ||
        adapter.manifest.apiVersion !== 1
    )
        throw new Error("Adapter registration identity or API mismatch.");
    if (adapters.has(name))
        throw new Error("Adapter already registered: " + name);
    adapters.set(name, adapter);
}
export function getChartAdapter(name: string): ChartAdapter {
    const adapter = adapters.get(name);
    if (!adapter) throw new Error("Chart adapter is not registered: " + name);
    return adapter;
}
export function loadChartAdapter(name: string): Promise<ChartAdapterModule> {
    let loaded = modules.get(name);
    if (!loaded) {
        loaded = getChartAdapter(name)
            .load()
            .catch((error: unknown) => {
                modules.delete(name);
                throw error;
            });
        modules.set(name, loaded);
    }
    return loaded;
}
export function registerChartExtension(
    kind: ExtensionReference["kind"],
    name: string,
    value: unknown,
): void {
    const key = kind + ":" + name;
    if (extensions.has(key))
        throw new Error("Extension already registered: " + key);
    extensions.set(key, value);
}
export function resolveChartExtension(
    kind: ExtensionReference["kind"],
    name: string,
): unknown {
    return extensions.get(kind + ":" + name);
}
