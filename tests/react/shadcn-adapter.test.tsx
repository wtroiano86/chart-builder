import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
    assertChartPayload,
    assertAdapterManifest,
    type ChartAdapterProps,
    type ChartPayload,
} from "@wtroiano/chart-builder-sdk";
import {
    createShadcnAdapter,
    shadcnManifest,
} from "../../resources/react/adapters/shadcn";
import { createShadcnComponent } from "../../resources/react/adapters/shadcn/rendering";
import {
    cartesianPoints,
    paletteSlots,
} from "../../resources/react/adapters/shadcn/model";
import { ChartCanvas, registerChartAdapter } from "../../resources/react/core";
import * as components from "../adapters/shadcn/chart";
import { shadcnCharts } from "../adapters/shadcn/charts";

const load = vi.fn(async () => components);
const adapter = createShadcnAdapter(load);
const Component = createShadcnComponent(components);
registerChartAdapter("shadcn", adapter);
function props(chart = shadcnCharts()[0]): ChartAdapterProps {
    return {
        chart,
        context: {
            width: 640,
            height: 320,
            theme: "light",
            palette: ["#123456", "#654321"],
            tokens: { text: "black", grid: "gray" },
            locale: "en-US",
            timezone: "UTC",
            reducedMotion: true,
        },
        onReady: vi.fn(),
        onError: vi.fn(),
        onEvent: vi.fn(),
    };
}
beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
        function (this: HTMLElement) {
            const height = this.classList.contains(
                "recharts-responsive-container",
            )
                ? 320
                : 20;
            return {
                width: 640,
                height,
                top: 0,
                left: 0,
                bottom: height,
                right: 640,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            };
        },
    );
    vi.stubGlobal(
        "ResizeObserver",
        class {
            observe() {}
            unobserve() {}
            disconnect() {}
        },
    );
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

it("validates the manifest and every supported family without loading components during SSR", () => {
    assertAdapterManifest(shadcnManifest);
    for (const chart of shadcnCharts()) {
        assertChartPayload(chart);
        expect(adapter.validate(chart)).toEqual([]);
    }
    expect(renderToString(<ChartCanvas chart={shadcnCharts()[0]} />)).toContain(
        "Loading chart",
    );
    expect(load).not.toHaveBeenCalled();
});

it("lazily loads a component using the application's actual shadcn signatures", async () => {
    const module = await adapter.load();
    expect(load).toHaveBeenCalledTimes(1);
    expect(typeof module.Component).toBe("function");
});

it("keeps stable row identities through filtering, updates, keyboard activation and StrictMode cleanup", async () => {
    const input = props();
    const view = render(
        <StrictMode>
            <Component {...input} />
        </StrictMode>,
    );
    await waitFor(() => expect(view.getAllByRole("button")).toHaveLength(2));
    expect(
        view.container.querySelector(".recharts-line-curve")?.getAttribute("d"),
    ).toMatch(/^M/);
    fireEvent.keyDown(view.getAllByRole("button")[1], { key: "Enter" });
    expect(input.onEvent).toHaveBeenLastCalledWith({
        type: "point-activate",
        chartName: "line",
        snapshotId: "snapshot-fixture",
        origin: "user",
        seriesId: "revenue",
        datum: { kind: "row", datasetId: "default", id: "feb" },
    });
    const next = structuredClone(input.chart);
    next.series[0].itemIds = ["feb"];
    next.meta.snapshotId = "updated";
    view.rerender(
        <StrictMode>
            <Component {...input} chart={next} />
        </StrictMode>,
    );
    await waitFor(() => expect(view.getAllByRole("button")).toHaveLength(1));
    fireEvent.click(view.getByRole("button"));
    expect(input.onEvent).toHaveBeenLastCalledWith(
        expect.objectContaining({
            snapshotId: "updated",
            datum: expect.objectContaining({ id: "feb" }),
        }),
    );
    expect(input.onEvent).toHaveBeenCalledTimes(2);
    const handle = vi.mocked(input.onReady).mock.calls.at(-1)?.[0];
    act(() => handle?.resize({ width: 400, height: 200 }));
    expect(view.container.querySelector(".cb-shadcn")).toHaveStyle({
        width: "400px",
        height: "200px",
    });
    view.unmount();
    expect(input.onReady).toHaveBeenLastCalledWith(null);
    await expect(
        handle!.exportImage!({ format: "svg", scale: 1, background: null }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(input.onError).not.toHaveBeenCalled();
});

it("joins split series by category without dropping zeros, nulls, missing categories or duplicate labels", () => {
    const chart = shadcnCharts()[0];
    const dataset = chart.datasets.default;
    if (dataset.kind !== "rows") throw new Error("rows");
    dataset.rows[0].values.revenue = 0;
    dataset.rows[1].values.revenue = null;
    chart.axes[0].domain.categories = ["Feb", "Jan", "Mar"];
    const second = {
        ...structuredClone(chart.series[0]),
        id: "other",
        itemIds: ["feb"],
    };
    chart.series[0].itemIds = ["jan"];
    chart.series.push(second);
    const points = cartesianPoints(chart);
    expect(points.map((point) => point.label)).toEqual(["Feb", "Jan", "Mar"]);
    expect(points[1].s0).toBe(0);
    expect(points[0].s0).toBeUndefined();
    expect(points[0].s1).toBeNull();
    expect(points[0].rows.s1.id).toBe("feb");
    chart.axes[0].domain.categories = null;
    chart.series = [chart.series[0]];
    chart.series[0].itemIds = null;
    dataset.rows[1].values.month = "Jan";
    dataset.rows[0].categoryKeys = { month: "customer-1" };
    dataset.rows[1].categoryKeys = { month: "customer-2" };
    expect(cartesianPoints(chart).map((point) => point.x)).toEqual([
        JSON.stringify(["key", "customer-1"]),
        JSON.stringify(["key", "customer-2"]),
    ]);
});

it.each<[string, (chart: ChartPayload) => void]>([
    [
        "family",
        (chart) => {
            chart.series[0].type = "radar";
        },
    ],
    [
        "canvas",
        (chart) => {
            chart.appearance.renderingMode = "canvas";
        },
    ],
    [
        "options",
        (chart) => {
            chart.adapterOptions.shadcn = { dataKey: "wrong" };
        },
    ],
    [
        "series options",
        (chart) => {
            chart.series[0].adapterOptions.shadcn = { dataKey: "wrong" };
        },
    ],
    [
        "multiple axes",
        (chart) => {
            chart.axes.push({ ...chart.axes[1], id: "other" });
        },
    ],
    [
        "partial grid",
        (chart) => {
            chart.coordinates = [
                { id: "main", kind: "cartesian", bounds: [0, 0, 0.5, 1] },
            ];
        },
    ],
    [
        "mixed orientation",
        (chart) => {
            chart.series.push({
                ...structuredClone(chart.series[0]),
                id: "other",
                presentation: {
                    ...chart.series[0].presentation,
                    orientation: "horizontal",
                },
            });
        },
    ],
    [
        "stacked line",
        (chart) => {
            chart.series[0].presentation.stack = "total";
        },
    ],
    [
        "duplicate x",
        (chart) => {
            const dataset = chart.datasets.default;
            if (dataset.kind === "rows") dataset.rows[1].values.month = "Jan";
        },
    ],
    [
        "invalid time",
        (chart) => {
            chart.axes[0].kind = "time";
        },
    ],
])("rejects unsupported %s before rendering", (_, change) => {
    const chart = shadcnCharts()[0];
    change(chart);
    expect(adapter.validate(chart).length).toBeGreaterThan(0);
});

it.each(["bar", "horizontal", "pie", "donut"])(
    "activates the original selected row in %s charts",
    async (name) => {
        const input = props(
            shadcnCharts().find((chart) => chart.name === name)!,
        );
        input.chart.series[0].itemIds = ["feb"];
        const view = render(<Component {...input} />);
        await waitFor(() =>
            expect(
                view.container.querySelector(
                    "path.recharts-rectangle, path.recharts-sector",
                ),
            ).not.toBeNull(),
        );
        fireEvent.click(
            view.container.querySelector(
                "path.recharts-rectangle, path.recharts-sector",
            )!,
        );
        expect(input.onEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                chartName: name,
                seriesId: "revenue",
                origin: "user",
                datum: { kind: "row", datasetId: "default", id: "feb" },
            }),
        );
    },
);

it("formats time axes and registered custom values without coercing nulls", async () => {
    const input = props();
    const dataset = input.chart.datasets.default;
    if (dataset.kind !== "rows") throw new Error("rows");
    dataset.rows[0].values.month = "2026-01-01";
    dataset.rows[1].values.month = "2026-02-01";
    dataset.rows[1].values.revenue = null;
    dataset.dimensions[0].type = "date";
    input.chart.axes[0].kind = "time";
    input.chart.axes[0].formatId = "date";
    input.chart.formats.date = {
        kind: "date",
        dateStyle: "short",
        timeStyle: null,
    };
    input.chart.formats["revenue-format"] = {
        kind: "custom",
        name: "money",
        params: {},
    };
    input.context.resolveExtension = () => (value: number) => "Amount " + value;
    expect(adapter.validate(input.chart)).toEqual([]);
    expect(cartesianPoints(input.chart)[0].x).toBe(Date.parse("2026-01-01"));
    const view = render(<Component {...input} />);
    await waitFor(() =>
        expect(
            view.getByRole("button", { name: "Revenue: Amount 12500" }),
        ).toBeInTheDocument(),
    );
    expect(view.getAllByRole("button")).toHaveLength(1);
    expect(view.container.textContent).toContain("2/1/26");
});

it("preserves pie colors by row identity when rows are filtered", async () => {
    const input = props(shadcnCharts().find((chart) => chart.name === "pie")!);
    const view = render(<Component {...input} />);
    await waitFor(() =>
        expect(
            view.container.querySelectorAll("path.recharts-sector"),
        ).toHaveLength(2),
    );
    const color = view.container
        .querySelectorAll("path.recharts-sector")[1]
        .getAttribute("fill");
    const next = structuredClone(input.chart);
    next.series[0].itemIds = ["feb"];
    view.rerender(<Component {...input} chart={next} />);
    await waitFor(() =>
        expect(
            view.container.querySelectorAll("path.recharts-sector"),
        ).toHaveLength(1),
    );
    expect(
        view.container.querySelector("path.recharts-sector"),
    ).toHaveAttribute("fill", color);
});

it("resolves palette collisions while retaining existing identities and bounding retained state", () => {
    const initial = paletteSlots(["revenue", "forecast"], 5, new Map());
    expect(initial.get("revenue")).not.toBe(initial.get("forecast"));
    expect(paletteSlots(["forecast", "revenue"], 5, new Map())).toEqual(
        initial,
    );
    const next = paletteSlots(["forecast", "other"], 5, initial);
    expect(next.get("forecast")).toBe(initial.get("forecast"));
    expect(next.get("other")).not.toBe(next.get("forecast"));
    expect(next.has("revenue")).toBe(false);
    expect(next.size).toBe(2);
    const smaller = paletteSlots(
        ["a", "b"],
        3,
        new Map([
            ["a", 0],
            ["b", 3],
        ]),
    );
    expect(smaller.get("a")).not.toBe(smaller.get("b"));
    const repeated = paletteSlots(["a", "b", "c"], 2, new Map());
    expect([...repeated.values()].every((slot) => slot >= 0 && slot < 2)).toBe(
        true,
    );
});

it("renders distinct grouped series colors and keeps them through series reordering", async () => {
    const input = props(
        shadcnCharts().find((chart) => chart.name === "grouped")!,
    );
    input.context.palette = ["red", "blue", "green", "purple", "orange"];
    const view = render(<Component {...input} />);
    const colors = (chart: ChartPayload) =>
        new Map(
            [...view.container.querySelectorAll(".recharts-bar")].map(
                (group) => {
                    const path = group.querySelector(
                        "path.recharts-rectangle",
                    )!;
                    const key = path.getAttribute("name")!;
                    return [
                        chart.series[Number(key.slice(1))].id,
                        path.getAttribute("fill"),
                    ];
                },
            ),
        );
    await waitFor(() => expect(colors(input.chart).size).toBe(2));
    const original = colors(input.chart);
    expect(original.get("revenue")).toBeTruthy();
    expect(original.get("revenue")).not.toBe(original.get("forecast"));
    const next = structuredClone(input.chart);
    next.series.reverse();
    view.rerender(<Component {...input} chart={next} />);
    await waitFor(() => expect(colors(next)).toEqual(original));
});
