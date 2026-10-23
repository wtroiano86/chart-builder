import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";

const destination = new URL("../docs/images/", import.meta.url);
await mkdir(destination, { recursive: true });

const browser = await chromium.launch();
try {
    const page = await browser.newPage({
        viewport: { width: 1280, height: 3000 },
        deviceScaleFactor: 1,
        locale: "en-US",
        timezoneId: "UTC",
        colorScheme: "light",
        reducedMotion: "reduce",
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const response = await page.goto("http://127.0.0.1:4174/demo").catch(() => {
        throw new Error("Start the PHP demo with `npm run dev`, then retry.");
    });
    expect(response?.status(), "The PHP demo must load successfully").toBe(200);
    const charts = page.locator(".demo-grid .cb-chart");
    await expect(charts).toHaveCount(6);

    async function ready(theme) {
        for (const chart of await charts.all()) {
            await expect(chart).toHaveAttribute("data-theme", theme);
            await expect(chart).toHaveAttribute("aria-busy", "false");
            await expect(chart.locator("svg")).toBeVisible();
            await expect
                .poll(() => chart.locator("svg path").count())
                .toBeGreaterThan(0);
            await expect(
                chart.getByRole("button", { name: "Download SVG" }),
            ).toBeVisible();
        }
        await expect(page.getByRole("alert")).toHaveCount(0);
        await expect(page.locator("#nprogress")).toHaveCount(0);
        await page.evaluate(async () => {
            await document.fonts.ready;
            await new Promise((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(resolve)),
            );
        });
        await page.mouse.move(0, 0);
    }

    // Capture the existing demo layout, including the real package controls.
    // The middle two rows contain stacked bars, a donut, mixed series and scatter.
    async function capture(filename, firstIndex, lastIndex = firstIndex) {
        const first = await charts.nth(firstIndex).boundingBox();
        const last = await charts.nth(lastIndex).boundingBox();
        if (!first || !last) throw new Error("Chart layout is unavailable.");
        await page.screenshot({
            path: fileURLToPath(new URL(filename, destination)),
            animations: "disabled",
            caret: "hide",
            clip: {
                x: first.x - 12,
                y: first.y - 12,
                width: last.x + last.width - first.x + 24,
                height: last.y + last.height - first.y + 24,
            },
        });
        console.log(`Captured docs/images/${filename}`);
    }

    await ready("light");
    await capture("charts-light.png", 1, 4);
    await capture("revenue-filters.png", 0);
    await capture("treemap.png", 5);
    await page.getByRole("combobox", { name: "Theme" }).selectOption("dark");
    await ready("dark");
    await capture("charts-dark.png", 1, 4);
    expect(errors, "Screenshots must be free of browser errors").toEqual([]);
} finally {
    await browser.close();
}
