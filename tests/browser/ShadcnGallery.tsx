import { useState } from "react";
import { Chart } from "../../resources/react/core";
import { shadcnCharts } from "../adapters/shadcn/charts";
import "./shadcn.css";

const descriptions: Record<string, string> = {
    line: "Monthly revenue · January–June 2026",
    area: "Revenue over the first half of the year",
    step: "Month-by-month revenue changes",
    smooth: "The same revenue, with a smooth curve",
    bar: "Monthly revenue at a glance",
    horizontal: "Compare revenue across six months",
    stacked: "Revenue and forecast, stacked by month",
    grouped: "Actual revenue alongside the forecast",
    mixed: "Revenue bars with a forecast line",
    pie: "Each month’s share of total revenue",
    donut: "Revenue distribution · January–June 2026",
};

const charts = shadcnCharts().map((chart) => {
    const dataset = chart.datasets.default;
    if (dataset.kind !== "rows") throw new Error("Expected row data.");
    // Keep the small PHP contract fixture; expand the visual demo to six months.
    dataset.rows.push(
        ...[
            { id: "mar", month: "Mar", revenue: 11200 },
            { id: "apr", month: "Apr", revenue: 17900 },
            { id: "may", month: "May", revenue: 15600 },
            { id: "jun", month: "Jun", revenue: 20400 },
        ].map(({ id, ...values }) => ({
            id,
            values,
            display: {},
            bucket: null,
        })),
    );
    dataset.dimensions.push({
        key: "forecast",
        label: "Forecast",
        type: "number",
        nullable: false,
    });
    dataset.rows.forEach((row, index) => {
        row.values.forecast = [11800, 13500, 14100, 15400, 16600, 18200][index];
    });
    chart.series.forEach((series) => {
        if (series.id === "forecast") series.encode.y = ["forecast"];
    });
    chart.formats["axis-number"] = {
        kind: "number",
        decimals: 0,
        compact: true,
    };
    if (chart.axes[1]) chart.axes[1].formatId = "axis-number";
    // Use the application's shadcn theme tokens instead of the PHP default palette.
    chart.appearance.palette = [];
    chart.description = descriptions[chart.name];
    return chart;
});

export function ShadcnGallery() {
    const [theme, setTheme] = useState<"light" | "dark">("light");
    const [filtered, setFiltered] = useState(false);
    const [denied, setDenied] = useState(false);
    const [legend, setLegend] = useState<"top" | "bottom" | "left" | "right">(
        "bottom",
    );
    return (
        <main className={"shadcn-gallery" + (theme === "dark" ? " dark" : "")}>
            <div className="shadcn-content">
                <header className="shadcn-header">
                    <a href="/demo">Chart Builder</a>
                    <nav aria-label="Demos">
                        <a href="/gallery">ECharts gallery</a>
                        <a href="https://ui.shadcn.com/charts">
                            shadcn/ui examples ↗
                        </a>
                    </nav>
                </header>
                <div className="shadcn-intro">
                    <h1>Shadcn chart gallery</h1>
                    <p>
                        Eleven chart styles. One dataset. Explore revenue from
                        January to June, switch themes, or save a chart as an
                        image.
                    </p>
                </div>
                <div className="shadcn-controls" aria-label="Gallery controls">
                    <button
                        aria-pressed={theme === "dark"}
                        onClick={() =>
                            setTheme(theme === "light" ? "dark" : "light")
                        }
                    >
                        Toggle theme
                    </button>
                    <button
                        aria-pressed={filtered}
                        onClick={() => setFiltered(!filtered)}
                    >
                        Toggle February only
                    </button>
                    <button
                        aria-pressed={denied}
                        onClick={() => setDenied(!denied)}
                    >
                        Toggle access
                    </button>
                    <label>
                        Legend position{" "}
                        <select
                            value={legend}
                            onChange={(event) =>
                                setLegend(event.target.value as typeof legend)
                            }
                        >
                            <option value="bottom">Bottom</option>
                            <option value="top">Top</option>
                            <option value="left">Left</option>
                            <option value="right">Right</option>
                        </select>
                    </label>
                    <span>
                        {filtered ? "February 2026" : "January–June 2026"}
                    </span>
                </div>
                <div className="shadcn-grid">
                    {charts.map((base) => {
                        const chart = structuredClone(base);
                        chart.appearance.theme = theme;
                        chart.appearance.legend.position = legend;
                        chart.meta.snapshotId = String(filtered);
                        if (filtered)
                            chart.series.forEach((series) => {
                                series.itemIds = ["feb"];
                            });
                        return (
                            <Chart
                                key={chart.name}
                                name={chart.name}
                                propName={chart.name + "Chart"}
                                result={{
                                    schemaVersion: 1,
                                    name: chart.name,
                                    contextKey: "shadcn-gallery",
                                    requestId: null,
                                    ...(denied
                                        ? {
                                              status: "denied",
                                              reason: "forbidden",
                                          }
                                        : { status: "ready", chart }),
                                }}
                            />
                        );
                    })}
                </div>
            </div>
        </main>
    );
}
