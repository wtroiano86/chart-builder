import { useEffect } from "react";
import type { ChartAdapterProps } from "@wtroiano/chart-builder-sdk";

export function Component({
    chart,
    context,
    onEvent,
    onReady,
}: ChartAdapterProps) {
    useEffect(() => {
        onReady({ resize: () => {} });
        return () => onReady(null);
    }, []);
    const series = chart.series[0];
    const dataset = chart.datasets[series.datasetId];
    if (dataset.kind !== "rows")
        throw new Error("Fixture supports row datasets.");
    const rows = dataset.rows.filter(
        (row) => series.itemIds === null || series.itemIds.includes(row.id),
    );
    const values = rows.map((row) =>
        Number(row.values[series.encode.y[0]] ?? 0),
    );
    const maximum = Math.max(1, ...values);
    const points = rows.map((row, index) => ({
        row,
        x: 20 + (index * (context.width - 40)) / Math.max(1, rows.length - 1),
        y:
            context.height -
            20 -
            (values[index] / maximum) * (context.height - 40),
    }));
    return (
        <svg
            width={context.width}
            height={context.height}
            aria-label={chart.title ?? chart.name}
        >
            <polyline
                fill="none"
                stroke={context.palette[0]}
                points={points.map(({ x, y }) => x + "," + y).join(" ")}
            />
            {points.map(({ row, x, y }) => (
                <circle
                    key={row.id}
                    cx={x}
                    cy={y}
                    r={5}
                    fill={context.palette[0]}
                    onClick={() =>
                        onEvent({
                            type: "point-activate",
                            chartName: chart.name,
                            snapshotId: chart.meta.snapshotId,
                            origin: "user",
                            seriesId: series.id,
                            datum: {
                                datasetId: series.datasetId,
                                kind: "row",
                                id: row.id,
                            },
                        })
                    }
                />
            ))}
        </svg>
    );
}
