import {
    useEffect,
    useId,
    useRef,
    useState,
    useSyncExternalStore,
    type ReactNode,
} from "react";
import { router } from "@inertiajs/react";
import {
    assertChartResult,
    safeNavigation,
    type ChartAdapterHandle,
    type ChartError,
    type ChartEvent,
    type ChartResult,
} from "@wtroiano/chart-builder-sdk";
import { ChartCanvas, ChartSkeleton } from "./ChartCanvas";
import { ChartFilters } from "./Filters";
import { chartCsv, dataTables, download } from "./data";
import { getChartCoordinator, registerChartProp } from "./inertia";
import { getChartAdapter, resolveChartExtension } from "./registry";
import type { ChartCoordinator } from "./coordinator";

export interface ChartProps {
    name: string;
    result?: ChartResult;
    propName: string;
    reloadProps?: string[];
    pollInterval?: number;
    coordinator?: ChartCoordinator;
    toolbar?: ReactNode;
    emptyState?: ReactNode;
    loadingState?: ReactNode;
    errorState?: (error: ChartError) => ReactNode;
    onPointClick?: (
        event: Extract<ChartEvent, { type: "point-activate" }>,
    ) => void;
    onError?: (error: ChartError) => void;
    onReady?: (handle: ChartAdapterHandle | null) => void;
}

export function Chart({
    name,
    result,
    propName,
    reloadProps = [],
    pollInterval,
    coordinator: supplied,
    toolbar,
    emptyState,
    loadingState,
    errorState,
    onPointClick,
    onError,
    onReady,
}: ChartProps) {
    const titleId = useId();
    const [coordinator] = useState(() => supplied ?? getChartCoordinator());
    const request = useSyncExternalStore(
        coordinator.subscribe,
        () => coordinator.state(name),
        () => coordinator.state(name),
    );
    const [ready, setReady] = useState<Extract<
        ChartResult,
        { status: "ready" }
    > | null>(() => {
        try {
            if (result) assertChartResult(result);
            return result?.status === "ready" && result.name === name
                ? result
                : null;
        } catch {
            return null;
        }
    });
    const [outcome, setOutcome] = useState<ChartResult | undefined>(result);
    const [renderError, setRenderError] = useState<ChartError | null>(null);
    const [handle, setHandle] = useState<ChartAdapterHandle | null>(null);
    useEffect(() => registerChartProp(name, propName), [name, propName]);
    useEffect(() => {
        if (!result) {
            setReady(null);
            setOutcome(undefined);
            setHandle(null);
            return;
        }
        try {
            assertChartResult(result);
            if (result.name !== name)
                throw new Error(
                    "Chart result name does not match its component.",
                );
            // Denial and scope changes always clear retained data, including late responses.
            if (
                result.status === "denied" ||
                (ready && result.contextKey !== ready.contextKey)
            ) {
                setReady(null);
                setHandle(null);
            }
            if (
                !coordinator.accepts(name, result.requestId) &&
                result.status !== "denied"
            )
                return;
            setOutcome(result);
            if (result.status === "ready") {
                setReady(result);
                setRenderError(null);
            } else if (
                result.status === "denied" ||
                (result.status === "error" && !result.error.retryable)
            ) {
                setReady(null);
                setHandle(null);
            }
        } catch (error) {
            setReady(null);
            setHandle(null);
            setRenderError({
                code: "configuration",
                message:
                    error instanceof Error
                        ? error.message
                        : "Invalid chart result.",
                retryable: false,
                referenceId: null,
            });
        }
    }, [result, name]);
    useEffect(() => {
        if (request.authLost) {
            setReady(null);
            setHandle(null);
        }
    }, [request.authLost]);
    useEffect(() => {
        if (!pollInterval || pollInterval < 1000) return;
        const timer = setInterval(() => {
            if (
                document.visibilityState === "visible" &&
                !coordinator.state(name).pending
            )
                coordinator.retry(name, propName, reloadProps);
        }, pollInterval);
        return () => clearInterval(timer);
    }, [pollInterval, coordinator, name, propName, reloadProps.join(",")]);
    const error =
        renderError ??
        request.error ??
        (outcome?.status === "error" ? outcome.error : null);
    useEffect(() => {
        if (error) onError?.(error);
    }, [error, onError]);
    const denied =
        request.authLost ||
        outcome?.status === "denied" ||
        result?.status === "denied";
    // Never expose a previous scope during the render before effects run.
    const chart =
        !denied &&
        !(renderError && !renderError.retryable) &&
        ready?.name === name &&
        result &&
        result.contextKey === ready.contextKey
            ? ready.chart
            : null;
    const exportChart = useRef(chart);
    exportChart.current = chart;
    useEffect(() => {
        exportChart.current = chart;
        return () => {
            exportChart.current = null;
        };
    }, [chart]);
    const pending = request.pending || (!outcome && !error);
    const stale =
        !!chart &&
        (request.pending || !!error || outcome?.status === "invalid");
    const definitions =
        outcome?.status === "invalid"
            ? outcome.filters
            : (chart?.filters ?? []);
    const state =
        outcome?.status === "invalid" ? outcome.input : (chart?.state ?? {});
    const tables = chart ? dataTables(chart) : [];
    const hasData = tables.some((table) => table.rows.length > 0);
    const retry = () => {
        setRenderError(null);
        coordinator.retry(name, propName, reloadProps);
    };
    const event = (event: ChartEvent) => {
        if (
            !chart ||
            event.snapshotId !== chart.meta.snapshotId ||
            event.origin !== "user"
        )
            return;
        const callback = chart.interactions.callbacks[event.type];
        const handler = callback && resolveChartExtension("renderer", callback);
        if (typeof handler === "function") handler(event);
        if (event.type !== "point-activate") return;
        onPointClick?.(event);
        const rule = chart.interactions.navigation.find(
            (rule) =>
                rule.seriesId === event.seriesId &&
                rule.datum.datasetId === event.datum.datasetId &&
                rule.datum.kind === event.datum.kind &&
                rule.datum.id === event.datum.id,
        );
        if (rule && safeNavigation(rule.url)) {
            if (rule.target === "_blank")
                window.open(rule.url, "_blank", "noopener,noreferrer");
            else if (rule.url.startsWith("/")) router.visit(rule.url);
            else window.location.assign(rule.url);
        }
    };
    let exports: Array<"png" | "jpeg" | "svg" | "pdf"> = [];
    if (chart && handle?.exportImage) {
        const manifest = getChartAdapter(chart.adapter.name).manifest;
        const mode =
            chart.appearance.renderingMode ?? manifest.renderingModes[0];
        exports = manifest.exports
            .filter((item) => item.modes.includes(mode))
            .map((item) => item.format);
    }
    return (
        <section
            className="cb-chart"
            data-theme={chart?.appearance.theme ?? "system"}
            aria-labelledby={titleId}
            aria-busy={pending}
        >
            <header className="cb-header">
                <div>
                    <h2 id={titleId}>{chart?.title ?? name}</h2>
                    {chart?.description && <p>{chart.description}</p>}
                </div>
                <div className="cb-toolbar">
                    {toolbar}
                    {chart && (
                        <button
                            type="button"
                            onClick={() =>
                                download(
                                    new Blob([chartCsv(chart)], {
                                        type: "text/csv;charset=utf-8",
                                    }),
                                    name + ".csv",
                                )
                            }
                        >
                            Download CSV
                        </button>
                    )}
                    {exports.map((format) => (
                        <button
                            type="button"
                            key={format}
                            onClick={() => {
                                void handle
                                    ?.exportImage?.({
                                        format,
                                        scale: 1,
                                        background: null,
                                    })
                                    .then((blob) => {
                                        if (exportChart.current === chart)
                                            download(blob, name + "." + format);
                                    })
                                    .catch((error: unknown) => {
                                        if (exportChart.current === chart)
                                            setRenderError({
                                                code: "render_failed",
                                                message:
                                                    error instanceof Error
                                                        ? error.message
                                                        : "Export failed.",
                                                retryable: true,
                                                referenceId: null,
                                            });
                                    });
                            }}
                        >
                            Download {format.toUpperCase()}
                        </button>
                    ))}
                </div>
            </header>
            {!denied && (
                <ChartFilters
                    timezone={chart?.meta.timezone}
                    name={chart?.title ?? name}
                    definitions={definitions}
                    state={state}
                    errors={
                        outcome?.status === "invalid"
                            ? outcome.errors
                            : undefined
                    }
                    pending={pending}
                    onApply={(patch) =>
                        coordinator.update(name, propName, patch, reloadProps)
                    }
                    onReset={() =>
                        coordinator.update(name, propName, null, reloadProps)
                    }
                />
            )}
            {denied ? (
                <p role="status">Access to this chart is not available.</p>
            ) : (
                <>
                    {error &&
                        (errorState ? (
                            errorState(error)
                        ) : (
                            <div className="cb-error" role="alert">
                                <span>{error.message}</span>
                                {error.retryable && (
                                    <button type="button" onClick={retry}>
                                        Retry
                                    </button>
                                )}
                            </div>
                        ))}
                    {stale && (
                        <p className="cb-status" role="status">
                            Showing previous data
                            {request.pending ? " while updating" : ""}. Applied
                            filters:{" "}
                            {Object.entries(chart!.state)
                                .map(
                                    ([key, value]) =>
                                        key + ": " + String(value),
                                )
                                .join(", ") || "defaults"}
                            .
                        </p>
                    )}
                    {chart ? (
                        hasData ? (
                            <ChartCanvas
                                key={ready?.contextKey}
                                chart={chart}
                                onEvent={event}
                                onError={setRenderError}
                                onReady={(value) => {
                                    setHandle(value);
                                    onReady?.(value);
                                }}
                            />
                        ) : (
                            (emptyState ?? (
                                <p role="status">
                                    No data for the selected filters.
                                </p>
                            ))
                        )
                    ) : pending ? (
                        (loadingState ?? <ChartSkeleton />)
                    ) : null}
                    {chart && (
                        <details className="cb-data">
                            <summary>View chart data</summary>
                            {tables.map((table) => (
                                <div className="cb-table-scroll" key={table.id}>
                                    <table>
                                        <caption>{table.id}</caption>
                                        <thead>
                                            <tr>
                                                {table.headers.map(
                                                    (label, index) => (
                                                        <th
                                                            key={index}
                                                            scope="col"
                                                        >
                                                            {label}
                                                        </th>
                                                    ),
                                                )}
                                                <th scope="col">Links</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {table.rows.map((row) => (
                                                <tr key={row.datum.id}>
                                                    {row.values.map(
                                                        (value, index) => (
                                                            <td key={index}>
                                                                {value === null
                                                                    ? "—"
                                                                    : String(
                                                                          value,
                                                                      )}
                                                            </td>
                                                        ),
                                                    )}
                                                    <td>
                                                        {chart.interactions.navigation
                                                            .filter(
                                                                (rule) =>
                                                                    rule.datum
                                                                        .datasetId ===
                                                                        row
                                                                            .datum
                                                                            .datasetId &&
                                                                    rule.datum
                                                                        .kind ===
                                                                        row
                                                                            .datum
                                                                            .kind &&
                                                                    rule.datum
                                                                        .id ===
                                                                        row
                                                                            .datum
                                                                            .id,
                                                            )
                                                            .map(
                                                                (
                                                                    rule,
                                                                    index,
                                                                ) => (
                                                                    <a
                                                                        key={
                                                                            index
                                                                        }
                                                                        href={
                                                                            rule.url
                                                                        }
                                                                        target={
                                                                            rule.target
                                                                        }
                                                                        rel="noopener noreferrer"
                                                                    >
                                                                        Open{" "}
                                                                        {
                                                                            row
                                                                                .values[0]
                                                                        }
                                                                    </a>
                                                                ),
                                                            )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ))}
                        </details>
                    )}
                </>
            )}
        </section>
    );
}
export function ChartPage(props: ChartProps) {
    return (
        <main className="cb-page">
            <Chart {...props} />
        </main>
    );
}
