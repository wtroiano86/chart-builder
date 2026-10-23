import { ChartCanvas } from "../../resources/react";
import { galleryCharts } from "./gallery";
import { Link } from "@inertiajs/react";
const charts = galleryCharts();
export function Gallery() {
    return (
        <main style={{ padding: 24, maxWidth: 1200, margin: "auto" }}>
            <h1>Chart gallery</h1>
            <Link href="/demo">Live PHP demo</Link>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns:
                        "repeat(auto-fit, minmax(min(100%, 420px), 1fr))",
                    gap: 20,
                    marginTop: 24,
                }}
            >
                {charts.map((chart) => (
                    <section
                        key={chart.name}
                        data-chart={chart.name}
                        className="cb-chart"
                    >
                        <h2>{chart.title}</h2>
                        <ChartCanvas chart={chart} />
                    </section>
                ))}
            </div>
        </main>
    );
}
