import { Ajv2020 } from "ajv/dist/2020.js";
import { schemas } from "./schemas.js";
import type {
    AdapterManifest,
    CapabilityIssue,
    ChartPayload,
    ChartResult,
    DatasetPayload,
} from "./types.js";

const ajv = new Ajv2020({ strict: false, allErrors: false });
const payloadSchema = ajv.compile<ChartPayload>(schemas["chart-payload"]);
const resultSchema = ajv.compile<ChartResult>(schemas["chart-result"]);
const manifestSchema = ajv.compile<AdapterManifest>(
    schemas["adapter-manifest"],
);

export function assertJson(value: unknown, depth = 0): void {
    if (depth > 128) throw new Error("Chart data is too deeply nested.");
    if (
        value === null ||
        typeof value === "string" ||
        typeof value === "boolean"
    )
        return;
    if (typeof value === "number") {
        if (
            !Number.isFinite(value) ||
            (Number.isInteger(value) && !Number.isSafeInteger(value))
        )
            throw new Error("Chart numbers must be finite and safe.");
        return;
    }
    if (typeof value !== "object")
        throw new Error("Charts require JSON values.");
    if (
        !Array.isArray(value) &&
        Object.getPrototypeOf(value) !== Object.prototype &&
        Object.getPrototypeOf(value) !== null
    )
        throw new Error("Chart objects must be plain JSON.");
    for (const [key, child] of Object.entries(value)) {
        if (["__proto__", "constructor", "prototype"].includes(key))
            throw new Error("Unsafe chart option key.");
        assertJson(child, depth + 1);
    }
}

export function assertChartPayload(
    value: unknown,
): asserts value is ChartPayload {
    assertJson(value);
    if (!payloadSchema(value))
        throw new Error(
            "Invalid chart payload: " + ajv.errorsText(payloadSchema.errors),
        );
    validateReferences(value);
}

export function assertChartResult(
    value: unknown,
): asserts value is ChartResult {
    assertJson(value);
    if (!resultSchema(value))
        throw new Error(
            "Invalid chart result: " + ajv.errorsText(resultSchema.errors),
        );
    if (value.status === "ready") {
        if (
            value.name !== value.chart.name ||
            value.schemaVersion !== value.chart.schemaVersion
        )
            throw new Error("Chart result identity mismatch.");
        validateReferences(value.chart);
    }
}

export function assertAdapterManifest(
    value: unknown,
): asserts value is AdapterManifest {
    assertJson(value);
    if (!manifestSchema(value))
        throw new Error(
            "Invalid adapter manifest: " +
                ajv.errorsText(manifestSchema.errors),
        );
    for (const feature of Object.values(value.features)) {
        const check = (input: unknown): void => {
            if (!input || typeof input !== "object") return;
            for (const [key, child] of Object.entries(input)) {
                if (
                    ["$ref", "$dynamicRef"].includes(key) &&
                    (typeof child !== "string" || !child.startsWith("#"))
                )
                    throw new Error(
                        "Feature schemas cannot reference external resources.",
                    );
                check(child);
            }
        };
        check(feature.optionsSchema);
        ajv.compile(feature.optionsSchema);
    }
    for (const item of value.exports) {
        if (item.modes.some((mode) => !value.renderingModes.includes(mode)))
            throw new Error("Export references an unavailable rendering mode.");
    }
}

function index<T extends { id: string }>(items: T[]): Map<string, T> {
    const result = new Map<string, T>();
    for (const item of items) {
        if (!item.id || result.has(item.id))
            throw new Error("IDs must be nonempty and unique.");
        result.set(item.id, item);
    }
    return result;
}

export function datumIds(dataset: DatasetPayload): Set<string> {
    if (dataset.kind === "rows") {
        const dimensions = new Map(
            dataset.dimensions.map((dimension) => [dimension.key, dimension]),
        );
        if (dimensions.size !== dataset.dimensions.length)
            throw new Error("Duplicate dataset dimensions.");
        for (const row of dataset.rows) {
            if (
                Object.keys(row.values).length !== dimensions.size ||
                Object.keys(row.display).some((key) => !dimensions.has(key))
            )
                throw new Error("Row fields must match dimensions.");
            for (const dimension of dimensions.values()) {
                const value = row.values[dimension.key];
                let valid =
                    value === null
                        ? dimension.nullable
                        : typeof value === dimension.type;
                if (
                    value !== null &&
                    (dimension.type === "date" || dimension.type === "datetime")
                ) {
                    const pattern =
                        dimension.type === "date"
                            ? /^\d{4}-\d{2}-\d{2}$/
                            : /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?Z$/;
                    valid =
                        typeof value === "string" &&
                        pattern.test(value) &&
                        !Number.isNaN(Date.parse(value)) &&
                        new Date(value).toISOString().slice(0, 10) ===
                            value.slice(0, 10);
                }
                if (!valid)
                    throw new Error(
                        "Invalid value for dimension " + dimension.key + ".",
                    );
            }
        }
        return new Set(index(dataset.rows).keys());
    }
    if (dataset.kind === "series") {
        const items = index(dataset.items);
        if (
            JSON.stringify([...items.keys()]) !==
            JSON.stringify([...datumIds(dataset.projection)])
        )
            throw new Error("Custom items require matching projection IDs.");
        return new Set(items.keys());
    }
    if (dataset.kind === "graph") {
        const nodes = index(dataset.nodes);
        const links = index(dataset.links);
        for (const link of links.values())
            if (!nodes.has(link.source) || !nodes.has(link.target))
                throw new Error("Graph endpoint is missing.");
        return new Set([...nodes.keys(), ...links.keys()]);
    }
    const ids = new Set<string>();
    const walk = (nodes: typeof dataset.roots, depth: number): void => {
        for (const node of nodes) {
            if (depth > 32)
                throw new Error("Hierarchy exceeds the depth limit.");
            if (!node.id || ids.has(node.id))
                throw new Error("Hierarchy IDs must be unique.");
            ids.add(node.id);
            walk(node.children, depth + 1);
        }
    };
    walk(dataset.roots, 1);
    return ids;
}

export function safeNavigation(url: string): boolean {
    return (
        !/[\u0000-\u0020\\]/.test(url) &&
        (/^\/(?!\/)/.test(url) || /^https?:\/\/[^/]+(?:\/|$)/i.test(url))
    );
}

function validateReferences(chart: ChartPayload): void {
    const series = index(chart.series),
        axes = index(chart.axes),
        coordinates = index(chart.coordinates);
    const data = new Map(
        Object.entries(chart.datasets).map(([id, value]) => [
            id,
            datumIds(value),
        ]),
    );
    const format = (id: string | null): void => {
        if (id !== null && !chart.formats[id])
            throw new Error("Unknown format reference.");
    };
    for (const axis of axes.values()) {
        if (!coordinates.has(axis.coordinateId))
            throw new Error("Unknown axis coordinate.");
        const { min, max } = axis.domain;
        if (min !== null && max !== null && min > max)
            throw new Error("Invalid axis domain.");
        if (
            axis.kind === "log" &&
            ((min !== null && min <= 0) || (axis.logBase ?? 0) <= 1)
        )
            throw new Error("Invalid logarithmic axis.");
        format(axis.formatId);
    }
    for (const item of series.values()) {
        if (!data.has(item.datasetId))
            throw new Error("Unknown series dataset.");
        if (item.coordinateId !== null && !coordinates.has(item.coordinateId))
            throw new Error("Unknown series coordinate.");
        for (const axisId of Object.values(item.axes))
            if (axes.get(axisId)?.coordinateId !== item.coordinateId)
                throw new Error("Incompatible series axis.");
        for (const id of item.itemIds ?? [])
            if (!data.get(item.datasetId)?.has(id))
                throw new Error("Unknown selected datum.");
        if (
            item.itemIds !== null &&
            ["graph", "hierarchy"].includes(chart.datasets[item.datasetId].kind)
        )
            throw new Error(
                "Structured datasets cannot select individual items.",
            );
        format(item.formatId);
        const radius = item.presentation.radius;
        if (radius && (radius[0] < 0 || radius[0] > radius[1] || radius[1] > 1))
            throw new Error("Invalid radial bounds.");
    }
    for (const requirement of chart.requirements)
        if (
            requirement.target.kind === "series" &&
            !series.has(requirement.target.id)
        )
            throw new Error("Unknown feature target.");
    for (const rule of chart.interactions.navigation) {
        if (
            series.get(rule.seriesId)?.datasetId !== rule.datum.datasetId ||
            !data.get(rule.datum.datasetId)?.has(rule.datum.id)
        )
            throw new Error("Unknown navigation datum.");
        const dataset = chart.datasets[rule.datum.datasetId];
        const kind =
            dataset.kind === "rows"
                ? "row"
                : dataset.kind === "series"
                  ? "item"
                  : "node";
        const validKind =
            dataset.kind === "graph"
                ? rule.datum.kind === "node"
                    ? dataset.nodes.some((item) => item.id === rule.datum.id)
                    : rule.datum.kind === "link" &&
                      dataset.links.some((item) => item.id === rule.datum.id)
                : rule.datum.kind === kind;
        const selected = series.get(rule.seriesId)?.itemIds;
        if (!validKind || (selected && !selected.includes(rule.datum.id)))
            throw new Error(
                "Navigation datum kind or selection does not match.",
            );
        if (!safeNavigation(rule.url))
            throw new Error("Unsafe navigation URL.");
    }
}

export function validateCapabilities(
    chart: ChartPayload,
    manifest: AdapterManifest,
): CapabilityIssue[] {
    const issues: CapabilityIssue[] = [];
    const fail = (
        code: CapabilityIssue["code"],
        path: string,
        message: string,
    ): void => {
        issues.push({
            code,
            chartName: chart.name,
            adapterName: manifest.name,
            path,
            message,
        });
    };
    const coordinate = (id: string | null) =>
        chart.coordinates.find((value) => value.id === id)?.kind ?? "none";
    const combinations = new Map<string, Set<string>>();
    for (const [i, series] of chart.series.entries()) {
        const path = "series." + i;
        const capability = manifest.series[series.type];
        const dataset = chart.datasets[series.datasetId];
        if (!capability) {
            fail("unsupported_series", path, "Unsupported series type.");
            continue;
        }
        if (!capability.coordinates.includes(coordinate(series.coordinateId)))
            fail(
                "unsupported_coordinate",
                path,
                "Unsupported coordinate for this series.",
            );
        if (series.requiredAdapter && series.requiredAdapter !== manifest.name)
            fail(
                "unsupported_series",
                path,
                "Series requires a different adapter.",
            );
        if (
            !manifest.datasetKinds.includes(dataset.kind) ||
            !capability.datasetKinds.includes(dataset.kind)
        )
            fail("unsupported_dataset", path, "Unsupported dataset kind.");
        if (
            dataset.kind === "series" &&
            dataset.requiredAdapter &&
            dataset.requiredAdapter !== manifest.name
        )
            fail(
                "unsupported_dataset",
                path,
                "Dataset requires a different adapter.",
            );
        const dimensions =
            dataset.kind === "rows"
                ? new Map(
                      dataset.dimensions.map((value) => [
                          value.key,
                          value.type,
                      ]),
                  )
                : new Map();
        for (const [role, fields] of Object.entries(series.encode)) {
            const rule = capability.roles[role];
            if (
                !rule ||
                fields.length < rule.minFields ||
                fields.length > rule.maxFields ||
                fields.some(
                    (field) =>
                        !rule.dimensionTypes.includes(dimensions.get(field)!),
                )
            )
                fail(
                    "invalid_mapping",
                    path + ".encode." + role,
                    "Invalid dimension mapping.",
                );
        }
        for (const [role, rule] of Object.entries(capability.roles))
            if (rule.required && !series.encode[role])
                fail(
                    "invalid_mapping",
                    path + ".encode." + role,
                    "A required mapping is missing.",
                );
        const key = series.coordinateId ?? "none";
        const set = combinations.get(key) ?? new Set<string>();
        set.add(series.type);
        combinations.set(key, set);
        for (const key of [
            "id",
            "name",
            "type",
            "data",
            "datasetId",
            "datasetIndex",
            "encode",
            "coordinateSystem",
            "xAxisIndex",
            "yAxisIndex",
            "gridIndex",
            "polarIndex",
            "angleAxisIndex",
            "radiusAxisIndex",
            "geoIndex",
            "radarIndex",
            "calendarIndex",
            "matrixIndex",
            "parallelIndex",
            "singleAxisIndex",
            "renderItem",
            "links",
            "nodes",
            "edges",
        ])
            if (key in (series.adapterOptions[manifest.name] ?? {}))
                fail(
                    "invalid_options",
                    path,
                    "Cannot override managed field " + key + ".",
                );
    }
    for (const [id, types] of combinations)
        if (
            types.size > 1 &&
            !manifest.mixedSeries.some(
                (rule) =>
                    rule.coordinate === coordinate(id) &&
                    [...types].every((type) => rule.types.includes(type)),
            )
        )
            fail(
                "unsupported_combination",
                "coordinates." + id,
                "Unsupported combination of series.",
            );
    for (const requirement of chart.requirements) {
        const feature = manifest.features[requirement.name];
        if (
            !feature ||
            !feature.scopes.includes(requirement.target.kind) ||
            !ajv.validate(feature.optionsSchema, requirement.options)
        )
            fail(
                "unsupported_feature",
                "requirements." + requirement.name,
                "Unsupported feature or options.",
            );
    }
    for (const extension of chart.extensions)
        if (
            extension.requiredAdapter &&
            extension.requiredAdapter !== manifest.name
        )
            fail(
                "missing_extension",
                "extensions",
                "Extension requires a different adapter.",
            );
    if (
        chart.appearance.renderingMode &&
        !manifest.renderingModes.includes(chart.appearance.renderingMode)
    )
        fail(
            "unsupported_feature",
            "appearance.renderingMode",
            "Unsupported rendering mode.",
        );
    for (const key of [
        "dataset",
        "series",
        "xAxis",
        "yAxis",
        "angleAxis",
        "radiusAxis",
        "parallelAxis",
        "singleAxis",
        "grid",
        "polar",
        "geo",
        "radar",
        "calendar",
        "matrix",
        "parallel",
    ])
        if (key in (chart.adapterOptions[manifest.name] ?? {}))
            fail(
                "invalid_options",
                "adapterOptions",
                "Cannot override managed field " + key + ".",
            );
    return issues;
}
