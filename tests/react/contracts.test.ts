import { describe, expect, it } from "vitest";
import {
    assertAdapterManifest,
    assertChartPayload,
    assertChartResult,
    validateCapabilities,
    mergeOptions,
    csvCell,
} from "@wtroiano/chart-builder-sdk";
import fixture from "./fixtures/revenue.json";
import { echartsManifest } from "../../resources/react/adapters/echarts";
import { fixtureManifest } from "../adapters/fixture/src";
import { galleryCharts } from "../browser/gallery";

describe("public contracts", () => {
    it("validates a real PHP result and every gallery family", () => {
        assertChartResult(fixture);
        assertAdapterManifest(echartsManifest);
        assertAdapterManifest(fixtureManifest);
        for (const chart of galleryCharts()) {
            assertChartPayload(chart);
            expect(
                validateCapabilities(chart, echartsManifest),
                chart.name,
            ).toEqual([]);
        }
    });
    it("rejects version drift, unsafe values, references and capabilities", () => {
        expect(() =>
            assertChartResult({ ...fixture, schemaVersion: 2 }),
        ).toThrow();
        assertChartResult(fixture);
        if (fixture.status !== "ready") throw new Error("fixture");
        const chart = structuredClone(fixture.chart);
        chart.series[0].datasetId = "missing";
        expect(() => assertChartPayload(chart)).toThrow(
            "Unknown series dataset",
        );
        const unsupported = galleryCharts().find(
            (chart) => chart.name === "bar",
        )!;
        expect(validateCapabilities(unsupported, fixtureManifest)[0].code).toBe(
            "unsupported_series",
        );
    });
    it("keeps options JSON-only and treats CSV text as text", () => {
        expect(
            mergeOptions(
                { nested: { a: 1 }, values: [1, 2] },
                { nested: { b: 2 }, values: [3], reset: null },
            ),
        ).toEqual({ nested: { a: 1, b: 2 }, values: [3], reset: null });
        expect(() =>
            mergeOptions({}, JSON.parse('{"__proto__":{}}')),
        ).toThrow();
        expect(csvCell("=SUM(A1)")).toBe('"\'=SUM(A1)"');
        expect(csvCell(-10)).toBe('"-10"');
    });
});
