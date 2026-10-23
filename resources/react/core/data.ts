import {
    csvCell,
    type ChartPayload,
    type DatasetPayload,
    type DatumRef,
    type Scalar,
} from "@wtroiano/chart-builder-sdk";

export interface DataRow {
    datum: DatumRef;
    values: Scalar[];
}
export interface DataTable {
    id: string;
    headers: string[];
    rows: DataRow[];
}

export function dataTables(chart: ChartPayload): DataTable[] {
    return Object.entries(chart.datasets).flatMap(([id, dataset]) =>
        table(id, dataset),
    );
}
function table(id: string, dataset: DatasetPayload): DataTable[] {
    if (dataset.kind === "rows" || dataset.kind === "series") {
        const data = dataset.kind === "series" ? dataset.projection : dataset;
        return [
            {
                id,
                headers: data.dimensions.map((value) => value.label),
                rows: data.rows.map((row) => ({
                    datum: {
                        datasetId: id,
                        kind: dataset.kind === "series" ? "item" : "row",
                        id: row.id,
                    },
                    values: data.dimensions.map(
                        (dimension) =>
                            row.display[dimension.key] ??
                            row.values[dimension.key],
                    ),
                })),
            },
        ];
    }
    if (dataset.kind === "graph") {
        return [
            {
                id: id + ":nodes",
                headers: ["ID", "Label", "Value"],
                rows: dataset.nodes.map((node) => ({
                    datum: { datasetId: id, kind: "node", id: node.id },
                    values: [node.id, node.label, node.value],
                })),
            },
            {
                id: id + ":links",
                headers: ["ID", "Source", "Target", "Value"],
                rows: dataset.links.map((link) => ({
                    datum: { datasetId: id, kind: "link", id: link.id },
                    values: [link.id, link.source, link.target, link.value],
                })),
            },
        ];
    }
    const rows: DataRow[] = [];
    const walk = (nodes: typeof dataset.roots, parent: string | null) => {
        for (const node of nodes) {
            rows.push({
                datum: { datasetId: id, kind: "node", id: node.id },
                values: [node.id, parent, node.label, node.value],
            });
            walk(node.children, node.id);
        }
    };
    walk(dataset.roots, null);
    return [{ id, headers: ["ID", "Parent", "Label", "Value"], rows }];
}
export function chartCsv(chart: ChartPayload): string {
    return dataTables(chart)
        .map((table) =>
            [[table.id], table.headers, ...table.rows.map((row) => row.values)]
                .map((row) => row.map(csvCell).join(","))
                .join("\r\n"),
        )
        .join("\r\n\r\n");
}
export function download(blob: Blob, name: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}
