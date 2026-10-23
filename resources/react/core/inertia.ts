import { router } from "@inertiajs/react";
import { ChartCoordinator, type ChartRequest } from "./coordinator";

type Visit = {
    url: URL | string;
    headers?: Record<string, string>;
    only?: string[];
    async?: boolean;
    cancelled?: boolean;
    interrupted?: boolean;
};
type Detail = {
    visit?: Visit;
    page?: { url: string; component: string };
    type?: string;
    response?: { status?: number; url?: string };
    error?: unknown;
};
let coordinator: ChartCoordinator | null = null;
const props = new Map<string, string>();
const automatic = new Map<string, string[]>();
const automaticKey = (visit: Visit) =>
    String(visit.url) + "|" + [...(visit.only ?? [])].sort().join(",");
let detach: (() => void) | null = null;

export function registerChartProp(name: string, prop: string): () => void {
    const existing = props.get(name);
    if (existing && existing !== prop)
        throw new Error("A chart name must identify one page prop.");
    props.set(name, prop);
    return () => {
        props.delete(name);
    };
}

export function getChartCoordinator(): ChartCoordinator {
    if (typeof window === "undefined")
        return new ChartCoordinator("/", () => {});
    if (!coordinator) {
        coordinator = new ChartCoordinator(window.location.href, visit);
        detach = listen(coordinator);
    }
    return coordinator;
}
export function disposeChartCoordinator(): void {
    detach?.();
    detach = null;
    coordinator?.dispose();
    coordinator = null;
    props.clear();
    automatic.clear();
}

function visit(request: ChartRequest): () => void {
    let cancel: (() => void) | undefined;
    router.visit(request.url, {
        method: "get",
        only: request.props,
        preserveScroll: true,
        preserveState: true,
        headers: { "X-Chart-Request": request.id },
        onCancelToken: (token) => {
            cancel = () => token.cancel();
        },
        onSuccess: (page) => request.success(page.url),
        onError: () => request.failure("The page rejected the chart request."),
        onFinish: () => request.finish(),
        // Inertia 2 ignores these extra callbacks; its DOM exception events are bridged below.
        ...{
            onHttpException: (response: { status?: number }) => {
                request.failure(
                    "The chart request failed.",
                    response.status === 401 ||
                        response.status === 403 ||
                        response.status === 419,
                );
            },
            onNetworkError: () =>
                request.failure("The chart could not connect to the server."),
        },
    });
    return () => cancel?.();
}

function listen(instance: ChartCoordinator): () => void {
    const removers: Array<() => void> = [];
    const on = (name: string, handler: (detail: Detail) => void) => {
        const listener = (event: Event) =>
            handler((event as CustomEvent<Detail>).detail ?? {});
        document.addEventListener("inertia:" + name, listener);
        removers.push(() =>
            document.removeEventListener("inertia:" + name, listener),
        );
    };
    on("before", ({ visit }) => {
        if (!visit || visit.headers?.["X-Chart-Request"]) return;
        if (visit.async && visit.only?.length) {
            automatic.set(automaticKey(visit), visit.only);
        } else instance.externalStart(String(visit.url));
    });
    on("finish", ({ visit }) => {
        if (!visit || visit.headers?.["X-Chart-Request"]) return;
        if (visit.async) automatic.delete(automaticKey(visit));
        else instance.externalFinish(window.location.href);
    });
    const failure = ({ response }: Detail) => {
        const denied = [401, 403, 419].includes(response?.status ?? 0);
        const affected = response?.url
            ? [...automatic.entries()]
                  .filter(([key]) => key.startsWith(response.url + "|"))
                  .flatMap(([, props]) => props)
            : [...automatic.values()].flat();
        for (const [name, prop] of props)
            if (denied || affected.includes(prop))
                instance.deferredFailure(
                    name,
                    denied
                        ? "Access to this chart is no longer available."
                        : "The chart request failed.",
                    denied,
                );
        instance.transportFailure(
            affected,
            denied
                ? "Access to this chart is no longer available."
                : "The chart request failed.",
            denied,
        );
    };
    on("httpException", failure);
    on("networkError", failure); // Inertia 3.
    on("invalid", failure);
    on("exception", failure); // Inertia 2.
    on("navigate", ({ page, type }) => {
        if (type === "history" && page) instance.history(page.url);
    });
    const history = () => instance.history(window.location.href);
    window.addEventListener("popstate", history);
    removers.push(() => window.removeEventListener("popstate", history));
    return () => removers.forEach((remove) => remove());
}
