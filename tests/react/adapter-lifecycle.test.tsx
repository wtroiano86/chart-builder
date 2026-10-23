import { render } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type * as ECharts from "echarts";
import {
    assertChartResult,
    type ChartAdapterProps,
    type ChartResult,
} from "@wtroiano/chart-builder-sdk";
import fixture from "./fixtures/revenue.json";
import { createEChartsComponent } from "../../resources/react/adapters/echarts/component";
import {
    ChartCoordinator,
    type ChartRequest,
} from "../../resources/react/core/coordinator";

it("translates calculated engine viewport values and disposes all engine resources", () => {
    assertChartResult(fixture);
    if (fixture.status !== "ready") throw new Error("fixture");
    const listeners = new Map<string, (event: unknown) => void>();
    const engineChart = {
        on: vi.fn((name, handler) => listeners.set(name, handler)),
        setOption: vi.fn(),
        resize: vi.fn(),
        dispose: vi.fn(),
        getOption: () => ({
            dataZoom: [{ id: "zoom:x", startValue: 10, endValue: 20 }],
            legend: [{ selected: { revenue: false } }],
        }),
        getDataURL: vi.fn(),
    };
    const engine = {
        init: vi.fn(() => engineChart),
        registerMap: vi.fn(),
    } as unknown as Pick<typeof ECharts, "init" | "registerMap">;
    const Renderer = createEChartsComponent(engine);
    const events = vi.fn(),
        ready = vi.fn(),
        errors = vi.fn();
    const props: ChartAdapterProps = {
        chart: fixture.chart,
        context: {
            width: 640,
            height: 320,
            theme: "light",
            tokens: { text: "black", grid: "gray", border: "gray" },
            palette: ["red"],
            locale: "en-US",
            timezone: "UTC",
            reducedMotion: false,
        },
        onEvent: events,
        onReady: ready,
        onError: errors,
    };
    const view = render(<Renderer {...props} />);
    listeners.get("datazoom")?.({
        batch: [{ dataZoomId: "zoom:x", start: 10, end: 50 }],
    });
    expect(events).toHaveBeenCalledWith(
        expect.objectContaining({
            type: "viewport-change",
            ranges: [{ axisId: "x", from: 10, to: 20 }],
        }),
    );
    listeners.get("click")?.({ seriesId: "revenue", dataIndex: 0 });
    expect(events).toHaveBeenLastCalledWith(
        expect.objectContaining({
            datum: { datasetId: "default", kind: "row", id: "jan" },
        }),
    );
    const next = structuredClone(props.chart);
    next.meta.snapshotId = "next";
    view.rerender(<Renderer {...props} chart={next} />);
    expect(engine.init).toHaveBeenCalledTimes(1);
    expect(engineChart.setOption).toHaveBeenLastCalledWith(
        expect.objectContaining({
            legend: expect.objectContaining({ selected: { revenue: false } }),
        }),
        expect.anything(),
    );
    expect(errors).not.toHaveBeenCalled();
    view.unmount();
    expect(engineChart.dispose).toHaveBeenCalledTimes(1);
    expect(ready).toHaveBeenLastCalledWith(null);
});

it("attributes an unscoped transport failure only to the active managed request", async () => {
    const requests: ChartRequest[] = [];
    const coordinator = new ChartCoordinator("/", (request) => {
        requests.push(request);
    });
    coordinator.update("a", "aChart", { filter: "first" });
    await Promise.resolve();
    coordinator.update("b", "bChart", { filter: "second" });
    coordinator.transportFailure([], "Network failed");
    expect(coordinator.state("a").error?.message).toBe("Network failed");
    expect(coordinator.state("b").pending).toBe(true);
    expect(coordinator.state("b").error).toBeNull();
    requests[0].finish();
    await Promise.resolve();
    expect(requests[1].props).toEqual(["bChart"]);
});

it("rejects typed row violations and incorrect navigation datum kinds in the public SDK", () => {
    assertChartResult(fixture);
    if (fixture.status !== "ready") throw new Error("fixture");
    const bad: Extract<ChartResult, { status: "ready" }> =
        structuredClone(fixture);
    if (bad.chart.datasets.default.kind !== "rows") throw new Error("fixture");
    bad.chart.datasets.default.rows[0].values.revenue = "123";
    expect(() => assertChartResult(bad)).toThrow("dimension revenue");
    const navigation = structuredClone(fixture);
    navigation.chart.interactions.navigation.push({
        seriesId: "revenue",
        datum: { datasetId: "default", kind: "node", id: "jan" },
        url: "/reports",
        target: "_self",
    });
    expect(() => assertChartResult(navigation)).toThrow(
        "Navigation datum kind",
    );
});
