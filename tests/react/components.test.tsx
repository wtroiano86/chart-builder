import { useEffect } from "react";
import { renderToString } from "react-dom/server";
import {
    act,
    fireEvent,
    render,
    screen,
    waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
    assertChartResult,
    type ChartAdapterProps,
    type ChartResult,
} from "@wtroiano/chart-builder-sdk";
import fixture from "./fixtures/revenue.json";
import { fixtureManifest } from "../adapters/fixture/src";
import { ChartCanvas } from "../../resources/react/core/ChartCanvas";
import { Chart } from "../../resources/react/core/Chart";
import { ChartFilters } from "../../resources/react/core/Filters";
import { ChartCoordinator } from "../../resources/react/core/coordinator";
import { registerChartAdapter } from "../../resources/react/core/registry";
import { compileChart } from "../../resources/react/adapters/echarts/compiler";
import { galleryCharts } from "../browser/gallery";

vi.mock("@inertiajs/react", () => ({ router: { visit: vi.fn() } }));
const mounts = vi.fn(),
    disposals = vi.fn();
function Renderer({ chart, onReady, onEvent }: ChartAdapterProps) {
    useEffect(() => {
        mounts();
        onReady({ resize: () => {} });
        return () => {
            disposals();
            onReady(null);
        };
    }, []);
    return (
        <button
            onClick={() =>
                onEvent({
                    type: "point-activate",
                    chartName: chart.name,
                    snapshotId: chart.meta.snapshotId,
                    origin: "user",
                    seriesId: chart.series[0].id,
                    datum: { datasetId: "default", kind: "row", id: "jan" },
                })
            }
        >
            Renderer {chart.meta.snapshotId}
        </button>
    );
}
const loader = vi.fn(async () => ({ Component: Renderer }));
registerChartAdapter("lifecycle", {
    name: "lifecycle",
    apiVersion: 1,
    manifest: { ...fixtureManifest, name: "lifecycle" },
    validate: () => [],
    load: loader,
});
const ready = () => {
    assertChartResult(fixture);
    if (fixture.status !== "ready") throw new Error("fixture");
    const result = structuredClone(fixture);
    result.chart.adapter.name = "lifecycle";
    return result;
};

describe("React integration", () => {
    it("renders SSR placeholders and accessible data without importing the rendering engine", () => {
        const result = ready();
        const html = renderToString(
            <Chart
                name="revenue"
                result={result}
                propName="revenueChart"
                coordinator={new ChartCoordinator("/", () => {})}
            />,
        );
        expect(html).toContain("Loading chart");
        expect(html).toContain("View chart data");
        expect(html).toContain("12500");
        expect(loader).not.toHaveBeenCalled();
    });

    it("retains the mounted adapter across snapshots and cleans up on unmount", async () => {
        const width = vi
            .spyOn(HTMLElement.prototype, "getBoundingClientRect")
            .mockReturnValue({ width: 640, height: 320 } as DOMRect);
        const result = ready(),
            events = vi.fn();
        const baseline = mounts.mock.calls.length,
            disposed = disposals.mock.calls.length;
        const view = render(
            <ChartCanvas chart={result.chart} onEvent={events} />,
        );
        await screen.findByRole("button", {
            name: "Renderer snapshot-fixture",
        });
        const next = structuredClone(result.chart);
        next.meta.snapshotId = "second";
        view.rerender(<ChartCanvas chart={next} onEvent={events} />);
        fireEvent.click(
            await screen.findByRole("button", { name: "Renderer second" }),
        );
        expect(events.mock.calls[0][0].snapshotId).toBe("second");
        expect(mounts.mock.calls.length - baseline).toBe(1);
        view.unmount();
        expect(disposals.mock.calls.length - disposed).toBe(1);
        width.mockRestore();
    });

    it("retains same-scope retryable data and clears it for denial, a new scope or a different chart", async () => {
        const result = ready();
        const coordinator = new ChartCoordinator("/", () => {});
        const view = render(
            <Chart
                name="revenue"
                result={result}
                propName="chart"
                coordinator={coordinator}
            />,
        );
        const failure: ChartResult = {
            schemaVersion: 1,
            name: "revenue",
            contextKey: result.contextKey,
            requestId: null,
            status: "error",
            error: {
                code: "transport",
                message: "Offline",
                retryable: true,
                referenceId: null,
            },
        };
        view.rerender(
            <Chart
                name="revenue"
                result={failure}
                propName="chart"
                coordinator={coordinator}
            />,
        );
        expect(
            await screen.findByText(/Showing previous data/),
        ).toBeInTheDocument();
        expect(screen.getByText("12500")).toBeInTheDocument();
        view.rerender(
            <Chart
                name="revenue"
                result={{ ...failure, contextKey: "new-tenant" }}
                propName="chart"
                coordinator={coordinator}
            />,
        );
        await waitFor(() =>
            expect(screen.queryByText("12500")).not.toBeInTheDocument(),
        );
        view.rerender(
            <Chart
                name="revenue"
                result={result}
                propName="chart"
                coordinator={coordinator}
            />,
        );
        await screen.findByText("12500");
        view.rerender(
            <Chart
                name="revenue"
                result={{
                    schemaVersion: 1,
                    name: "revenue",
                    contextKey: result.contextKey,
                    requestId: "old",
                    status: "denied",
                    reason: "forbidden",
                }}
                propName="chart"
                coordinator={coordinator}
            />,
        );
        expect(screen.queryByText("12500")).not.toBeInTheDocument();
        expect(screen.queryByText("Download CSV")).not.toBeInTheDocument();
        view.rerender(
            <Chart name="other" propName="chart" coordinator={coordinator} />,
        );
        await waitFor(() =>
            expect(screen.getByLabelText("Loading chart")).toBeInTheDocument(),
        );
    });

    it("shows reporting-timezone dates and sends an inclusive end date", async () => {
        const apply = vi.fn();
        const definitions = [
            {
                kind: "date-range" as const,
                key: "range",
                label: "Range",
                fromKey: "from",
                untilKey: "until",
                clearable: false,
            },
        ];
        const view = render(
            <ChartFilters
                name="Sales"
                timezone="Asia/Tokyo"
                definitions={definitions}
                state={{
                    from: "2026-01-01T15:00:00Z",
                    until: "2026-01-31T15:00:00Z",
                }}
                pending={false}
                onApply={apply}
                onReset={() => {}}
            />,
        );
        await waitFor(() =>
            expect(view.container.querySelectorAll("input")[0]).toHaveValue(
                "2026-01-02",
            ),
        );
        expect(view.container.querySelectorAll("input")[1]).toHaveValue(
            "2026-01-31",
        );
        fireEvent.click(screen.getByRole("button", { name: "Apply" }));
        expect(apply).toHaveBeenCalledWith({
            from: "2026-01-02",
            until: "2026-01-31",
        });
    });
});

it("keeps reset intent when a newer edit arrives before the previous request finishes", async () => {
    const requests: import("../../resources/react/core/coordinator").ChartRequest[] =
        [];
    const coordinator = new ChartCoordinator(
        "/?charts[a][old]=keep&tables[page]=3",
        (request) => {
            requests.push(request);
        },
    );
    coordinator.update("a", "a", { first: "one" });
    await act(() => Promise.resolve());
    coordinator.update("a", "a", null);
    coordinator.update("a", "a", { next: "two" });
    requests[0].success(requests[0].url);
    requests[0].finish();
    await act(() => Promise.resolve());
    const query = new URL(requests[1].url, "http://localhost").searchParams;
    expect(query.get("charts[a][old]")).toBeNull();
    expect(query.get("charts[a][first]")).toBeNull();
    expect(query.get("charts[a][next]")).toBe("two");
    expect(query.get("tables[page]")).toBe("3");
});

it("compiles each gallery dataset and applies shared formats without overriding managed data", () => {
    const context = {
        width: 640,
        height: 320,
        theme: "light" as const,
        palette: ["red"],
        tokens: { text: "black", border: "gray", grid: "gray" },
        locale: "en-US",
        timezone: "UTC",
        reducedMotion: false,
        resolveExtension: () => () => ({
            type: "circle",
            shape: { cx: 1, cy: 1, r: 1 },
        }),
    };
    for (const chart of galleryCharts()) {
        const compiled = compileChart(chart, context);
        const series = compiled.option.series as Array<{ data: unknown[] }>;
        expect(series.length, chart.name).toBeGreaterThan(0);
        expect(
            series.every((item) => item.data.length > 0),
            chart.name,
        ).toBe(true);
    }
    const result = ready();
    result.chart.series[0].adapterOptions.echarts = { tooltip: { show: true } };
    const compiled = compileChart(result.chart, context);
    const series = compiled.option.series as Array<{
        tooltip: { valueFormatter: (value: number) => string };
    }>;
    expect(series[0].tooltip.valueFormatter(1234.5)).toBe("$1,234.50");
});
