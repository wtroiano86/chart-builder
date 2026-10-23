import {
    formatValue,
    type NamedFormatter,
    type Scalar,
    type ChartPayload,
    type CoordinateDefinition,
    type DatasetPayload,
    type DatumRef,
    type HierarchyNode,
    type JsonObject,
    type PresentationContext,
    type RowDatum,
    type SeriesDefinition,
} from "@wtroiano/chart-builder-sdk";

export interface CompiledChart {
    option: Record<string, unknown>;
    data: Map<string, DatumRef[]>;
}
const percent = (fraction: number) => fraction * 100 + "%";

function rows(series: SeriesDefinition, dataset: DatasetPayload): RowDatum[] {
    const data =
        dataset.kind === "rows"
            ? dataset.rows
            : dataset.kind === "series"
              ? dataset.projection.rows
              : [];
    const ids = series.itemIds && new Set(series.itemIds);
    return ids ? data.filter((row) => ids.has(row.id)) : data;
}
function field(
    series: SeriesDefinition,
    row: RowDatum,
    role: string,
    fallback: unknown = null,
): unknown {
    const name = series.encode[role]?.[0];
    return name ? row.values[name] : fallback;
}
function numericTime(value: unknown): unknown {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)
        ? Date.parse(value)
        : value;
}
function tree(nodes: HierarchyNode[]): Record<string, unknown>[] {
    return nodes.map((node) => ({
        id: node.id,
        name: node.label,
        value: node.value ?? undefined,
        children: tree(node.children),
    }));
}
function flatten(nodes: HierarchyNode[]): HierarchyNode[] {
    return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

export function compileChart(
    chart: ChartPayload,
    context: PresentationContext,
): CompiledChart {
    const data = new Map<string, DatumRef[]>();
    const display = (value: Scalar, id: string | null): string => {
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
            typeof custom === "function"
                ? (custom as NamedFormatter)
                : undefined,
        );
    };
    const coordinate = new Map(
        chart.coordinates.map((item) => [item.id, item]),
    );
    const axes = new Map(chart.axes.map((item) => [item.id, item]));
    const horizontal = new Set(
        chart.series
            .filter((item) => item.presentation.orientation === "horizontal")
            .map((item) => item.coordinateId),
    );
    const coordinateOptions: Record<string, unknown[]> = {};
    const coordinateIndex = new Map<string, number>();
    const coordinateKey = (kind: CoordinateDefinition["kind"]) =>
        kind === "cartesian" ? "grid" : kind;
    for (const item of chart.coordinates) {
        const key = coordinateKey(item.kind);
        const list = (coordinateOptions[key] ??= []);
        coordinateIndex.set(item.id, list.length);
        switch (item.kind) {
            case "cartesian":
                list.push({
                    id: item.id,
                    left: percent(item.bounds[0] + item.bounds[2] * 0.06),
                    top: percent(item.bounds[1] + item.bounds[3] * 0.04),
                    width: percent(item.bounds[2] * 0.88),
                    height: percent(item.bounds[3] * 0.8),
                    containLabel: true,
                });
                break;
            case "polar":
                list.push({
                    id: item.id,
                    center: item.center.map(percent),
                    radius: percent(item.radius),
                });
                break;
            case "radar":
                list.push({
                    id: item.id,
                    indicator: item.indicators.map((value) => ({
                        name: value.label,
                        min: value.min,
                        max: value.max,
                    })),
                });
                break;
            case "geo": {
                const projection = item.projection
                    ? context.resolveExtension?.("renderer", item.projection)
                    : undefined;
                if (item.projection && !projection)
                    throw new Error(
                        "Register the geographic projection: " +
                            item.projection,
                    );
                list.push({
                    id: item.id,
                    map: item.asset,
                    roam: true,
                    projection,
                });
                break;
            }
            case "calendar": {
                const end = new Date(item.until + "T00:00:00Z");
                end.setUTCDate(end.getUTCDate() - 1);
                list.push({
                    id: item.id,
                    range: [item.from, end.toISOString().slice(0, 10)],
                    cellSize: ["auto", 18],
                    dayLabel: { firstDay: item.weekStartsOn % 7 },
                });
                break;
            }
            case "matrix":
                list.push({
                    id: item.id,
                    x: { data: item.columns },
                    y: { data: item.rows },
                });
                break;
            case "parallel":
                list.push({
                    id: item.id,
                    left: "8%",
                    right: "8%",
                    bottom: "18%",
                });
                break;
            case "none":
                break;
        }
    }
    const axisOptions: Record<string, unknown[]> = {};
    const axisIndex = new Map<string, number>();
    for (const axis of chart.axes) {
        const kind = coordinate.get(axis.coordinateId)?.kind;
        const logicalX = axis.position === "top" || axis.position === "bottom";
        const role =
            kind === "polar"
                ? axis.position === "angle"
                    ? "angleAxis"
                    : "radiusAxis"
                : kind === "parallel"
                  ? "parallelAxis"
                  : logicalX !== horizontal.has(axis.coordinateId)
                    ? "xAxis"
                    : "yAxis";
        const list = (axisOptions[role] ??= []);
        axisIndex.set(axis.id, list.length);
        list.push({
            id: axis.id,
            type: axis.kind,
            name: axis.title ?? undefined,
            ...(kind === "cartesian"
                ? {
                      gridIndex: coordinateIndex.get(axis.coordinateId),
                      position: horizontal.has(axis.coordinateId)
                          ? logicalX
                              ? "left"
                              : "bottom"
                          : axis.position,
                  }
                : {}),
            ...(kind === "polar"
                ? { polarIndex: coordinateIndex.get(axis.coordinateId) }
                : {}),
            ...(kind === "parallel"
                ? {
                      parallelIndex: coordinateIndex.get(axis.coordinateId),
                      dim: list.length,
                  }
                : {}),
            data: axis.domain.categories ?? undefined,
            min: axis.domain.min ?? undefined,
            max: axis.domain.max ?? undefined,
            logBase: axis.logBase ?? undefined,
            axisLabel: {
                color: context.tokens.text,
                formatter: (value: string | number) =>
                    display(value, axis.formatId),
            },
            axisLine: { lineStyle: { color: context.tokens.border } },
            splitLine: { lineStyle: { color: context.tokens.grid } },
        });
    }
    const series = chart.series.map((definition): Record<string, unknown> => {
        const dataset = chart.datasets[definition.datasetId];
        const selected = rows(definition, dataset);
        const system = definition.coordinateId
            ? coordinate.get(definition.coordinateId)
            : undefined;
        const mode = system?.kind;
        const refs: DatumRef[] = selected.map((row) => ({
            datasetId: definition.datasetId,
            kind: dataset.kind === "series" ? "item" : "row",
            id: row.id,
        }));
        const presentation = definition.presentation;
        const option: Record<string, unknown> = {
            id: definition.id,
            name: definition.label,
            type: definition.type,
            tooltip: {
                valueFormatter: (value: Scalar | Scalar[]) =>
                    Array.isArray(value)
                        ? value
                              .map((item) => display(item, definition.formatId))
                              .join(", ")
                        : display(value, definition.formatId),
            },
            ...(presentation.color
                ? {
                      itemStyle: { color: presentation.color },
                      lineStyle: { color: presentation.color },
                  }
                : {}),
            stack: presentation.stack ?? undefined,
            smooth: presentation.smooth,
            step: presentation.step ?? false,
            areaStyle: presentation.area ? {} : undefined,
            radius: presentation.radius?.map(percent),
            symbolSize: presentation.symbolSize ?? undefined,
            emphasis: { focus: "series" },
            animation: chart.appearance.animation && !context.reducedMotion,
        };
        if (mode && mode !== "none" && !["radar", "parallel"].includes(mode)) {
            option.coordinateSystem =
                mode === "cartesian" ? "cartesian2d" : mode;
            option[mode === "cartesian" ? "gridIndex" : mode + "Index"] =
                coordinateIndex.get(definition.coordinateId!);
        }
        for (const [role, id] of Object.entries(definition.axes)) {
            const key =
                mode === "polar"
                    ? role === "x" || role === "angle"
                        ? "angleAxisIndex"
                        : "radiusAxisIndex"
                    : (horizontal.has(definition.coordinateId)
                          ? role === "x"
                              ? "y"
                              : "x"
                          : role) + "AxisIndex";
            option[key] = axisIndex.get(id);
        }
        if (dataset.kind === "hierarchy") {
            option.data = tree(dataset.roots);
            refs.splice(
                0,
                refs.length,
                ...flatten(dataset.roots).map((node) => ({
                    datasetId: definition.datasetId,
                    kind: "node" as const,
                    id: node.id,
                })),
            );
            if (definition.type === "tree") {
                option.top = "10%";
                option.bottom = "15%";
                option.initialTreeDepth = -1;
            }
        } else if (dataset.kind === "graph") {
            option.data = dataset.nodes.map((node) => ({
                ...node.attributes,
                id: node.id,
                name: node.label,
                value: node.value,
            }));
            option.links = dataset.links.map((link) => ({
                id: link.id,
                source: link.source,
                target: link.target,
                value: link.value,
                name: link.label ?? undefined,
            }));
            refs.splice(
                0,
                refs.length,
                ...dataset.nodes.map((node) => ({
                    datasetId: definition.datasetId,
                    kind: "node" as const,
                    id: node.id,
                })),
            );
            if (definition.type === "graph") {
                option.layout = "force";
                option.roam = true;
                option.force = { repulsion: 180 };
                option.edgeSymbol = dataset.directed
                    ? ["none", "arrow"]
                    : undefined;
            }
        } else if (dataset.kind === "series") {
            const ids = definition.itemIds && new Set(definition.itemIds);
            option.data = dataset.items
                .filter((item) => !ids || ids.has(item.id))
                .map((item) => ({ id: item.id, value: item.value }));
            if (definition.type === "lines")
                option.data = dataset.items
                    .filter((item) => !ids || ids.has(item.id))
                    .map((item) => ({ id: item.id, coords: item.value }));
        } else {
            option.data = selected.map((row) => {
                const x = field(definition, row, "x"),
                    y = field(definition, row, "y");
                let value: unknown;
                switch (definition.type) {
                    case "pie":
                    case "funnel":
                    case "gauge":
                    case "map":
                        value = field(definition, row, "value");
                        break;
                    case "radar":
                        value = (definition.encode.indicators ?? []).map(
                            (key) => row.values[key],
                        );
                        break;
                    case "parallel":
                        value = (definition.encode.dimensions ?? []).map(
                            (key) => row.values[key],
                        );
                        break;
                    case "boxplot":
                        value = [
                            x,
                            ...["min", "q1", "median", "q3", "max"].map((key) =>
                                field(definition, row, key),
                            ),
                        ];
                        break;
                    case "candlestick":
                        value = [
                            x,
                            ...["open", "close", "low", "high"].map((key) =>
                                field(definition, row, key),
                            ),
                        ];
                        break;
                    case "heatmap":
                        value =
                            mode === "calendar"
                                ? [x, field(definition, row, "value")]
                                : [x, y, field(definition, row, "value")];
                        break;
                    case "themeRiver":
                        value = [
                            field(definition, row, "time"),
                            field(definition, row, "value"),
                            field(definition, row, "category"),
                        ];
                        break;
                    default: {
                        const xAxis = axes.get(definition.axes.x);
                        const yAxis = axes.get(definition.axes.y);
                        const pair = [
                            xAxis?.kind === "time" ? numericTime(x) : x,
                            yAxis?.kind === "time" ? numericTime(y) : y,
                        ];
                        value =
                            presentation.orientation === "horizontal"
                                ? pair.reverse()
                                : pair;
                    }
                }
                return {
                    id: row.id,
                    name: String(field(definition, row, "label", x ?? row.id)),
                    value,
                };
            });
            if (
                definition.type === "boxplot" ||
                definition.type === "candlestick"
            )
                option.encode = {
                    x: 0,
                    y:
                        definition.type === "boxplot"
                            ? [1, 2, 3, 4, 5]
                            : [1, 2, 3, 4],
                };
            if (definition.encode.size)
                option.symbolSize = (
                    _: unknown,
                    params: { dataIndex: number },
                ) =>
                    Number(
                        field(
                            definition,
                            selected[params.dataIndex],
                            "size",
                            10,
                        ),
                    );
        }
        if (mode === "geo" && definition.type === "map") {
            option.map = system?.kind === "geo" ? system.asset : undefined;
            option.geoIndex = coordinateIndex.get(definition.coordinateId!);
        }
        if (definition.type === "radar")
            option.radarIndex = coordinateIndex.get(definition.coordinateId!);
        if (definition.type === "parallel")
            option.parallelIndex = coordinateIndex.get(
                definition.coordinateId!,
            );
        if (definition.type === "themeRiver")
            option.coordinateSystem = "singleAxis";
        if (definition.type === "themeRiver")
            option.data = selected.map((row) => [
                field(definition, row, "time"),
                field(definition, row, "value"),
                field(definition, row, "category"),
            ]);
        if (mode === "polar") option.encode = { angle: 0, radius: 1 };
        if (definition.type === "custom") {
            const renderer =
                definition.rendererName &&
                context.resolveExtension?.("renderer", definition.rendererName);
            if (typeof renderer !== "function")
                throw new Error(
                    "Register the custom renderer: " + definition.rendererName,
                );
            option.renderItem = renderer;
        }
        if (definition.type === "pictorialBar") option.symbol = "rect";
        data.set(definition.id, refs);
        // Engine callbacks are compiled locally; only the explicit JSON override is recursively merged.
        return applyOptions(option, definition.adapterOptions.echarts ?? {});
    });
    const option: Record<string, unknown> = {
        color: context.palette,
        backgroundColor: "transparent",
        textStyle: {
            fontFamily: "system-ui, sans-serif",
            color: context.tokens.text,
        },
        animation: chart.appearance.animation && !context.reducedMotion,
        legend: {
            show: chart.appearance.legend.visible,
            [chart.appearance.legend.position]: 0,
            textStyle: { color: context.tokens.text },
        },
        tooltip: {
            show: chart.appearance.tooltip,
            renderMode: "richText",
            trigger: "item",
            confine: true,
        },
        aria: { enabled: true, decal: { show: true } },
        ...coordinateOptions,
        ...axisOptions,
        series,
    };
    if (chart.series.some((item) => item.type === "themeRiver"))
        option.singleAxis = { type: "time", bottom: "15%" };
    if (chart.series.some((item) => ["heatmap", "map"].includes(item.type))) {
        const values = chart.series
            .filter((item) => ["heatmap", "map"].includes(item.type))
            .flatMap((item) =>
                rows(item, chart.datasets[item.datasetId]).map((row) =>
                    Number(field(item, row, "value", 0)),
                ),
            );
        option.visualMap = {
            min: Math.min(0, ...values),
            max: Math.max(1, ...values),
            calculable: true,
            orient: "horizontal",
            bottom: 0,
        };
    }
    if (
        chart.requirements.some(
            (item) => item.name === "interaction.viewport-change",
        )
    )
        option.dataZoom = chart.axes
            .filter((axis) => ["bottom", "top"].includes(axis.position))
            .map((axis) => ({
                id: "zoom:" + axis.id,
                type: "inside",
                [horizontal.has(axis.coordinateId)
                    ? "yAxisIndex"
                    : "xAxisIndex"]: axisIndex.get(axis.id),
            }));
    return {
        option: cleanOptions(
            applyOptions(option, chart.adapterOptions.echarts ?? {}),
        ),
        data,
    };
}

function cleanOptions(input: Record<string, unknown>): Record<string, unknown> {
    const clean = (value: unknown): unknown =>
        Array.isArray(value)
            ? value.map(clean)
            : value && typeof value === "object"
              ? cleanOptions(value as Record<string, unknown>)
              : value;
    return Object.fromEntries(
        Object.entries(input)
            .filter(([, value]) => value !== undefined)
            .map(([key, value]) => [key, clean(value)]),
    );
}

function applyOptions(
    base: Record<string, unknown>,
    override: JsonObject,
): Record<string, unknown> {
    const result = { ...base };
    for (const [key, value] of Object.entries(override)) {
        const previous = result[key];
        if (
            value &&
            typeof value === "object" &&
            !Array.isArray(value) &&
            previous &&
            typeof previous === "object" &&
            !Array.isArray(previous)
        )
            result[key] = applyOptions(
                previous as Record<string, unknown>,
                value,
            );
        else result[key] = value;
    }
    return result;
}
