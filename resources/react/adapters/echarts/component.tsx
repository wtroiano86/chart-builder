import { useEffect, useRef } from "react";
import type * as ECharts from "echarts";
import type {
    ChartAdapterProps,
    ChartEvent,
    DatumRef,
} from "@wtroiano/chart-builder-sdk";
import { compileChart } from "./compiler";

export function createEChartsComponent(
    engine: Pick<typeof ECharts, "init" | "registerMap">,
) {
    return function EChartsRenderer(props: ChartAdapterProps) {
        const host = useRef<HTMLDivElement>(null);
        const instance = useRef<ECharts.ECharts | null>(null);
        const latest = useRef(props);
        const refs = useRef(new Map<string, DatumRef[]>());
        const updating = useRef(false);
        latest.current = props;

        useEffect(() => {
            if (
                !host.current ||
                props.context.width <= 0 ||
                props.context.height <= 0
            )
                return;
            const mode = props.chart.appearance.renderingMode ?? "canvas";
            let alive = true;
            try {
                for (const coordinate of props.chart.coordinates) {
                    if (coordinate.kind !== "geo") continue;
                    const asset = props.context.resolveExtension?.(
                        "geography",
                        coordinate.asset,
                    );
                    if (!asset)
                        throw new Error(
                            "Register the geography asset: " + coordinate.asset,
                        );
                    engine.registerMap(
                        coordinate.asset,
                        asset as Parameters<typeof engine.registerMap>[1],
                    );
                }
                const chart = engine.init(host.current, undefined, {
                    renderer: mode as "canvas" | "svg",
                    width: props.context.width,
                    height: props.context.height,
                });
                instance.current = chart;
                chart.on("click", (input: unknown) => {
                    const event = input as {
                        seriesId?: string;
                        dataIndex?: number;
                        dataType?: string;
                        data?: { id?: string };
                    };
                    const payload = latest.current.chart;
                    const series = payload.series.find(
                        (item) => item.id === event.seriesId,
                    );
                    if (!series) return;
                    let datum = refs.current.get(series.id)?.[
                        event.dataIndex ?? -1
                    ];
                    const dataset = payload.datasets[series.datasetId];
                    if (dataset.kind === "hierarchy" && event.data?.id)
                        datum = {
                            datasetId: series.datasetId,
                            kind: "node",
                            id: event.data.id,
                        };
                    if (dataset.kind === "graph") {
                        const row =
                            event.dataType === "edge"
                                ? dataset.links[event.dataIndex ?? -1]
                                : dataset.nodes[event.dataIndex ?? -1];
                        if (row)
                            datum = {
                                datasetId: series.datasetId,
                                kind:
                                    event.dataType === "edge" ? "link" : "node",
                                id: row.id,
                            };
                    }
                    if (datum)
                        emit({
                            type: "point-activate",
                            seriesId: series.id,
                            datum,
                        });
                });
                chart.on("legendselectchanged", (input: unknown) => {
                    const event = input as {
                        name?: string;
                        selected?: Record<string, boolean>;
                    };
                    const series = latest.current.chart.series.find(
                        (item) => item.label === event.name,
                    );
                    if (series && event.name)
                        emit({
                            type: "series-visibility",
                            seriesId: series.id,
                            visible: event.selected?.[event.name] ?? true,
                        });
                });
                chart.on("datazoom", (input: unknown) => {
                    type Zoom = {
                        id?: string;
                        dataZoomId?: string;
                        startValue?: number | string;
                        endValue?: number | string;
                    };
                    const event = input as Zoom & { batch?: Zoom[] };
                    const calculated = chart.getOption().dataZoom as
                        Zoom[] | undefined;
                    for (const change of event.batch ?? [event]) {
                        const id = change.dataZoomId ?? change.id;
                        const range =
                            calculated?.find((zoom) => !id || zoom.id === id) ??
                            change;
                        const axis = latest.current.chart.axes.find(
                            (item) =>
                                range.id === "zoom:" + item.id ||
                                (!range.id &&
                                    ["top", "bottom"].includes(item.position)),
                        );
                        if (
                            axis &&
                            range.startValue !== undefined &&
                            range.endValue !== undefined
                        )
                            emit({
                                type: "viewport-change",
                                coordinateId: axis.coordinateId,
                                ranges: [
                                    {
                                        axisId: axis.id,
                                        from: range.startValue,
                                        to: range.endValue,
                                    },
                                ],
                            });
                    }
                });
                props.onReady({
                    resize: ({ width, height }) => {
                        if (alive) chart.resize({ width, height });
                    },
                    exportImage: async (request) => {
                        if (!alive) throw new Error("Chart has been disposed.");
                        if (
                            (mode === "canvas" && request.format !== "png") ||
                            (mode === "svg" && request.format !== "svg") ||
                            request.scale <= 0 ||
                            (mode === "svg" && request.scale !== 1)
                        )
                            throw new Error(
                                "Unsupported image export for this rendering mode.",
                            );
                        const url = chart.getDataURL({
                            type: request.format as "png" | "svg",
                            pixelRatio: request.scale,
                            backgroundColor: request.background ?? undefined,
                        });
                        const response = await fetch(url);
                        return response.blob();
                    },
                });
                update();
            } catch (error) {
                latest.current.onError({
                    code: "render_failed",
                    message:
                        error instanceof Error
                            ? error.message
                            : "Chart initialization failed.",
                    retryable: false,
                    referenceId: null,
                });
            }
            function emit(
                event:
                    | Omit<
                          Extract<ChartEvent, { type: "point-activate" }>,
                          "chartName" | "snapshotId" | "origin"
                      >
                    | Omit<
                          Extract<ChartEvent, { type: "series-visibility" }>,
                          "chartName" | "snapshotId" | "origin"
                      >
                    | Omit<
                          Extract<ChartEvent, { type: "viewport-change" }>,
                          "chartName" | "snapshotId" | "origin"
                      >,
            ) {
                const payload = latest.current.chart;
                latest.current.onEvent({
                    ...event,
                    chartName: payload.name,
                    snapshotId: payload.meta.snapshotId,
                    origin: updating.current ? "programmatic" : "user",
                });
            }
            function update() {
                const chart = instance.current;
                if (!chart) return;
                const compiled = compileChart(
                    latest.current.chart,
                    latest.current.context,
                );
                refs.current = compiled.data;
                updating.current = true;
                chart.setOption(compiled.option, {
                    notMerge: true,
                    silent: true,
                });
                updating.current = false;
            }
            return () => {
                alive = false;
                props.onReady(null);
                instance.current?.dispose();
                instance.current = null;
            };
        }, [
            props.chart.name,
            props.chart.appearance.renderingMode,
            props.context.width > 0,
            props.context.height > 0,
        ]);

        useEffect(() => {
            if (!instance.current) return;
            try {
                const compiled = compileChart(props.chart, props.context);
                refs.current = compiled.data;
                updating.current = true;
                const previous = instance.current.getOption();
                const legends = previous.legend as
                    Array<{ selected?: Record<string, boolean> }> | undefined;
                const legend = compiled.option.legend as
                    Record<string, unknown> | undefined;
                if (legend && legends?.[0]?.selected)
                    legend.selected = legends[0].selected;
                const zooms = previous.dataZoom as
                    | Array<{ id?: string; start?: number; end?: number }>
                    | undefined;
                const nextZooms = compiled.option.dataZoom as
                    Array<Record<string, unknown>> | undefined;
                for (const zoom of nextZooms ?? []) {
                    const prior = zooms?.find((item) => item.id === zoom.id);
                    if (prior) {
                        zoom.start = prior.start;
                        zoom.end = prior.end;
                    }
                }
                for (const coordinate of props.chart.coordinates) {
                    if (coordinate.kind !== "geo") continue;
                    const asset = props.context.resolveExtension?.(
                        "geography",
                        coordinate.asset,
                    );
                    if (!asset)
                        throw new Error(
                            "Register the geography asset: " + coordinate.asset,
                        );
                    engine.registerMap(
                        coordinate.asset,
                        asset as Parameters<typeof engine.registerMap>[1],
                    );
                }
                instance.current.setOption(compiled.option, {
                    notMerge: true,
                    silent: true,
                });
                instance.current.resize({
                    width: props.context.width,
                    height: props.context.height,
                });
            } catch (error) {
                props.onError({
                    code: "render_failed",
                    message:
                        error instanceof Error
                            ? error.message
                            : "Chart rendering failed.",
                    retryable: false,
                    referenceId: null,
                });
            } finally {
                updating.current = false;
            }
        }, [props.chart, props.context]);
        return (
            <div
                ref={host}
                className="cb-engine"
                aria-hidden="true"
                style={{ width: "100%", height: props.context.height }}
            />
        );
    };
}
