import type {
    ChartPayload,
    ChartResult,
    CoordinateDefinition,
    DatasetPayload,
    DimensionType,
    RowsDataset,
    Scalar,
    SeriesDefinition,
} from "@wtroiano/chart-builder-sdk";
import fixture from "../react/fixtures/revenue.json";

export function rows(
    values: Array<Record<string, Scalar>>,
    kinds: Record<string, DimensionType> = {},
): RowsDataset {
    return {
        kind: "rows",
        identity: "stable",
        dimensions: Object.entries(values[0] ?? {}).map(([key, value]) => ({
            key,
            label: key,
            type:
                kinds[key] ?? (typeof value === "number" ? "number" : "string"),
            nullable: true,
        })),
        rows: values.map((values, index) => ({
            id: "row-" + index,
            values,
            display: {},
            bucket: null,
        })),
    };
}
function chart(
    name: string,
    type: string,
    dataset: DatasetPayload,
    encode: Record<string, string[]>,
    coordinate?: CoordinateDefinition,
): ChartPayload {
    const result = structuredClone(fixture) as ChartResult;
    if (result.status !== "ready") throw new Error("Ready fixture required.");
    const value = result.chart;
    value.name = name;
    value.title = name;
    value.description = type + " · ECharts";
    value.datasets = { default: dataset };
    value.formats = {};
    value.filters = [];
    value.state = {};
    value.requirements = [];
    value.axes = [];
    value.coordinates = coordinate ? [coordinate] : [];
    value.appearance = {
        ...value.appearance,
        height: 320,
        renderingMode: "svg",
        animation: false,
    };
    value.series = [
        {
            ...value.series[0],
            id: "main",
            label: name,
            type,
            coordinateId: coordinate?.id ?? null,
            axes: {},
            encode,
            formatId: null,
            adapterOptions: {},
        },
    ];
    value.meta.snapshotId = name;
    value.meta.queryNamespace = "charts[" + name + "]";
    if (coordinate?.kind === "cartesian" || coordinate?.kind === "polar") {
        const polar = coordinate.kind === "polar";
        value.axes = [
            {
                id: "x",
                coordinateId: coordinate.id,
                kind:
                    dataset.kind === "rows" &&
                    dataset.dimensions.find(
                        (item) => item.key === encode.x?.[0],
                    )?.type === "number"
                        ? "value"
                        : "category",
                position: polar ? "angle" : "bottom",
                title: null,
                domain: { min: null, max: null, categories: null },
                logBase: null,
                formatId: null,
            },
            {
                id: "y",
                coordinateId: coordinate.id,
                kind: type === "heatmap" ? "category" : "value",
                position: polar ? "radius" : "left",
                title: null,
                domain: { min: null, max: null, categories: null },
                logBase: null,
                formatId: null,
            },
        ];
        value.series[0].axes = { x: "x", y: "y" };
    }
    return value;
}
const grid: CoordinateDefinition = {
    id: "main",
    kind: "cartesian",
    bounds: [0, 0, 1, 1],
};
const geo: CoordinateDefinition = {
    id: "main",
    kind: "geo",
    asset: "example-map",
    projection: null,
};
export function galleryCharts(): ChartPayload[] {
    const charts: ChartPayload[] = [];
    const basic = rows([
        { x: "Jan", y: 12 },
        { x: "Feb", y: 18 },
        { x: "Mar", y: 9 },
    ]);
    for (const type of ["line", "bar", "pictorialBar"])
        charts.push(chart(type, type, basic, { x: ["x"], y: ["y"] }, grid));
    for (const [name, change] of Object.entries({
        area: { area: true },
        step: { step: "end" as const },
        horizontal: { orientation: "horizontal" as const },
    })) {
        const item = chart(
            name,
            name === "horizontal" ? "bar" : "line",
            basic,
            { x: ["x"], y: ["y"] },
            grid,
        );
        Object.assign(item.series[0].presentation, change);
        charts.push(item);
    }
    for (const type of ["scatter", "effectScatter"])
        charts.push(
            chart(
                type,
                type,
                rows([
                    { x: 1, y: 4 },
                    { x: 2, y: 9 },
                    { x: 3, y: 6 },
                ]),
                { x: ["x"], y: ["y"] },
                grid,
            ),
        );
    const bubble = chart(
        "bubble",
        "scatter",
        rows([
            { x: 1, y: 4, size: 10 },
            { x: 2, y: 9, size: 24 },
        ]),
        { x: ["x"], y: ["y"], size: ["size"] },
        grid,
    );
    charts.push(bubble);
    const proportion = rows([
        { label: "West", value: 42 },
        { label: "East", value: 58 },
    ]);
    for (const type of ["pie", "funnel", "gauge"])
        charts.push(
            chart(type, type, proportion, {
                label: ["label"],
                value: ["value"],
            }),
        );
    for (const name of ["donut", "rose"]) {
        const item = chart(name, "pie", proportion, {
            label: ["label"],
            value: ["value"],
        });
        if (name === "donut") item.series[0].presentation.radius = [0.5, 0.8];
        else
            item.series[0].adapterOptions = { echarts: { roseType: "radius" } };
        charts.push(item);
    }
    charts.push(
        chart(
            "radar",
            "radar",
            rows([{ a: 4, b: 7, c: 6 }]),
            { indicators: ["a", "b", "c"] },
            {
                id: "main",
                kind: "radar",
                indicators: ["a", "b", "c"].map((id) => ({
                    id,
                    label: id,
                    min: 0,
                    max: 10,
                })),
            },
        ),
    );
    charts.push(
        chart(
            "heatmap",
            "heatmap",
            rows([
                { x: "A", y: "One", value: 2 },
                { x: "B", y: "One", value: 8 },
                { x: "A", y: "Two", value: 5 },
            ]),
            { x: ["x"], y: ["y"], value: ["value"] },
            grid,
        ),
    );
    charts.push(
        chart(
            "boxplot",
            "boxplot",
            rows([
                { x: "A", min: 2, q1: 4, median: 5, q3: 7, max: 9 },
                { x: "B", min: 1, q1: 3, median: 4, q3: 6, max: 8 },
            ]),
            Object.fromEntries(
                ["x", "min", "q1", "median", "q3", "max"].map((key) => [
                    key,
                    [key],
                ]),
            ),
            grid,
        ),
    );
    charts.push(
        chart(
            "candlestick",
            "candlestick",
            rows([
                { x: "Mon", open: 4, close: 7, low: 2, high: 9 },
                { x: "Tue", open: 7, close: 5, low: 4, high: 8 },
            ]),
            Object.fromEntries(
                ["x", "open", "close", "low", "high"].map((key) => [
                    key,
                    [key],
                ]),
            ),
            grid,
        ),
    );
    const parallel = chart(
        "parallel",
        "parallel",
        rows([
            { a: 1, b: 7, c: 3 },
            { a: 4, b: 2, c: 9 },
        ]),
        { dimensions: ["a", "b", "c"] },
        { id: "main", kind: "parallel" },
    );
    parallel.axes = ["a", "b", "c"].map((id) => ({
        id,
        coordinateId: "main",
        kind: "value",
        position: "parallel",
        title: id,
        domain: { min: 0, max: 10, categories: null },
        logBase: null,
        formatId: null,
    }));
    charts.push(parallel);
    for (const type of ["tree", "treemap", "sunburst"])
        charts.push(
            chart(
                type,
                type,
                {
                    kind: "hierarchy",
                    roots: [
                        {
                            id: "company",
                            label: "Company",
                            value: null,
                            children: [
                                {
                                    id: "west",
                                    label: "West",
                                    value: 4,
                                    children: [],
                                },
                                {
                                    id: "east",
                                    label: "East",
                                    value: 6,
                                    children: [],
                                },
                            ],
                        },
                    ],
                },
                {},
            ),
        );
    for (const type of ["graph", "sankey", "chord"])
        charts.push(
            chart(
                type,
                type,
                {
                    kind: "graph",
                    directed: true,
                    nodes: [
                        { id: "west", label: "West", value: 4, attributes: {} },
                        { id: "east", label: "East", value: 6, attributes: {} },
                    ],
                    links: [
                        {
                            id: "trade",
                            source: "west",
                            target: "east",
                            label: "Trade",
                            value: 3,
                        },
                    ],
                },
                {},
            ),
        );
    charts.push(
        chart(
            "map",
            "map",
            proportion,
            { label: ["label"], value: ["value"] },
            geo,
        ),
    );
    charts.push(
        chart(
            "geographic-scatter",
            "scatter",
            rows([
                { x: 0.5, y: 0.5 },
                { x: 1.5, y: 0.5 },
            ]),
            { x: ["x"], y: ["y"] },
            geo,
        ),
    );
    const projection = rows([{ label: "West to East", value: 3 }]);
    charts.push(
        chart(
            "geographic-lines",
            "lines",
            {
                kind: "series",
                requiredAdapter: null,
                items: [
                    {
                        id: "row-0",
                        value: [
                            [0.5, 0.5],
                            [1.5, 0.5],
                        ],
                    },
                ],
                projection,
            },
            {},
            geo,
        ),
    );
    charts.push(
        chart(
            "polar",
            "line",
            basic,
            { x: ["x"], y: ["y"] },
            { id: "main", kind: "polar", center: [0.5, 0.45], radius: 0.7 },
        ),
    );
    charts.push(
        chart(
            "calendar",
            "heatmap",
            rows([
                { x: "2026-10-01", y: "day", value: 2 },
                { x: "2026-10-02", y: "day", value: 8 },
            ]),
            { x: ["x"], y: ["y"], value: ["value"] },
            {
                id: "main",
                kind: "calendar",
                from: "2026-10-01",
                until: "2026-11-01",
                weekStartsOn: 1,
            },
        ),
    );
    charts.push(
        chart(
            "matrix",
            "heatmap",
            rows([
                { x: "A", y: "One", value: 2 },
                { x: "B", y: "Two", value: 8 },
            ]),
            { x: ["x"], y: ["y"], value: ["value"] },
            {
                id: "main",
                kind: "matrix",
                rows: ["One", "Two"],
                columns: ["A", "B"],
            },
        ),
    );
    charts.push(
        chart(
            "theme-river",
            "themeRiver",
            rows(
                [
                    { time: "2026-10-01", value: 4, category: "A" },
                    { time: "2026-10-02", value: 7, category: "A" },
                    { time: "2026-10-01", value: 3, category: "B" },
                    { time: "2026-10-02", value: 5, category: "B" },
                ],
                { time: "date" },
            ),
            { time: ["time"], value: ["value"], category: ["category"] },
        ),
    );
    for (const name of ["mixed", "stacked", "grouped"]) {
        const item = chart(name, "bar", basic, { x: ["x"], y: ["y"] }, grid);
        const second: SeriesDefinition = {
            ...structuredClone(item.series[0]),
            id: "second",
            label: "Second",
            type: name === "mixed" ? "line" : "bar",
        };
        if (name === "stacked") {
            item.series[0].presentation.stack = "total";
            second.presentation.stack = "total";
        }
        item.series.push(second);
        charts.push(item);
    }
    const custom = chart(
        "custom",
        "custom",
        rows([
            { x: 1, y: 3 },
            { x: 2, y: 7 },
        ]),
        { x: ["x"], y: ["y"] },
        grid,
    );
    custom.series[0].rendererName = "example-bar";
    custom.extensions = [
        {
            kind: "renderer",
            name: "example-bar",
            params: {},
            requiredAdapter: "echarts",
        },
    ];
    charts.push(custom);
    return charts;
}
