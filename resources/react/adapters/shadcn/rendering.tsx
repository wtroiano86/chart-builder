import { useEffect, useRef, useState } from "react";
import {
    Area,
    Bar,
    CartesianGrid,
    Cell,
    ComposedChart,
    Legend,
    Line,
    Pie,
    PieChart,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import {
    formatValue,
    type ChartAdapterProps,
    type NamedFormatter,
    type RowDatum,
    type Scalar,
    type SeriesDefinition,
} from "@wtroiano/chart-builder-sdk";
import { exportChartImage } from "./export";
import { cartesianPoints, paletteSlots, selectedRows } from "./model";
import type { ShadcnChartComponents } from "./types";
import "./shadcn.css";

export function createShadcnComponent({
    ChartContainer,
    ChartTooltipContent,
    ChartLegendContent,
}: ShadcnChartComponents) {
    return function ShadcnRenderer(props: ChartAdapterProps) {
        const { chart, context } = props;
        const host = useRef<HTMLDivElement>(null);
        const previousColors = useRef<ReadonlyMap<string, number>>(new Map());
        const latest = useRef(props);
        latest.current = props;
        const [size, setSize] = useState({
            width: context.width,
            height: context.height,
        });
        useEffect(
            () => setSize({ width: context.width, height: context.height }),
            [context.width, context.height],
        );
        useEffect(() => {
            const controller = new AbortController();
            latest.current.onReady({
                resize: setSize,
                exportImage: async (request) => {
                    controller.signal.throwIfAborted();
                    if (!host.current)
                        throw new Error("Chart has been disposed.");
                    const snapshot = latest.current.chart;
                    const blob = await exportChartImage(
                        host.current,
                        request,
                        controller.signal,
                    );
                    controller.signal.throwIfAborted();
                    if (latest.current.chart !== snapshot)
                        throw new Error(
                            "Chart changed during image export. Try again.",
                        );
                    return blob;
                },
            });
            return () => {
                controller.abort();
                latest.current.onReady(null);
            };
        }, []);

        const first = chart.series[0];
        const pie = first.type === "pie";
        const horizontal = first.presentation.orientation === "horizontal";
        const points = pie ? [] : cartesianPoints(chart);
        const rows = pie ? selectedRows(chart, 0) : [];
        const animate = chart.appearance.animation && !context.reducedMotion;
        const dataset = chart.datasets[first.datasetId];
        const slots = paletteSlots(
            pie && dataset.kind === "rows"
                ? dataset.rows.map((row) => first.datasetId + ":" + row.id)
                : chart.series.map((series) => series.id),
            context.palette.length || 5,
            previousColors.current,
        );
        useEffect(() => {
            previousColors.current = slots;
        });
        const color = (id: string) => {
            const slot = slots.get(id)!;
            return context.palette[slot] ?? `var(--chart-${slot + 1})`;
        };
        const seriesColor = (index: number) =>
            chart.series[index].presentation.color ??
            color(chart.series[index].id);
        const pieColor = (row: RowDatum) =>
            first.presentation.color ?? color(first.datasetId + ":" + row.id);
        const config = Object.fromEntries(
            pie
                ? rows.map((row, index) => [
                      "p" + index,
                      {
                          label:
                              row.display[first.encode.label[0]] ??
                              String(row.values[first.encode.label[0]] ?? "—"),
                          color: pieColor(row),
                      },
                  ])
                : chart.series.map((series, index) => [
                      "s" + index,
                      { label: series.label, color: seriesColor(index) },
                  ]),
        );
        const format = (value: Scalar, id: string | null) => {
            const descriptor = id ? chart.formats[id] : undefined;
            const custom =
                descriptor?.kind === "custom"
                    ? context.resolveExtension?.("formatter", descriptor.name)
                    : undefined;
            return formatValue(
                value,
                descriptor,
                context.locale,
                context.timezone,
                custom as NamedFormatter | undefined,
            );
        };
        const activate = (
            series: SeriesDefinition,
            row: RowDatum | undefined,
        ) => {
            if (!row) return;
            latest.current.onEvent({
                type: "point-activate",
                chartName: chart.name,
                snapshotId: chart.meta.snapshotId,
                origin: "user",
                seriesId: series.id,
                datum: { kind: "row", datasetId: series.datasetId, id: row.id },
            });
        };
        const x = chart.axes.find((axis) => axis.id === first.axes.x);
        const y = chart.axes.find((axis) => axis.id === first.axes.y);
        const xLabel = (value: string | number) => {
            const point = points.find((point) => point.x === value);
            const row = point && Object.values(point.rows)[0];
            const series =
                point &&
                chart.series.find((_, index) => point.rows["s" + index]);
            return (
                (row && series ? row.display[series.encode.x[0]] : undefined) ??
                format(point?.label ?? value, x?.formatId ?? null)
            );
        };
        const legendPosition = chart.appearance.legend.position;
        const sideLegend =
            legendPosition === "left" || legendPosition === "right";
        const extras = (
            <>
                {chart.appearance.tooltip && (
                    <Tooltip
                        content={
                            <ChartTooltipContent
                                labelFormatter={(label) =>
                                    pie
                                        ? (chart.title ?? first.label)
                                        : xLabel(
                                              typeof label === "number"
                                                  ? label
                                                  : String(label ?? ""),
                                          )
                                }
                                formatter={(_value, name, item) => {
                                    const index = pie
                                        ? 0
                                        : chart.series.findIndex(
                                              (_, index) =>
                                                  item.dataKey === "s" + index,
                                          );
                                    const series = chart.series[index];
                                    if (!series) return null;
                                    const row = pie
                                        ? rows[Number(String(name).slice(1))]
                                        : points.find(
                                              (point) => point === item.payload,
                                          )?.rows["s" + index];
                                    const field =
                                        series.encode[pie ? "value" : "y"][0];
                                    return (
                                        <>
                                            <span
                                                aria-hidden="true"
                                                style={{
                                                    width: 10,
                                                    height: 10,
                                                    borderRadius: 2,
                                                    flexShrink: 0,
                                                    background:
                                                        pie && row
                                                            ? pieColor(row)
                                                            : seriesColor(
                                                                  index,
                                                              ),
                                                }}
                                            />
                                            <span
                                                style={{
                                                    display: "flex",
                                                    flex: 1,
                                                    justifyContent:
                                                        "space-between",
                                                    gap: 12,
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        color: "var(--muted-foreground, currentColor)",
                                                    }}
                                                >
                                                    {pie
                                                        ? config[String(name)]
                                                              ?.label
                                                        : series.label}
                                                </span>
                                                <span
                                                    style={{
                                                        fontFamily:
                                                            "ui-monospace, monospace",
                                                        fontVariantNumeric:
                                                            "tabular-nums",
                                                        fontWeight: 500,
                                                    }}
                                                >
                                                    {row?.display[field] ??
                                                        format(
                                                            row?.values[
                                                                field
                                                            ] ?? null,
                                                            series.formatId,
                                                        )}
                                                </span>
                                            </span>
                                        </>
                                    );
                                }}
                            />
                        }
                    />
                )}
                {chart.appearance.legend.visible && (
                    <Legend
                        layout={sideLegend ? "vertical" : "horizontal"}
                        align={
                            legendPosition === "left" ||
                            legendPosition === "right"
                                ? legendPosition
                                : "center"
                        }
                        verticalAlign={
                            legendPosition === "top"
                                ? "top"
                                : legendPosition === "bottom"
                                  ? "bottom"
                                  : "middle"
                        }
                        content={
                            <ChartLegendContent
                                className={
                                    sideLegend
                                        ? "cb-shadcn-legend cb-shadcn-legend-vertical"
                                        : "cb-shadcn-legend"
                                }
                                verticalAlign={
                                    legendPosition === "top" ? "top" : "bottom"
                                }
                            />
                        }
                    />
                )}
            </>
        );
        const categoryAxis = {
            dataKey: "x",
            type:
                x?.kind === "category"
                    ? ("category" as const)
                    : ("number" as const),
            tickFormatter: xLabel,
            tickLine: false,
            axisLine: false,
            stroke: context.tokens.text,
            tick: { fill: `var(--muted-foreground, ${context.tokens.text})` },
            domain:
                x?.kind === "category"
                    ? undefined
                    : ([
                          x?.domain.min ?? "dataMin",
                          x?.domain.max ?? "dataMax",
                      ] as [number | "dataMin", number | "dataMax"]),
            allowDataOverflow: x?.domain.min !== null || x?.domain.max !== null,
            scale: x?.kind === "time" ? ("time" as const) : ("auto" as const),
            label: x?.title
                ? {
                      value: x.title,
                      position: horizontal
                          ? ("insideLeft" as const)
                          : ("insideBottom" as const),
                  }
                : undefined,
        };
        const valueAxis = {
            type: "number" as const,
            tickLine: false,
            axisLine: false,
            domain: [y?.domain.min ?? 0, y?.domain.max ?? "auto"] as [
                number | "auto",
                number | "auto",
            ],
            allowDataOverflow: y?.domain.min !== null || y?.domain.max !== null,
            tickFormatter: (value: number) =>
                format(value, y?.formatId ?? null),
            stroke: context.tokens.text,
            tick: { fill: `var(--muted-foreground, ${context.tokens.text})` },
            label: y?.title
                ? {
                      value: y.title,
                      position: horizontal
                          ? ("insideBottom" as const)
                          : ("insideLeft" as const),
                  }
                : undefined,
        };
        if (size.width <= 0 || size.height <= 0) return null;
        return (
            <div ref={host} style={{ width: size.width, height: size.height }}>
                <ChartContainer
                    config={config}
                    className={
                        context.theme === "dark"
                            ? "cb-shadcn dark"
                            : "cb-shadcn"
                    }
                    style={{
                        width: size.width,
                        height: size.height,
                        minWidth: 0,
                        color: `var(--foreground, ${context.tokens.text})`,
                    }}
                    aria-label={chart.title ?? chart.name}
                >
                    {pie ? (
                        <PieChart
                            width={size.width}
                            height={size.height}
                            accessibilityLayer
                        >
                            <Pie
                                data={rows.map((row, index) => ({
                                    name: "p" + index,
                                    value: row.values[first.encode.value[0]],
                                }))}
                                dataKey="value"
                                nameKey="name"
                                innerRadius={
                                    (first.presentation.radius?.[0] ?? 0) *
                                        100 +
                                    "%"
                                }
                                outerRadius={
                                    (first.presentation.radius?.[1] ?? 0.8) *
                                        100 +
                                    "%"
                                }
                                isAnimationActive={animate}
                                onClick={(_, index) =>
                                    activate(first, rows[index])
                                }
                            >
                                {rows.map((row, index) => (
                                    <Cell key={row.id} fill={pieColor(row)} />
                                ))}
                            </Pie>
                            {extras}
                        </PieChart>
                    ) : (
                        <ComposedChart
                            width={size.width}
                            height={size.height}
                            data={points}
                            layout={horizontal ? "vertical" : "horizontal"}
                            accessibilityLayer
                            margin={{
                                top: 20,
                                right: 20,
                                bottom: 20,
                                left: 16,
                            }}
                        >
                            <CartesianGrid
                                vertical={horizontal}
                                horizontal={!horizontal}
                                stroke={`var(--border, ${context.tokens.grid})`}
                                strokeOpacity={0.5}
                            />
                            <XAxis
                                {...(horizontal ? valueAxis : categoryAxis)}
                                orientation={
                                    x?.position === "top" ? "top" : "bottom"
                                }
                            />
                            <YAxis
                                {...(horizontal ? categoryAxis : valueAxis)}
                                orientation={
                                    y?.position === "right" ? "right" : "left"
                                }
                            />
                            {chart.series.map((series, index) => {
                                const key = "s" + index;
                                const common = {
                                    dataKey: key,
                                    name: key,
                                    stroke: seriesColor(index),
                                    fill: seriesColor(index),
                                    isAnimationActive: animate,
                                    connectNulls: false,
                                };
                                if (series.type === "bar")
                                    return (
                                        <Bar
                                            key={series.id}
                                            {...common}
                                            stackId={
                                                series.presentation.stack ??
                                                undefined
                                            }
                                            radius={4}
                                            onClick={(_, rowIndex) =>
                                                activate(
                                                    series,
                                                    points[rowIndex]?.rows[key],
                                                )
                                            }
                                        />
                                    );
                                const LineComponent = series.presentation.area
                                    ? Area
                                    : Line;
                                return (
                                    <LineComponent
                                        key={series.id}
                                        {...common}
                                        fill={
                                            series.presentation.area
                                                ? seriesColor(index)
                                                : "none"
                                        }
                                        fillOpacity={0.25}
                                        strokeWidth={2}
                                        stackId={
                                            series.presentation.stack ??
                                            undefined
                                        }
                                        type={
                                            series.presentation.step === "start"
                                                ? "stepBefore"
                                                : series.presentation.step ===
                                                    "end"
                                                  ? "stepAfter"
                                                  : series.presentation.step ===
                                                      "middle"
                                                    ? "step"
                                                    : series.presentation.smooth
                                                      ? "monotone"
                                                      : "linear"
                                        }
                                        activeDot={false}
                                        dot={(dot) => {
                                            const row =
                                                points[dot.index]?.rows[key];
                                            if (
                                                !row ||
                                                row.values[
                                                    series.encode.y[0]
                                                ] === null
                                            )
                                                return <g key={dot.index} />;
                                            return (
                                                <circle
                                                    key={row.id}
                                                    cx={dot.cx}
                                                    cy={dot.cy}
                                                    r={
                                                        (series.presentation
                                                            .symbolSize ?? 8) /
                                                        2
                                                    }
                                                    fill={seriesColor(index)}
                                                    role="button"
                                                    tabIndex={0}
                                                    aria-label={
                                                        series.label +
                                                        ": " +
                                                        format(
                                                            row.values[
                                                                series.encode
                                                                    .y[0]
                                                            ],
                                                            series.formatId,
                                                        )
                                                    }
                                                    onClick={() =>
                                                        activate(series, row)
                                                    }
                                                    onKeyDown={(event) => {
                                                        if (
                                                            event.key ===
                                                                "Enter" ||
                                                            event.key === " "
                                                        ) {
                                                            event.preventDefault();
                                                            activate(
                                                                series,
                                                                row,
                                                            );
                                                        }
                                                    }}
                                                />
                                            );
                                        }}
                                    />
                                );
                            })}
                            {extras}
                        </ComposedChart>
                    )}
                </ChartContainer>
            </div>
        );
    };
}
