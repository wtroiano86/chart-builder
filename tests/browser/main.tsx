import { createInertiaApp, Link } from "@inertiajs/react";
import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import {
    Chart,
    registerChartAdapter,
    registerChartExtension,
} from "../../resources/react";
import { fixtureAdapter } from "@wtroiano/chart-builder-fixture";
import type { ChartResult } from "@wtroiano/chart-builder-sdk";
import { Gallery } from "./Gallery";
import { Demo } from "../../examples/react/Demo";

registerChartAdapter("fixture", fixtureAdapter);
registerChartExtension(
    "renderer",
    "example-bar",
    (
        _: unknown,
        api: {
            value: (index: number) => number;
            coord: (value: number[]) => number[];
        },
    ) => {
        const point = api.coord([api.value(0), api.value(1)]);
        return {
            type: "circle",
            shape: { cx: point[0], cy: point[1], r: 8 },
            style: { fill: "#2563eb" },
        };
    },
);
registerChartExtension("geography", "example-map", {
    type: "FeatureCollection",
    features: [
        {
            type: "Feature",
            properties: { name: "West" },
            geometry: {
                type: "Polygon",
                coordinates: [
                    [
                        [0, 0],
                        [1, 0],
                        [1, 1],
                        [0, 1],
                        [0, 0],
                    ],
                ],
            },
        },
        {
            type: "Feature",
            properties: { name: "East" },
            geometry: {
                type: "Polygon",
                coordinates: [
                    [
                        [1, 0],
                        [2, 0],
                        [2, 1],
                        [1, 1],
                        [1, 0],
                    ],
                ],
            },
        },
    ],
});

function Dashboard({
    revenueChart,
    ordersChart,
}: {
    revenueChart?: ChartResult;
    ordersChart?: ChartResult;
}) {
    return (
        <main
            style={{ maxWidth: 1100, margin: "32px auto", padding: "0 16px" }}
        >
            <h1>Chart Builder</h1>
            <p>PHP definitions. Shared data. Pluggable renderers.</p>
            <nav style={{ display: "flex", gap: 16, marginBottom: 24 }}>
                <Link href="/demo">Live PHP demo</Link>
                <Link href="/gallery">Chart gallery</Link>
                <Link href="/charts?orders[page]=2" preserveState>
                    Table page 2
                </Link>
            </nav>
            <div style={{ display: "grid", gap: 24 }}>
                <Chart
                    name="revenue"
                    result={revenueChart}
                    propName="revenueChart"
                />
                <Chart
                    name="orders"
                    result={ordersChart}
                    propName="ordersChart"
                />
            </div>
        </main>
    );
}
void createInertiaApp({
    page: JSON.parse(
        document.getElementById("app")?.getAttribute("data-page") ?? "{}",
    ),
    resolve: (name) =>
        name === "Demo" ? Demo : name === "Gallery" ? Gallery : Dashboard,
    setup({ el, App, props }) {
        createRoot(el).render(
            <StrictMode>
                <App {...props} />
            </StrictMode>,
        );
    },
});
