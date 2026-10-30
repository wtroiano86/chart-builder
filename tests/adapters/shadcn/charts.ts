import {
    assertChartResult,
    type ChartPayload,
} from "@wtroiano/chart-builder-sdk";
import fixture from "../../react/fixtures/shadcn.json";

export function shadcnCharts(): ChartPayload[] {
    assertChartResult(fixture);
    if (fixture.status !== "ready") throw new Error("Expected ready fixture.");
    const base: ChartPayload = fixture.chart;
    return [
        "line",
        "area",
        "step",
        "smooth",
        "bar",
        "horizontal",
        "stacked",
        "grouped",
        "mixed",
        "pie",
        "donut",
    ].map((name) => {
        const chart = structuredClone(base);
        chart.name = name;
        chart.title = name;
        chart.meta.queryNamespace = "charts[" + name + "]";
        chart.appearance.animation = false;
        chart.appearance.renderingMode = "svg";
        const series = chart.series[0];
        series.label = "Revenue";
        if (["bar", "horizontal", "stacked", "grouped", "mixed"].includes(name))
            series.type = "bar";
        if (name === "horizontal")
            series.presentation.orientation = "horizontal";
        if (name === "area") series.presentation.area = true;
        if (name === "step") series.presentation.step = "middle";
        if (name === "smooth") series.presentation.smooth = true;
        if (name === "stacked") series.presentation.stack = "total";
        if (["stacked", "grouped", "mixed"].includes(name))
            chart.series.push({
                ...structuredClone(series),
                id: "forecast",
                label: "Forecast",
                type: name === "mixed" ? "line" : "bar",
            });
        if (name === "pie" || name === "donut") {
            series.type = "pie";
            series.coordinateId = null;
            series.axes = {};
            series.encode = { label: ["month"], value: ["revenue"] };
            if (name === "donut") series.presentation.radius = [0.5, 0.8];
            chart.axes = [];
            chart.coordinates = [];
        }
        return chart;
    });
}
