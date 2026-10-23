import {
    Component as ReactComponent,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ComponentType,
    type ReactNode,
} from "react";
import {
    assertChartPayload,
    validateCapabilities,
    type ChartAdapterHandle,
    type ChartAdapterProps,
    type ChartError,
    type ChartEvent,
    type ChartPayload,
    type PresentationContext,
} from "@wtroiano/chart-builder-sdk";
import {
    getChartAdapter,
    loadChartAdapter,
    resolveChartExtension,
} from "./registry";

export interface ChartCanvasProps {
    chart: ChartPayload;
    onEvent?: (event: ChartEvent) => void;
    onError?: (error: ChartError) => void;
    onReady?: (handle: ChartAdapterHandle | null) => void;
}
class AdapterBoundary extends ReactComponent<
    { children: ReactNode; onError: (error: ChartError) => void },
    { failed: boolean }
> {
    state = { failed: false };
    static getDerivedStateFromError() {
        return { failed: true };
    }
    componentDidCatch(error: Error) {
        this.props.onError({
            code: "render_failed",
            message: error.message,
            retryable: false,
            referenceId: null,
        });
    }
    render() {
        return this.state.failed ? null : this.props.children;
    }
}

export function ChartCanvas({
    chart,
    onEvent,
    onError,
    onReady,
}: ChartCanvasProps) {
    const host = useRef<HTMLDivElement>(null);
    const callbacks = useRef({ onEvent, onError, onReady });
    callbacks.current = { onEvent, onError, onReady };
    const [renderer, setRenderer] = useState<{
        name: string;
        Component: ComponentType<ChartAdapterProps>;
    } | null>(null);
    const [failure, setFailure] = useState<ChartError | null>(null);
    const [size, setSize] = useState({
        width: 0,
        height: chart.appearance.height,
    });
    const [preference, setPreference] = useState({
        dark: false,
        reducedMotion: false,
    });
    const validation = useMemo<ChartError | null>(() => {
        try {
            assertChartPayload(chart);
            const adapter = getChartAdapter(chart.adapter.name);
            if (
                adapter.manifest.manifestVersion !==
                    chart.adapter.manifestVersion ||
                !adapter.manifest.payloadSchemaVersions.includes(
                    chart.schemaVersion,
                )
            )
                throw new Error(
                    "Adapter manifest differs from PHP. Rebuild or upgrade both registrations.",
                );
            const issues = [
                ...validateCapabilities(chart, adapter.manifest),
                ...adapter.validate(chart),
            ];
            if (issues.length)
                throw new Error(
                    issues
                        .map((issue) => issue.path + ": " + issue.message)
                        .join("; "),
                );
            for (const extension of chart.extensions)
                if (!resolveChartExtension(extension.kind, extension.name))
                    throw new Error(
                        "Extension is not registered: " + extension.name,
                    );
            return null;
        } catch (error) {
            return {
                code: "configuration",
                message:
                    error instanceof Error ? error.message : "Invalid chart.",
                retryable: false,
                referenceId: null,
            };
        }
    }, [chart]);
    useEffect(() => {
        if (validation) callbacks.current.onError?.(validation);
    }, [validation]);
    useEffect(() => {
        let active = true;
        if (validation) return;
        setFailure(null);
        void Promise.resolve()
            .then(() => loadChartAdapter(chart.adapter.name))
            .then((module) => {
                if (active)
                    setRenderer({
                        name: chart.adapter.name,
                        Component: module.Component,
                    });
            })
            .catch((error: unknown) => {
                if (active) {
                    const failure: ChartError = {
                        code: "render_failed",
                        message:
                            error instanceof Error
                                ? error.message
                                : "Adapter loading failed.",
                        retryable: true,
                        referenceId: null,
                    };
                    setFailure(failure);
                    callbacks.current.onError?.(failure);
                }
            });
        return () => {
            active = false;
        };
    }, [
        chart.adapter.name,
        chart.adapter.manifestVersion,
        chart.meta.snapshotId,
        validation,
    ]);
    useEffect(() => {
        setFailure(null);
    }, [chart.meta.snapshotId]);

    useEffect(() => {
        const element = host.current;
        if (!element) return;
        const resize = () => {
            const width = element.getBoundingClientRect().width;
            setSize((previous) =>
                previous.width === width &&
                previous.height === chart.appearance.height
                    ? previous
                    : { width, height: chart.appearance.height },
            );
        };
        resize();
        const observer =
            typeof ResizeObserver === "undefined"
                ? null
                : new ResizeObserver(resize);
        observer?.observe(element);
        window.addEventListener("resize", resize);
        return () => {
            observer?.disconnect();
            window.removeEventListener("resize", resize);
        };
    }, [chart.appearance.height]);
    useEffect(() => {
        if (!window.matchMedia) return;
        const dark = window.matchMedia("(prefers-color-scheme: dark)");
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
        const change = () =>
            setPreference({
                dark: dark.matches,
                reducedMotion: reduced.matches,
            });
        change();
        dark.addEventListener("change", change);
        reduced.addEventListener("change", change);
        return () => {
            dark.removeEventListener("change", change);
            reduced.removeEventListener("change", change);
        };
    }, []);
    const dark =
        chart.appearance.theme === "dark" ||
        (chart.appearance.theme === "system" && preference.dark);
    const context = useMemo<PresentationContext>(
        () => ({
            ...size,
            theme: dark ? "dark" : "light",
            palette: chart.appearance.palette,
            tokens: {
                text: dark ? "#e2e8f0" : "#1e293b",
                border: dark ? "#475569" : "#cbd5e1",
                grid: dark ? "#334155" : "#e2e8f0",
            },
            locale: chart.meta.locale,
            timezone: chart.meta.timezone,
            reducedMotion: preference.reducedMotion,
            resolveExtension: resolveChartExtension,
        }),
        [
            size,
            dark,
            chart.appearance.palette,
            chart.meta.locale,
            chart.meta.timezone,
            preference.reducedMotion,
        ],
    );
    const Renderer =
        renderer?.name === chart.adapter.name ? renderer.Component : null;
    const error = validation ?? failure;
    const report = (error: ChartError) => {
        setFailure(error);
        callbacks.current.onError?.(error);
    };
    return (
        <div
            ref={host}
            className="cb-canvas"
            style={{ minHeight: chart.appearance.height }}
        >
            {error ? (
                <p role="alert">{error.message}</p>
            ) : Renderer && size.width > 0 ? (
                <AdapterBoundary
                    key={chart.adapter.name + ":" + chart.name}
                    onError={report}
                >
                    <Renderer
                        chart={chart}
                        context={context}
                        onReady={(handle) =>
                            callbacks.current.onReady?.(handle)
                        }
                        onError={report}
                        onEvent={(event) => {
                            if (
                                event.snapshotId === chart.meta.snapshotId &&
                                event.chartName === chart.name &&
                                event.origin === "user"
                            )
                                callbacks.current.onEvent?.(event);
                        }}
                    />
                </AdapterBoundary>
            ) : (
                <ChartSkeleton height={chart.appearance.height} />
            )}
        </div>
    );
}
export function ChartSkeleton({ height = 320 }: { height?: number }) {
    return (
        <div
            className="cb-skeleton"
            role="status"
            style={{ height }}
            aria-label="Loading chart"
        >
            Loading chart…
        </div>
    );
}
