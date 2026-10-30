import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("previews live PHP charts and reruns SQL for chart filters", async ({
    page,
}) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/demo");
    await expect(
        page.getByRole("heading", { name: "Live PHP chart preview" }),
    ).toBeVisible();
    await expect(page.locator(".demo-grid .cb-chart svg")).toHaveCount(6);
    const revenue = page.getByRole("region", {
        name: "Revenue over time",
        exact: true,
    });
    await revenue.getByText("View chart data").click();
    await expect(revenue.getByRole("row")).toHaveCount(13);
    await revenue
        .getByRole("combobox", { name: "Interval" })
        .selectOption("quarter");
    await revenue
        .getByRole("combobox", { name: "Region" })
        .selectOption("North");
    const resolved = page.waitForResponse(
        (response) =>
            response.request().headers()["x-inertia-partial-data"] ===
            "revenueChart",
    );
    await revenue.getByRole("button", { name: "Apply", exact: true }).click();
    const body = await (await resolved).json();
    expect(body.props.revenueChart.status).toBe("ready");
    expect(body.props.revenueChart.chart.state.region).toBe("North");
    expect(body.props.revenueChart.chart.datasets.default.rows).toHaveLength(4);
    await expect(revenue.getByRole("row")).toHaveCount(5);
    await expect(page.locator(".demo-grid .cb-chart svg")).toHaveCount(6);
    const download = page.waitForEvent("download");
    await revenue.getByRole("button", { name: "Download SVG" }).click();
    expect((await download).suggestedFilename()).toBe("revenue.svg");
    await revenue.getByText("View chart data").click();
    await page
        .getByRole("button", { name: "Reset", exact: true })
        .first()
        .click();
    await expect(page).not.toHaveURL(/charts%5Brevenue%5D/);
    await expect(page.locator("#nprogress")).toHaveCount(0);
    await page.screenshot({
        path: "tmp/browser-results/demo.png",
        fullPage: true,
    });
    await page.getByRole("combobox", { name: "Theme" }).selectOption("dark");
    await expect(revenue).toHaveAttribute("data-theme", "dark");
    expect(
        (await new AxeBuilder({ page }).include(".demo-shell").analyze())
            .violations,
    ).toEqual([]);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect
        .poll(() =>
            page.evaluate(
                () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
        )
        .toBe(true);
    expect(errors).toEqual([]);
});

test("renders, filters, exports and clears denied data", async ({ page }) => {
    await page.goto("/charts?orders[page]=3");
    const revenue = page.getByRole("region", { name: "Revenue" });
    await expect(revenue.locator("svg")).toBeVisible();
    await revenue
        .getByRole("combobox", { name: "Interval" })
        .selectOption("day");
    await revenue.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(page).toHaveURL(/charts%5Brevenue%5D%5Binterval%5D=day/);
    expect(new URL(page.url()).searchParams.get("orders[page]")).toBe("3");
    await revenue.getByText("View chart data").click();
    await expect(revenue.getByRole("link", { name: "Open Jan" })).toBeVisible();
    const downloaded = page.waitForEvent("download");
    await revenue.getByRole("button", { name: "Download CSV" }).click();
    expect((await downloaded).suggestedFilename()).toBe("revenue.csv");
    await revenue
        .getByRole("combobox", { name: "Interval" })
        .selectOption("denied");
    await revenue.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(
        page.getByText("Access to this chart is not available."),
    ).toBeVisible();
    await expect(
        page
            .getByRole("region", { name: "revenue", exact: true })
            .locator("svg"),
    ).toHaveCount(0);
});

test("coordinates simultaneous chart updates and deferred data", async ({
    page,
}) => {
    await page.goto("/charts?deferred=1&orders[page]=3");
    const revenue = page.getByRole("region", { name: "Revenue" });
    const orders = page.getByRole("region", { name: "Orders" });
    await expect(revenue.locator("svg")).toBeVisible();
    await revenue.getByRole("combobox").selectOption("day");
    await orders.getByRole("combobox").selectOption("year");
    await revenue.getByRole("button", { name: "Apply", exact: true }).click();
    await orders.getByRole("button", { name: "Apply", exact: true }).click();
    await expect
        .poll(() =>
            new URL(page.url()).searchParams.get("charts[orders][interval]"),
        )
        .toBe("year");
    expect(
        new URL(page.url()).searchParams.get("charts[revenue][interval]"),
    ).toBe("day");
    expect(new URL(page.url()).searchParams.get("orders[page]")).toBe("3");
});

test("renders every gallery family with SVG graphics", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/gallery");
    const charts = page.locator("[data-chart]");
    await expect(charts).toHaveCount(36);
    for (const chart of await charts.all()) {
        await expect(
            chart.getByRole("alert"),
            (await chart.getAttribute("data-chart")) ?? "",
        ).toHaveCount(0);
        await expect(chart.locator("svg")).toBeVisible();
        await expect
            .poll(
                () =>
                    chart
                        .locator("svg path, svg rect, svg circle, svg polygon")
                        .count(),
                { message: (await chart.getAttribute("data-chart")) ?? "" },
            )
            .toBeGreaterThan(0);
    }
    expect(errors).toEqual([]);
    await page.screenshot({
        path: "tmp/browser-results/gallery.png",
        fullPage: true,
    });
});

test("supports keyboard controls, narrow layouts and accessible data", async ({
    page,
}) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/charts");
    await expect(page.locator(".cb-chart svg").first()).toBeVisible();
    const results = await new AxeBuilder({ page })
        .include(".cb-chart")
        .analyze();
    expect(results.violations).toEqual([]);
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
    ).toBe(true);
});
