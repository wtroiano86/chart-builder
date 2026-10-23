import type { ChartError, FilterValue } from "@wtroiano/chart-builder-sdk";

export type FilterPatch = Record<string, FilterValue | undefined>;
export interface ChartRequest {
    id: string;
    url: string;
    props: string[];
    success: (url: string) => void;
    failure: (message: string, authLost?: boolean) => void;
    finish: () => void;
}
export type ChartTransport = (request: ChartRequest) => (() => void) | void;
interface Intent {
    name: string;
    prop: string;
    props: string[];
    patch: FilterPatch | null;
    reset: boolean;
    revision: number;
    suspended: boolean;
}
export interface RequestState {
    pending: boolean;
    error: ChartError | null;
    authLost: boolean;
    requestId: string | null;
    revision: number;
}
const empty = (): RequestState => ({
    pending: false,
    error: null,
    authLost: false,
    requestId: null,
    revision: 0,
});

export function patchChartUrl(
    base: string,
    name: string,
    patch: FilterPatch | null,
): string {
    const url = new URL(base, "http://localhost");
    const prefix = "charts[" + name + "]";
    if (patch === null) {
        for (const key of [...url.searchParams.keys()])
            if (key === prefix || key.startsWith(prefix + "["))
                url.searchParams.delete(key);
    } else {
        for (const [field, value] of Object.entries(patch)) {
            const key = prefix + "[" + field + "]";
            for (const existing of [...url.searchParams.keys()])
                if (existing === key || existing.startsWith(key + "["))
                    url.searchParams.delete(existing);
            if (value === undefined) continue;
            if (Array.isArray(value)) {
                if (!value.length) url.searchParams.set(key, "");
                for (const item of value)
                    url.searchParams.append(key + "[]", item);
            } else
                url.searchParams.set(key, value === null ? "" : String(value));
        }
    }
    return url.pathname + url.search + url.hash;
}

function namespace(url: string, name: string): string {
    const query = new URL(url, "http://localhost").searchParams;
    return JSON.stringify(
        [...query.entries()]
            .filter(([key]) => key.startsWith("charts[" + name + "]"))
            .sort(),
    );
}

export class ChartCoordinator {
    private url: string;
    private revision = 0;
    private sequence = 0;
    private intents = new Map<string, Intent>();
    private states = new Map<string, RequestState>();
    private listeners = new Set<() => void>();
    private active: {
        id: string;
        intents: Intent[];
        cancel?: () => void;
    } | null = null;
    private external = 0;
    private scheduled = false;
    private disposed = false;

    constructor(
        url: string,
        private transport: ChartTransport,
    ) {
        this.url = url;
    }
    subscribe = (listener: () => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };
    state(name: string): RequestState {
        let state = this.states.get(name);
        if (!state) {
            state = empty();
            this.states.set(name, state);
        }
        return state;
    }
    update(
        name: string,
        prop: string,
        patch: FilterPatch | null,
        props: string[] = [],
    ): void {
        const previous = this.intents.get(name);
        const intent: Intent = {
            name,
            prop,
            props: [...new Set([prop, ...props, ...(previous?.props ?? [])])],
            patch:
                patch === null
                    ? null
                    : { ...(previous?.patch ?? {}), ...patch },
            reset: patch === null || previous?.reset === true,
            revision: ++this.revision,
            suspended: false,
        };
        this.intents.set(name, intent);
        this.states.set(name, {
            ...this.state(name),
            pending: true,
            error: null,
            authLost: false,
            revision: intent.revision,
        });
        this.emit();
        this.schedule();
    }
    retry(name: string, prop: string, props: string[] = []): void {
        this.update(name, prop, this.intents.get(name)?.patch ?? {}, props);
    }
    externalStart(target: string): void {
        this.external++;
        for (const name of this.intents.keys()) {
            if (namespace(this.url, name) !== namespace(target, name)) {
                this.intents.delete(name);
                this.states.set(name, empty());
            }
        }
        if (
            new URL(target, "http://localhost").pathname !==
            new URL(this.url, "http://localhost").pathname
        )
            this.clear();
        this.emit();
    }
    externalFinish(url: string): void {
        this.url = url;
        this.external = Math.max(0, this.external - 1);
        this.emit();
        this.schedule();
    }
    history(url: string): void {
        this.clear();
        this.url = url;
        this.emit();
    }
    transportFailure(props: string[], message: string, authLost = false): void {
        const affected = props.length
            ? props
            : (this.active?.intents.map((intent) => intent.prop) ?? []);
        for (const [name, state] of this.states) {
            const intent = this.intents.get(name);
            if (!authLost && (!intent || !affected.includes(intent.prop)))
                continue;
            if (intent) intent.suspended = true;
            this.states.set(name, {
                ...state,
                pending: false,
                authLost,
                error: {
                    code: "transport",
                    message,
                    retryable: !authLost,
                    referenceId: null,
                },
            });
        }
        this.emit();
    }
    deferredFailure(name: string, message: string, authLost = false): void {
        this.states.set(name, {
            ...this.state(name),
            pending: false,
            authLost,
            error: {
                code: "transport",
                message,
                retryable: !authLost,
                referenceId: null,
            },
        });
        this.emit();
    }
    accepts(name: string, requestId: string | null): boolean {
        const state = this.state(name);
        return state.requestId === null ? true : requestId === state.requestId;
    }
    dispose(): void {
        this.clear();
        this.disposed = true;
        this.listeners.clear();
    }
    private clear(): void {
        const active = this.active;
        this.active = null;
        this.intents.clear();
        this.states.clear();
        active?.cancel?.();
    }
    private emit(): void {
        for (const listener of this.listeners) listener();
    }
    private schedule(): void {
        if (this.scheduled || this.disposed) return;
        this.scheduled = true;
        queueMicrotask(() => {
            this.scheduled = false;
            this.flush();
        });
    }
    private flush(): void {
        if (this.disposed || this.active || this.external) return;
        const intents = [...this.intents.values()].filter(
            (intent) => !intent.suspended,
        );
        if (!intents.length) return;
        let url = this.url;
        for (const intent of intents) {
            if (intent.reset) url = patchChartUrl(url, intent.name, null);
            url = patchChartUrl(url, intent.name, intent.patch);
        }
        const id = "chart-" + ++this.sequence + "-" + Date.now();
        const active = { id, intents } as NonNullable<
            ChartCoordinator["active"]
        >;
        this.active = active;
        for (const intent of intents)
            this.states.set(intent.name, {
                ...this.state(intent.name),
                requestId: id,
                pending: true,
                error: null,
            });
        this.emit();
        const cancel = this.transport({
            id,
            url,
            props: [...new Set(intents.flatMap((intent) => intent.props))],
            success: (committed) => {
                if (this.active !== active) return;
                this.url = committed;
                for (const intent of intents) {
                    if (
                        this.intents.get(intent.name)?.revision ===
                        intent.revision
                    ) {
                        this.intents.delete(intent.name);
                        this.states.set(intent.name, {
                            ...this.state(intent.name),
                            pending: false,
                            error: null,
                        });
                    }
                }
                this.emit();
            },
            failure: (message, authLost = false) => {
                if (this.active !== active) return;
                for (const intent of intents) {
                    const current = this.intents.get(intent.name);
                    if (current?.revision === intent.revision)
                        current.suspended = true;
                    this.states.set(intent.name, {
                        ...this.state(intent.name),
                        pending: false,
                        authLost,
                        error: {
                            code: "transport",
                            message,
                            retryable: !authLost,
                            referenceId: null,
                        },
                    });
                }
                this.emit();
            },
            finish: () => {
                if (this.active !== active) return;
                this.active = null;
                this.schedule();
            },
        });
        if (cancel) active.cancel = cancel;
    }
}
