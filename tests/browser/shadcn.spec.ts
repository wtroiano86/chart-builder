import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("renders every shadcn family with real data, tooltips, updates and accessible exports", async ({
    page,
}) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/shadcn");
    const line = page.getByRole("region", { name: "line", exact: true });
    await expect(page.locator(".cb-shadcn svg.recharts-surface")).toHaveCount(
        11,
    );
    for (const name of [
        "line",
        "area",
        "step",
        "smooth",
        "bar",
        "horizontal",
        "stacked",
        "grouped",
        "mixed",
        "pie",
        "donut",
    ]) {
        const region = page.getByRole("region", { name, exact: true });
        const shape = region
            .locator(
                "path.recharts-line-curve, path.recharts-area-curve, path.recharts-rectangle, path.recharts-sector",
            )
            .first();
        await expect(shape).toHaveAttribute("d", /[ML].*\d/);
    }
    // Missing Tailwind used to leave these real shadcn components unstyled.
    await expect(line.locator(".cb-shadcn")).toHaveCSS("display", "flex");
    await expect(line.locator(".cb-shadcn")).toHaveCSS("font-size", "12px");
    await expect(
        line.locator(".recharts-cartesian-axis-tick-value").first(),
    ).toHaveCSS("fill", "rgb(113, 113, 122)");
    const legend = line.locator(".recharts-legend-wrapper > div");
    await expect(legend).toHaveCSS("justify-content", "center");
    const swatch = legend.locator("[style*='background-color']");
    await expect(swatch).toHaveCSS("width", "8px");
    await expect(swatch).toHaveCSS("height", "8px");
    const lightColor = await swatch.evaluate(
        (node) => getComputedStyle(node).backgroundColor,
    );
    await expect(line.getByRole("button", { name: /^Revenue:/ })).toHaveCount(
        6,
    );
    await expect(
        line.getByRole("button", { name: "Revenue: $12,500.00" }),
    ).toBeVisible();
    await line.getByRole("button", { name: "Revenue: $12,500.00" }).hover();
    await expect(line.locator(".recharts-tooltip-wrapper")).toContainText(
        "$12,500.00",
    );
    await expect(line.locator(".recharts-tooltip-wrapper")).toContainText(
        "Jan",
    );
    const tooltip = line.locator(".recharts-tooltip-wrapper > div");
    await expect(tooltip).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(tooltip).toHaveCSS("padding-left", "10px");
    await expect(tooltip).not.toHaveCSS("box-shadow", "none");
    const pie = page.getByRole("region", { name: "pie", exact: true });
    await pie.locator(".recharts-pie-sector").first().hover();
    await expect(pie.locator(".recharts-tooltip-wrapper")).toContainText(
        "$12,500.00",
    );
    await expect(pie.locator(".recharts-tooltip-wrapper")).toContainText("Jan");
    await line.getByText("View chart data").click();
    await expect(
        line.getByRole("cell", { name: "12500", exact: true }),
    ).toBeVisible();
    const download = page.waitForEvent("download");
    await line.getByRole("button", { name: "Download CSV" }).click();
    expect((await download).suggestedFilename()).toBe("line.csv");
    await expect(
        line.getByRole("button", { name: /Download (SVG|PNG)/ }),
    ).toHaveCount(2);
    await page.getByRole("button", { name: "Toggle February only" }).click();
    await expect(
        line.getByRole("button", { name: "Revenue: $12,500.00" }),
    ).toHaveCount(0);
    await expect(
        line.getByRole("button", { name: "Revenue: $14,800.00" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Toggle theme" }).click();
    await expect(line.locator(".cb-shadcn")).toHaveClass(/dark/);
    await expect(
        line.locator(".recharts-cartesian-axis-tick-value").first(),
    ).toHaveCSS("fill", "rgb(161, 161, 170)");
    await expect(swatch).not.toHaveCSS("background-color", lightColor);
    await line.getByRole("button", { name: "Revenue: $14,800.00" }).hover();
    await expect(tooltip).toHaveCSS("background-color", "rgb(24, 24, 27)");
    expect(
        (await new AxeBuilder({ page }).include(".shadcn-gallery").analyze())
            .violations,
    ).toEqual([]);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(line.locator("svg.recharts-surface")).toHaveAttribute(
        "width",
        /^(2|3)\d\d$/,
    );
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
    ).toBe(true);
    await page.getByRole("button", { name: "Toggle access" }).click();
    await expect(page.locator(".cb-shadcn")).toHaveCount(0);
    await expect(
        page.getByRole("button", { name: "Download CSV" }),
    ).toHaveCount(0);
    expect(errors).toEqual([]);
});

test("lays out side legends vertically and preserves them in image exports", async ({
    page,
}) => {
    await page.goto("/shadcn");
    const chart = page.getByRole("region", { name: "grouped", exact: true });
    const entries = chart.locator(".recharts-legend-wrapper > div > div");
    await expect(entries).toHaveCount(2);
    expect(
        await chart
            .locator(".recharts-legend-wrapper [style*='background-color']")
            .evaluateAll(
                (nodes) =>
                    new Set(
                        nodes.map(
                            (node) => getComputedStyle(node).backgroundColor,
                        ),
                    ).size,
            ),
    ).toBe(2);
    for (const position of ["left", "right", "top", "bottom"]) {
        await page.getByLabel("Legend position").selectOption(position);
        await expect
            .poll(async () => {
                const first = await entries.nth(0).boundingBox();
                const second = await entries.nth(1).boundingBox();
                if (!first || !second) return false;
                return position === "left" || position === "right"
                    ? Math.abs(first.x - second.x) < 1 &&
                          second.y >= first.y + first.height
                    : Math.abs(first.y - second.y) < 1 &&
                          second.x >= first.x + first.width;
            })
            .toBe(true);
    }
    await page.getByLabel("Legend position").selectOption("left");
    await expect(chart.locator(".recharts-legend-wrapper > div")).toHaveCSS(
        "flex-direction",
        "column",
    );
    const download = page.waitForEvent("download");
    await chart.getByRole("button", { name: "Download SVG" }).click();
    const { readFile } = await import("node:fs/promises");
    const svg = await readFile((await (await download).path())!, "utf8");
    const labels = await page.evaluate((svg) => {
        const document = new DOMParser().parseFromString(svg, "image/svg+xml");
        return ["Revenue", "Forecast"].map((label) => {
            const text = [...document.querySelectorAll("text")].find(
                (node) => node.textContent === label,
            )!;
            return {
                x: Number(text.getAttribute("x")),
                y: Number(text.getAttribute("y")),
            };
        });
    }, svg);
    expect(labels[0].x).toBeCloseTo(labels[1].x);
    expect(labels[1].y).toBeGreaterThan(labels[0].y);
});

for (const name of [
    "line",
    "area",
    "step",
    "smooth",
    "bar",
    "horizontal",
    "stacked",
    "grouped",
    "mixed",
    "pie",
    "donut",
])
    test(`downloads standalone SVG and PNG for ${name}`, async ({ page }) => {
        const { readFile } = await import("node:fs/promises");
        await page.goto("/shadcn");
        await expect(
            page.locator(".cb-shadcn svg.recharts-surface"),
        ).toHaveCount(11);
        // Exercise CSS variables and clipping as they appear in an application.
        await page.addStyleTag({
            content:
                ".cb-shadcn { --export-test-color: rgb(200, 30, 40); } .cb-shadcn .recharts-line-curve { stroke: var(--export-test-color); }",
        });
        await page
            .locator(".recharts-line-curve")
            .evaluateAll((nodes) =>
                nodes.forEach((node) =>
                    node.setAttribute("stroke", "var(--export-test-color)"),
                ),
            );
        const region = page.getByRole("region", { name, exact: true });
        for (const format of ["svg", "png"]) {
            const pending = page.waitForEvent("download");
            await region
                .getByRole("button", {
                    name: "Download " + format.toUpperCase(),
                })
                .click();
            const download = await pending;
            expect(download.suggestedFilename()).toBe(name + "." + format);
            const data = await readFile((await download.path())!);
            if (format === "svg") {
                const svg = data.toString();
                expect(svg).toContain("http://www.w3.org/2000/svg");
                expect(svg).toContain(
                    name === "pie" || name === "donut"
                        ? ">Jan</text>"
                        : ">Revenue</text>",
                );
                expect(svg).not.toMatch(
                    /var\(--|<foreignObject|<script|recharts-tooltip-cursor/,
                );
                if (name === "line")
                    expect(svg).toContain("stroke: rgb(200, 30, 40)");
            } else
                expect([...data.subarray(0, 8)]).toEqual([
                    137, 80, 78, 71, 13, 10, 26, 10,
                ]);
            // Decode outside the chart's DOM/CSS and inspect pixels, not file presence alone.
            const decoded = await page.evaluate(
                async ({ data, format }) => {
                    const image = new Image();
                    image.src =
                        "data:image/" +
                        (format === "svg" ? "svg+xml" : "png") +
                        ";base64," +
                        data;
                    await image.decode();
                    const canvas = document.createElement("canvas");
                    canvas.width = image.naturalWidth;
                    canvas.height = image.naturalHeight;
                    const context = canvas.getContext("2d")!;
                    context.drawImage(image, 0, 0);
                    const pixels = context.getImageData(
                        0,
                        0,
                        canvas.width,
                        canvas.height,
                    ).data;
                    let painted = 0;
                    for (let i = 0; i < pixels.length; i += 4)
                        if (
                            pixels[i + 3] &&
                            (pixels[i] < 220 ||
                                pixels[i + 1] < 220 ||
                                pixels[i + 2] < 220)
                        )
                            painted++;
                    return {
                        width: canvas.width,
                        height: canvas.height,
                        painted,
                    };
                },
                { data: data.toString("base64"), format },
            );
            expect(decoded.width).toBeGreaterThan(200);
            expect(decoded.height).toBe(320);
            expect(decoded.painted).toBeGreaterThan(100);
        }
        if (name !== "line") return;
        await page
            .getByRole("button", { name: "Toggle February only" })
            .click();
        await page.getByRole("button", { name: "Toggle theme" }).click();
        const line = page.getByRole("region", { name: "line", exact: true });
        await expect(line.locator(".cb-shadcn")).toHaveClass(/dark/);
        const pending = page.waitForEvent("download");
        await line.getByRole("button", { name: "Download SVG" }).click();
        const svg = await readFile((await (await pending).path())!, "utf8");
        expect(svg).toContain("rgb(24, 24, 27)");
        expect(svg).toContain("rgb(161, 161, 170)");
        expect(svg).not.toContain(">Jan</tspan>");
        expect(svg).toContain(">Feb</tspan>");
        const scaled = await page.evaluate(async () => {
            const path = "/resources/react/adapters/shadcn/export.ts";
            const { exportChartImage } = (await import(
                path
            )) as typeof import("../../resources/react/adapters/shadcn/export");
            const host =
                document.querySelector<HTMLElement>(
                    ".cb-shadcn",
                )!.parentElement!;
            const blob = await exportChartImage(
                host,
                { format: "png", scale: 2, background: "#ff0000" },
                new AbortController().signal,
            );
            const image = await createImageBitmap(blob);
            const canvas = document.createElement("canvas");
            canvas.width = image.width;
            canvas.height = image.height;
            const context = canvas.getContext("2d")!;
            context.drawImage(image, 0, 0);
            const pixel = [...context.getImageData(0, 0, 1, 1).data];
            const result = {
                type: blob.type,
                width: image.width,
                height: image.height,
                pixel,
            };
            image.close();
            return result;
        });
        expect(scaled.type).toBe("image/png");
        expect(scaled.height).toBe(640);
        expect(scaled.width).toBeGreaterThan(400);
        expect(scaled.pixel).toEqual([255, 0, 0, 255]);
    });
