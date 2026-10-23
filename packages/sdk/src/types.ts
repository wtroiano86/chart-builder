import type { ComponentType } from "react";

export type Json =
    null | boolean | number | string | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };
export type Scalar = null | boolean | number | string;
export type DatasetKind = "rows" | "hierarchy" | "graph" | "series";
export type DimensionType =
    "string" | "boolean" | "number" | "date" | "datetime";
export type FilterValue = string | number | boolean | null | string[];
export type EventType =
    "point-activate" | "series-visibility" | "viewport-change";

export interface Dimension {
    key: string;
    label: string;
    type: DimensionType;
    nullable: boolean;
}
export interface Bucket {
    start: string;
    until: string;
    timezone: string;
    partial: boolean;
}
export interface RowDatum {
    id: string;
    categoryKeys?: Record<string, string>;
    values: Record<string, Scalar>;
    display: Record<string, string>;
    bucket: Bucket | null;
}
export interface RowsDataset {
    kind: "rows";
    identity: "stable" | "snapshot";
    dimensions: Dimension[];
    rows: RowDatum[];
}
export interface HierarchyNode {
    id: string;
    label: string;
    value: number | null;
    children: HierarchyNode[];
}
export interface HierarchyDataset {
    kind: "hierarchy";
    roots: HierarchyNode[];
}
export interface GraphNode {
    id: string;
    label: string;
    value: number | null;
    attributes: Record<string, Scalar>;
}
export interface GraphLink {
    id: string;
    source: string;
    target: string;
    label: string | null;
    value: number | null;
}
export interface GraphDataset {
    kind: "graph";
    nodes: GraphNode[];
    links: GraphLink[];
    directed: boolean;
}
export interface SeriesDataset {
    kind: "series";
    requiredAdapter: string | null;
    items: Array<{ id: string; value: Json }>;
    projection: RowsDataset;
}
export type DatasetPayload =
    RowsDataset | HierarchyDataset | GraphDataset | SeriesDataset;

export interface DatumRef {
    datasetId: string;
    kind: "row" | "node" | "link" | "item";
    id: string;
}
export interface FeatureRequirement {
    name: string;
    target: { kind: "chart" } | { kind: "series"; id: string };
    options: JsonObject;
}
export interface SeriesDefinition {
    id: string;
    label: string;
    type: string;
    datasetId: string;
    coordinateId: string | null;
    axes: Record<string, string>;
    encode: Record<string, string[]>;
    itemIds: string[] | null;
    formatId: string | null;
    requiredAdapter: string | null;
    rendererName: string | null;
    presentation: {
        color: string | null;
        stack: string | null;
        orientation: "vertical" | "horizontal";
        area: boolean;
        step: "start" | "middle" | "end" | null;
        smooth: boolean;
        radius: [number, number] | null;
        symbolSize: number | null;
    };
    adapterOptions: Record<string, JsonObject>;
}
export interface AxisDefinition {
    id: string;
    coordinateId: string;
    kind: "category" | "value" | "time" | "log";
    position:
        "top" | "bottom" | "left" | "right" | "angle" | "radius" | "parallel";
    title: string | null;
    domain: {
        min: number | null;
        max: number | null;
        categories: Array<string | number> | null;
    };
    logBase: number | null;
    formatId: string | null;
}
export type CoordinateDefinition = { id: string } & (
    | { kind: "cartesian"; bounds: [number, number, number, number] }
    | { kind: "polar"; center: [number, number]; radius: number }
    | {
          kind: "radar";
          indicators: Array<{
              id: string;
              label: string;
              min: number;
              max: number;
          }>;
      }
    | { kind: "geo"; asset: string; projection: string | null }
    | { kind: "calendar"; from: string; until: string; weekStartsOn: number }
    | { kind: "matrix"; rows: string[]; columns: string[] }
    | { kind: "parallel" }
    | { kind: "none" }
);
export type FormatDescriptor =
    | { kind: "number"; decimals: number; compact: boolean }
    | { kind: "currency"; currency: string; decimals: number }
    | { kind: "percent"; input: "ratio" | "whole"; decimals: number }
    | {
          kind: "date";
          dateStyle: "short" | "medium" | "long";
          timeStyle: "short" | "medium" | null;
      }
    | { kind: "custom"; name: string; params: JsonObject };
export type FilterDefinition =
    | {
          kind: "date-range";
          key: string;
          label: string;
          fromKey: string;
          untilKey: string;
          clearable: boolean;
      }
    | {
          kind: "interval" | "select" | "multiselect";
          key: string;
          label: string;
          options: Array<{ value: string; label: string }>;
          clearable: boolean;
      };
export interface ExtensionReference {
    kind: "formatter" | "renderer" | "geography";
    name: string;
    requiredAdapter: string | null;
    params: JsonObject;
}
export interface NavigationRule {
    seriesId: string;
    datum: DatumRef;
    url: string;
    target: "_self" | "_blank";
}
export interface ChartPayload {
    schemaVersion: 1;
    name: string;
    adapter: { name: string; apiVersion: 1; manifestVersion: string };
    title: string | null;
    description: string | null;
    datasets: Record<string, DatasetPayload>;
    series: SeriesDefinition[];
    axes: AxisDefinition[];
    coordinates: CoordinateDefinition[];
    formats: Record<string, FormatDescriptor>;
    state: Record<string, FilterValue>;
    filters: FilterDefinition[];
    appearance: {
        theme: "system" | "light" | "dark";
        palette: string[];
        height: number;
        legend: {
            visible: boolean;
            position: "top" | "bottom" | "left" | "right";
        };
        tooltip: boolean;
        animation: boolean;
        renderingMode: string | null;
    };
    interactions: {
        navigation: NavigationRule[];
        callbacks: Partial<Record<EventType, string>>;
    };
    requirements: FeatureRequirement[];
    adapterOptions: Record<string, JsonObject>;
    extensions: ExtensionReference[];
    meta: {
        snapshotId: string;
        queryNamespace: string;
        resolvedAt: string;
        locale: string;
        timezone: string;
        range: { from: string; until: string } | null;
    };
}
export type ChartErrorCode =
    | "data_unavailable"
    | "limit_exceeded"
    | "unsupported_feature"
    | "configuration"
    | "internal"
    | "transport"
    | "render_failed";
export interface ChartError {
    code: ChartErrorCode;
    message: string;
    retryable: boolean;
    referenceId: string | null;
}
export type ChartResult = {
    schemaVersion: 1;
    name: string;
    requestId: string | null;
    contextKey: string;
} & (
    | { status: "ready"; chart: ChartPayload }
    | {
          status: "invalid";
          errors: Record<string, string[]>;
          filters: FilterDefinition[];
          input: Record<string, Json>;
      }
    | { status: "error"; error: ChartError }
    | { status: "denied"; reason: "unauthenticated" | "forbidden" }
);
export interface CapabilityIssue {
    code:
        | "unsupported_dataset"
        | "unsupported_series"
        | "unsupported_coordinate"
        | "unsupported_combination"
        | "unsupported_feature"
        | "unsupported_export"
        | "invalid_mapping"
        | "invalid_options"
        | "missing_extension";
    chartName: string;
    adapterName: string;
    path: string;
    message: string;
}
export interface RoleCapability {
    dimensionTypes: DimensionType[];
    minFields: number;
    maxFields: number;
    required: boolean;
}
export interface SeriesCapability {
    datasetKinds: DatasetKind[];
    coordinates: CoordinateDefinition["kind"][];
    roles: Record<string, RoleCapability>;
}
export interface AdapterManifest {
    manifestSchemaVersion: 1;
    name: string;
    apiVersion: 1;
    manifestVersion: string;
    payloadSchemaVersions: number[];
    sdkRange: string;
    reactRange: string;
    engine: { package: string; range: string };
    datasetKinds: DatasetKind[];
    series: Record<string, SeriesCapability>;
    mixedSeries: Array<{
        coordinate: CoordinateDefinition["kind"];
        types: string[];
    }>;
    features: Record<
        string,
        {
            scopes: Array<"chart" | "series">;
            optionsSchema: JsonObject;
        }
    >;
    renderingModes: string[];
    exports: Array<{ format: "png" | "jpeg" | "svg" | "pdf"; modes: string[] }>;
}
export type ChartEvent = {
    chartName: string;
    snapshotId: string;
    origin: "user" | "programmatic";
} & (
    | { type: "point-activate"; seriesId: string; datum: DatumRef }
    | { type: "series-visibility"; seriesId: string; visible: boolean }
    | {
          type: "viewport-change";
          coordinateId: string;
          ranges: Array<{
              axisId: string;
              from: string | number;
              to: string | number;
          }>;
      }
);
export interface PresentationContext {
    resolveExtension?: (
        kind: ExtensionReference["kind"],
        name: string,
    ) => unknown;
    width: number;
    height: number;
    theme: "light" | "dark";
    tokens: Record<string, string>;
    palette: string[];
    locale: string;
    timezone: string;
    reducedMotion: boolean;
}
export interface ImageExportRequest {
    format: "png" | "jpeg" | "svg" | "pdf";
    scale: number;
    background: string | null;
}
export interface ChartAdapterHandle {
    resize(size: { width: number; height: number }): void;
    exportImage?: (request: ImageExportRequest) => Promise<Blob>;
}
export interface ChartAdapterProps {
    chart: ChartPayload;
    context: PresentationContext;
    onEvent: (event: ChartEvent) => void;
    onError: (error: ChartError) => void;
    onReady: (handle: ChartAdapterHandle | null) => void;
}
export interface ChartAdapterModule {
    Component: ComponentType<ChartAdapterProps>;
}
export interface ChartAdapter {
    readonly name: string;
    readonly apiVersion: 1;
    readonly manifest: AdapterManifest;
    validate(chart: ChartPayload): CapabilityIssue[];
    load(): Promise<ChartAdapterModule>;
}
