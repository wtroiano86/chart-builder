import { expect, it } from "vitest";
import {
    ChartCoordinator,
    patchChartUrl,
    type ChartRequest,
} from "../../resources/react/core/coordinator";

it("merges independent chart requests and preserves unrelated table state", async () => {
    const requests: ChartRequest[] = [];
    const coordinator = new ChartCoordinator(
        "/charts?orders[page]=3",
        (request) => {
            requests.push(request);
        },
    );
    coordinator.update("revenue", "revenueChart", { interval: "day" });
    await Promise.resolve();
    coordinator.update("orders", "ordersChart", { interval: "year" });
    expect(requests).toHaveLength(1);
    requests[0].success(requests[0].url);
    requests[0].finish();
    await Promise.resolve();
    expect(requests).toHaveLength(2);
    const query = new URL(requests[1].url, "http://localhost").searchParams;
    expect(query.get("charts[revenue][interval]")).toBe("day");
    expect(query.get("charts[orders][interval]")).toBe("year");
    expect(query.get("orders[page]")).toBe("3");
    requests[1].success(requests[1].url);
    requests[1].finish();
    expect(coordinator.state("orders").pending).toBe(false);
});

it("keeps newer drafts pending, retries failures and rejects stale responses", async () => {
    const requests: ChartRequest[] = [];
    const coordinator = new ChartCoordinator("/charts", (request) => {
        requests.push(request);
    });
    coordinator.update("revenue", "chart", { interval: "day" });
    await Promise.resolve();
    coordinator.update("revenue", "chart", { interval: "year" });
    requests[0].success(requests[0].url);
    requests[0].finish();
    await Promise.resolve();
    expect(coordinator.state("revenue").pending).toBe(true);
    expect(coordinator.accepts("revenue", requests[0].id)).toBe(false);
    requests[1].failure("Offline");
    requests[1].finish();
    await Promise.resolve();
    expect(requests).toHaveLength(2);
    coordinator.retry("revenue", "chart");
    await Promise.resolve();
    expect(requests).toHaveLength(3);
    expect(
        new URL(requests[2].url, "http://localhost").searchParams.get(
            "charts[revenue][interval]",
        ),
    ).toBe("year");
});

it("rebases after table visits and resets authoritative history", async () => {
    const requests: ChartRequest[] = [];
    const coordinator = new ChartCoordinator(
        "/charts?orders[page]=1",
        (request) => {
            requests.push(request);
        },
    );
    coordinator.update("revenue", "chart", { interval: "day" });
    await Promise.resolve();
    coordinator.externalStart("/charts?orders[page]=2");
    requests[0].finish();
    await Promise.resolve();
    expect(requests).toHaveLength(1);
    coordinator.externalFinish("/charts?orders[page]=2");
    await Promise.resolve();
    expect(
        new URL(requests[1].url, "http://localhost").searchParams.get(
            "orders[page]",
        ),
    ).toBe("2");
    coordinator.history("/charts?orders[page]=1");
    requests[1].success(requests[1].url);
    requests[1].finish();
    await Promise.resolve();
    expect(coordinator.state("revenue").requestId).toBeNull();
});

it("encodes resets, nulls and multiselects without touching other namespaces", () => {
    const value = patchChartUrl(
        "/charts?charts[a][x]=1&charts[b][x]=2&tab=reports",
        "a",
        null,
    );
    expect(
        new URL(value, "http://localhost").searchParams.get("charts[b][x]"),
    ).toBe("2");
    const params = new URL(
        patchChartUrl(value, "a", { selected: ["1", "2"], clear: null }),
        "http://localhost",
    ).searchParams;
    expect(params.getAll("charts[a][selected][]")).toEqual(["1", "2"]);
    expect(params.get("charts[a][clear]")).toBe("");
});
