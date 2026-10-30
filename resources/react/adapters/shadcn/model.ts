import {
    validateCapabilities,
    type AdapterManifest,
    type CapabilityIssue,
    type ChartPayload,
    type RowDatum,
    type Scalar,
} from "@wtroiano/chart-builder-sdk";

export interface ChartPoint {
    x: string | number;
    label: Scalar;
    rows: Record<string, RowDatum>;
    [key: string]: unknown;
}

/** Retain colors for present identities and use free palette slots before repeating. */
export function paletteSlots(
    identities: string[],
    size: number,
    previous: ReadonlyMap<string, number>,
): Map<string, number> {
    const ids = [...new Set(identities)].sort();
    const slots = new Map<string, number>();
    const used = new Set<number>();
    for (const id of ids) {
        const existing = previous.get(id);
        if (existing === undefined) continue;
        const slot = existing % size;
        if (used.has(slot)) continue;
        slots.set(id, slot);
        used.add(slot);
    }
    for (const id of ids) {
        if (slots.has(id)) continue;
        let hash = 0;
        for (const character of id)
            hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
        let slot = hash % size;
        for (let offset = 0; offset < size; offset++) {
            const candidate = (hash + offset) % size;
            if (!used.has(candidate)) {
                slot = candidate;
                break;
            }
        }
        slots.set(id, slot);
        used.add(slot);
    }
    // The map contains only current dataset/series identities, so updates cannot grow it indefinitely.
    return slots;
}

export function selectedRows(chart: ChartPayload, index: number): RowDatum[] {
    const series = chart.series[index];
    const dataset = chart.datasets[series.datasetId];
    if (dataset.kind !== "rows")
        throw new Error("Shadcn requires row datasets.");
    const ids = series.itemIds === null ? null : new Set(series.itemIds);
    return ids ? dataset.rows.filter((row) => ids.has(row.id)) : dataset.rows;
}

export function cartesianPoints(chart: ChartPayload): ChartPoint[] {
    const axis = chart.axes.find((axis) => axis.id === chart.series[0].axes.x)!;
    const points = new Map<string | number, ChartPoint>();
    for (const [index, series] of chart.series.entries()) {
        const key = "s" + index;
        const field = series.encode.x[0];
        for (const row of selectedRows(chart, index)) {
            const label = row.values[field];
            const x =
                axis.kind === "category"
                    ? JSON.stringify(
                          row.categoryKeys?.[field] === undefined
                              ? ["value", label]
                              : ["key", row.categoryKeys[field]],
                      )
                    : axis.kind === "time" && typeof label === "string"
                      ? Date.parse(label)
                      : Number(label);
            if (
                axis.kind !== "category" &&
                (label === null ||
                    !Number.isFinite(x) ||
                    (axis.kind === "value" && typeof label !== "number") ||
                    (axis.kind === "time" &&
                        typeof label !== "string" &&
                        typeof label !== "number"))
            )
                throw new Error(
                    "Shadcn requires finite, non-null numeric/time coordinates.",
                );
            const point = points.get(x) ?? { x, label, rows: {} };
            if (point.rows[key])
                throw new Error(
                    "Shadcn requires unique x values within each series.",
                );
            point.rows[key] = row;
            point[key] = row.values[series.encode.y[0]];
            points.set(x, point);
        }
    }
    if (axis.kind === "category" && axis.domain.categories) {
        const labels = new Set(
            [...points.values()].map((point) => point.label),
        );
        for (const label of axis.domain.categories) {
            if (!labels.has(label)) {
                const x = JSON.stringify(["value", label]);
                points.set(x, { x, label, rows: {} });
            }
        }
        const order = new Map(
            axis.domain.categories.map((value, index) => [
                JSON.stringify(value),
                index,
            ]),
        );
        return [...points.values()].sort(
            (a, b) =>
                (order.get(JSON.stringify(a.label)) ?? order.size) -
                (order.get(JSON.stringify(b.label)) ?? order.size),
        );
    }
    return [...points.values()];
}

export function validateShadcnChart(
    chart: ChartPayload,
    manifest: AdapterManifest,
): CapabilityIssue[] {
    const issues = validateCapabilities(chart, manifest);
    const fail = (path: string, message: string) =>
        issues.push({
            code: "unsupported_feature",
            chartName: chart.name,
            adapterName: manifest.name,
            path,
            message,
        });
    if (Object.keys(chart.adapterOptions.shadcn ?? {}).length)
        fail(
            "adapterOptions.shadcn",
            "Shadcn does not accept raw engine options.",
        );
    for (const [index, series] of chart.series.entries()) {
        if (
            (series.type !== "pie" && series.presentation.radius !== null) ||
            (series.type !== "line" && series.presentation.symbolSize !== null)
        )
            fail(
                "series." + index + ".presentation",
                "Radius is supported on pies; symbol size is supported on lines.",
            );
        if (
            Object.keys(series.adapterOptions.shadcn ?? {}).length ||
            series.rendererName
        )
            fail(
                "series." + index,
                "Shadcn does not accept raw engine options or custom renderers.",
            );
        if (
            series.type !== "line" &&
            (series.presentation.area ||
                series.presentation.step ||
                series.presentation.smooth)
        )
            fail(
                "series." + index + ".presentation",
                "Area, step and smooth require a line series.",
            );
        if (
            series.type === "line" &&
            series.presentation.stack &&
            !series.presentation.area
        )
            fail(
                "series." + index + ".presentation.stack",
                "Stacked lines require area presentation.",
            );
    }
    if (chart.extensions.some((extension) => extension.kind !== "formatter"))
        fail("extensions", "Shadcn supports formatter extensions only.");
    const first = chart.series[0];
    if (!first || issues.length) return issues;
    if (first.type === "pie") {
        if (
            chart.series.length !== 1 ||
            chart.axes.length ||
            chart.coordinates.some((c) => c.kind !== "none") ||
            first.presentation.stack ||
            first.presentation.orientation !== "vertical"
        )
            fail(
                "series",
                "Shadcn supports one pie/donut series without axes or stacking.",
            );
        if (
            selectedRows(chart, 0).some(
                (row) => Number(row.values[first.encode.value[0]]) < 0,
            )
        )
            fail("series.0.encode.value", "Pie values must be non-negative.");
        return issues;
    }
    const coordinate = chart.coordinates.find(
        (value) => value.id === first.coordinateId,
    );
    const x = chart.axes.find((axis) => axis.id === first.axes.x);
    const y = chart.axes.find((axis) => axis.id === first.axes.y);
    if (
        chart.coordinates.length !== 1 ||
        coordinate?.kind !== "cartesian" ||
        coordinate.bounds.some((value, i) => value !== [0, 0, 1, 1][i])
    )
        fail(
            "coordinates",
            "Shadcn supports one full-size Cartesian coordinate.",
        );
    if (
        chart.axes.length !== 2 ||
        !x ||
        !y ||
        !["category", "value", "time"].includes(x.kind) ||
        y.kind !== "value" ||
        !["top", "bottom"].includes(x.position) ||
        !["left", "right"].includes(y.position)
    )
        fail(
            "axes",
            "Shadcn requires one category/value/time x axis and one value y axis.",
        );
    if (
        chart.series.some(
            (series) =>
                series.coordinateId !== first.coordinateId ||
                series.axes.x !== first.axes.x ||
                series.axes.y !== first.axes.y ||
                series.presentation.orientation !==
                    first.presentation.orientation,
        )
    )
        fail(
            "series",
            "Cartesian series must share axes, coordinate and orientation.",
        );
    if (
        first.presentation.orientation === "horizontal" &&
        chart.series.some((series) => series.type !== "bar")
    )
        fail("series", "Horizontal orientation supports bars only.");
    const stacks = new Map<string, string>();
    for (const series of chart.series) {
        const stack = series.presentation.stack;
        if (stack === null) continue;
        if (stacks.has(stack) && stacks.get(stack) !== series.type)
            fail("series", "Bars and areas cannot share a stack group.");
        stacks.set(stack, series.type);
    }
    if (!issues.length) {
        try {
            cartesianPoints(chart);
        } catch (error) {
            fail(
                "datasets",
                error instanceof Error ? error.message : "Invalid chart data.",
            );
        }
    }
    return issues;
}
