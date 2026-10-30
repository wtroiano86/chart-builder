import { useEffect } from "react";
import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type {
    ChartResult,
    ChartAdapterHandle,
} from "@wtroiano/chart-builder-sdk";
import { Chart } from "../../resources/react/core/Chart";
import { ChartCoordinator } from "../../resources/react/core/coordinator";
import { registerChartAdapter } from "../../resources/react/core/registry";
import { createShadcnAdapter } from "../../resources/react/adapters/shadcn";
import { shadcnCharts } from "../adapters/shadcn/charts";

const exportImage = vi.fn<NonNullable<ChartAdapterHandle["exportImage"]>>();
vi.mock("@inertiajs/react", () => ({ router: { visit: vi.fn() } }));
vi.mock("../../resources/react/core/ChartCanvas", () => ({
    ChartCanvas: ({
        onReady,
    }: {
        onReady: (handle: ChartAdapterHandle | null) => void;
    }) => {
        useEffect(() => {
            onReady({ resize: () => {}, exportImage });
            return () => onReady(null);
        }, []);
        return null;
    },
    ChartSkeleton: () => null,
}));
registerChartAdapter(
    "shadcn",
    createShadcnAdapter(() => import("../adapters/shadcn/chart")),
);
afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

it.each(["denied", "scope", "snapshot", "unmount"])(
    "discards a pending image download after %s",
    async (change) => {
        let finish!: (blob: Blob) => void;
        exportImage.mockReturnValueOnce(
            new Promise((resolve) => {
                finish = resolve;
            }),
        );
        const create = vi.fn(() => "blob:download");
        vi.stubGlobal(
            "URL",
            class extends URL {
                static createObjectURL = create;
                static revokeObjectURL = vi.fn();
            },
        );
        const result: Extract<ChartResult, { status: "ready" }> = {
            schemaVersion: 1,
            name: "line",
            contextKey: "scope",
            requestId: null,
            status: "ready",
            chart: shadcnCharts()[0],
        };
        const coordinator = new ChartCoordinator("/", () => {});
        const view = render(
            <Chart
                name="line"
                propName="chart"
                result={result}
                coordinator={coordinator}
            />,
        );
        fireEvent.click(
            await view.findByRole("button", { name: "Download PNG" }),
        );
        if (change === "unmount") view.unmount();
        else {
            const next: ChartResult =
                change === "denied"
                    ? {
                          schemaVersion: 1,
                          name: "line",
                          contextKey: "scope",
                          requestId: null,
                          status: "denied",
                          reason: "forbidden",
                      }
                    : structuredClone(result);
            if (change === "scope") next.contextKey = "other-tenant";
            if (change === "snapshot" && next.status === "ready")
                next.chart.meta.snapshotId = "next";
            view.rerender(
                <Chart
                    name="line"
                    propName="chart"
                    result={next}
                    coordinator={coordinator}
                />,
            );
        }
        await act(async () =>
            finish(new Blob(["image"], { type: "image/png" })),
        );
        expect(create).not.toHaveBeenCalled();
        expect(view.queryByRole("alert")).toBeNull();
    },
);

it("downloads a completed current export and reports a current export failure", async () => {
    const create = vi.fn(() => "blob:download");
    vi.stubGlobal(
        "URL",
        class extends URL {
            static createObjectURL = create;
            static revokeObjectURL = vi.fn();
        },
    );
    const click = vi
        .spyOn(HTMLAnchorElement.prototype, "click")
        .mockImplementation(() => {});
    const result: ChartResult = {
        schemaVersion: 1,
        name: "line",
        contextKey: "scope",
        requestId: null,
        status: "ready",
        chart: shadcnCharts()[0],
    };
    const blob = new Blob(["image"], { type: "image/png" });
    exportImage
        .mockResolvedValueOnce(blob)
        .mockRejectedValueOnce(new Error("Encoding failed"));
    const view = render(
        <Chart
            name="line"
            propName="chart"
            result={result}
            coordinator={new ChartCoordinator("/", () => {})}
        />,
    );
    const button = await view.findByRole("button", { name: "Download PNG" });
    await act(async () => fireEvent.click(button));
    expect(create).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalledTimes(1);
    await act(async () => fireEvent.click(button));
    expect(await view.findByRole("alert")).toHaveTextContent("Encoding failed");
});
