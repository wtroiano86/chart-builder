# Shadcn adapter

The optional `shadcn` adapter renders portable PHP charts with Recharts and your application's shadcn chart components. ECharts remains the default. The adapter uses API/payload version 1 and manifest version `1.1.0`; PHP discovers its bundled manifest automatically.

## Install and register

Shadcn requires PHP package `0.1.1` or later. Follow the [release installation](getting-started.md#install-release-011) or use the [local checkout installation](getting-started.md#install-from-this-checkout). The SDK contract is unchanged and remains compatible with `0.1.0`.

Set up [shadcn/ui](https://ui.shadcn.com/docs/installation) in your application, then add its [Recharts 3 chart component](https://ui.shadcn.com/docs/components/chart). Existing Recharts 2 chart components need the upstream v3 migration.

```sh
php artisan vendor:publish --tag=chart-builder-react-core
php artisan vendor:publish --tag=chart-builder-shadcn
npx shadcn@latest add chart
npm install https://github.com/wtroiano86/chart-builder/releases/download/v0.1.0/wtroiano-chart-builder-sdk-0.1.0.tgz recharts@~3.10.1
```

Install `react-is` at the same version as your application's React. For example, React 18.3.1 uses `npm install react-is@18.3.1`; React 19.3.1 uses `npm install react-is@19.3.1`. The adapter supports React 18/Inertia 2 and React 19/Inertia 2 or 3.

The SDK release tarball above is available now. Use the npm package name `@wtroiano/chart-builder-sdk@^0.1.0` only after it is published to npm, or install a locally packed SDK tarball as described in Getting started.

Register once, before mounting charts, in your application's JavaScript entry:

```tsx
import { registerChartAdapter } from "@/vendor/chart-builder/core";
import { createShadcnAdapter } from "@/vendor/chart-builder/adapters/shadcn";

registerChartAdapter(
    "shadcn",
    createShadcnAdapter(() => import("@/components/ui/chart")),
);
```

The lazy module must export `ChartContainer`, `ChartTooltipContent`, and `ChartLegendContent`. The adapter's structural `ShadcnChartComponents` type accepts the generated components. The application owns their styling, Tailwind configuration, and upgrades. The adapter supplies config labels, normalized values, sizing, formatting, and theme context. Explicit series colors and the PHP palette take precedence; an empty palette uses `--chart-1` through `--chart-5`. Avoid importing the application's chart module eagerly if you want Recharts to stay in a lazy chunk.

Select the adapter in PHP:

```php
use Wtroiano\ChartBuilder\ChartBuilder;
use Wtroiano\ChartBuilder\Datasets\Dataset;
use Wtroiano\ChartBuilder\Series\BarSeries;

$chart = ChartBuilder::make('revenue')
    ->adapter('shadcn')
    ->data(Dataset::rows([
        ['id' => 'jan', 'month' => 'Jan', 'revenue' => 12500],
        ['id' => 'feb', 'month' => 'Feb', 'revenue' => 14800],
    ])->key('id'))
    ->xAxis('month')
    ->series([BarSeries::make('revenue')->value('revenue')->currency('USD')])
    ->build();

return Inertia\Inertia::render('reports', ['revenueChart' => $chart->result(request())]);
```

Use the shared core component in the page:

```tsx
import { Chart, type ChartResult } from "@/vendor/chart-builder/core";

export default function Reports({ revenueChart }: { revenueChart: ChartResult }) {
    return <Chart name="revenue" propName="revenueChart" result={revenueChart} />;
}
```

Authorization, datasets, SQL aggregation, filters, accessible tables, CSV, and denial clearing use the shared lifecycle. The default `chart-builder-react` publish tag includes ECharts; it does not publish the optional shadcn sources or require Recharts. Applications using both adapters can publish both tags and register shadcn alongside the default entry.

## Supported subset

The adapter includes a small scoped legend stylesheet in its lazy rendering module. Keep the published `shadcn.css` beside `rendering.tsx`, and preserve `className` forwarding if you customize `ChartLegendContent`. Top/bottom legends wrap; left/right legends stack vertically. Axis labels and grids use shadcn theme variables with shared theme-token fallbacks. Tooltips retain formatted values, labels and color indicators.

Palette slots follow current series/row identities across updates and reordering, using unused slots before repeating them. Pie colors are assigned against the full dataset so `itemIds` filtering does not recolor remaining slices. Colors repeat when there are more identities than palette entries; explicit series colors still take precedence.

| PHP series or feature | Support |
| --- | --- |
| Line, area, step-line, smooth line | SVG; area series can stack |
| Bar, horizontal bar | Grouped and stacked |
| Mixed line/area/bar | Shared axes and orientation |
| Pie, donut | One row-based series, non-negative values |
| Formatting | Shared number, currency, percent, date and registered custom formatters; row display overrides in tooltips |
| Interaction | Point activation with chart/snapshot/series and original row identity |
| Export | SVG and PNG images; shared CSV and accessible table |

Cartesian charts use one full-size coordinate, one category/value/time x axis, and one value y axis. Series share those axes and orientation; bars and areas use separate stack groups. Horizontal orientation is for bars. Rows align by x value (or `categoryKeys` for category axes), including split series and separate datasets. X values must be unique within each series; numeric/time x values must be finite and non-null. Null y values remain gaps; zero remains zero. Category domains order rows and retain empty declared categories. Pie and donut charts have no axes; radius fractions map to Recharts radii.

Multiple grids/axes, logarithmic axes, radar/radial-bar, scatter, geographic, hierarchical and custom-renderer charts, viewport events, legend visibility events, raw `adapterOptions('shadcn', ...)`, JPEG and PDF exports are unsupported. Use ECharts for broader chart and layout support. Families, modes and required features fail in PHP before provider work; additional layout/data restrictions fail in the JavaScript adapter's validation before its lazy loader runs. No unsupported chart silently changes family.

Run `npm run dev` in the package checkout and visit `/shadcn` for eleven examples using the real PHP fixture and a licensed upstream shadcn component fixture. The fixture is development-only; publishing the adapter never overwrites your application's UI components.

## Styling and the shadcn examples

The adapter renders through your shadcn components; their Tailwind utilities and theme CSS must be compiled by your application. Importing `chart.tsx` alone does not supply its styles. Shadcn's chart examples also compose cards, headings, spacing and chart-specific presentation; selecting the adapter does not copy an entire example page. Chart Builder keeps its shared controls and accessible data table.

If charts look unstyled, check that Tailwind scans your generated `components/ui/chart.tsx` and that your main stylesheet includes the shadcn theme tokens (`--background`, `--foreground`, `--muted`, `--muted-foreground`, `--border`, and `--chart-1` through `--chart-5`). Tailwind 4 needs the corresponding `@theme inline` color mappings. See [shadcn theming](https://ui.shadcn.com/docs/theming) and [Tailwind source detection](https://tailwindcss.com/docs/detecting-classes-in-source-files). A legend without visible color swatches or a tooltip without padding/background is a useful sign that these utilities are missing.

The default PHP palette takes precedence over `--chart-*`; call `->palette([])` to use your shadcn chart colors, or supply an explicit palette. Match your application's dark-mode class to the selected chart theme. The shared frame uses scoped `.cb-*` classes and `--cb-*` variables; customize those separately to match your application's card and toolbar styling. The local `/shadcn` gallery demonstrates a compiled Tailwind 4 stylesheet, light/dark theme tokens and six months of sample data; the two-row contract fixture is intentionally smaller.

## Image export

The shared toolbar exposes **Download SVG** and **Download PNG** after the adapter mounts. Images contain the current chart graphic and legend text, color swatches and inline SVG icons. They exclude hover tooltips, filters, toolbar buttons and the data table. Updates, access denial, scope changes and disposal discard pending downloads.

The adapter copies the rendered SVG, resolves CSS variables and computed styles, and preserves local clip paths. PNG uses that same vector snapshot. A null background selects the nearest non-transparent chart/container background, so the default light and dark exports match the page. Pass an explicit CSS color or `transparent` through the adapter handle to override it.

```tsx
import type { ChartAdapterHandle } from "@wtroiano/chart-builder-sdk";

async function exportLargePng(handle: ChartAdapterHandle) {
    return handle.exportImage?.({ format: "png", scale: 2, background: "#ffffff" });
}
```

SVG requires scale 1. PNG accepts positive finite pixel ratios, with a maximum of 16,384 pixels per side and 16,777,216 total pixels; limits are checked before canvas allocation. Unsupported formats, invalid sizes and unavailable canvases fail explicitly. Temporary object URLs are revoked after rasterization or failure.

Exports wait for loaded fonts and preserve font-family/style declarations, but do not embed web-font files; use system fonts for portable typography. Custom HTML legend decorations are not reproduced beyond text and background swatches. Linked SVG resources, external images and SVG `foreignObject` content fail explicitly. These limits keep the exported image independent of application URLs and CSS; browsers also [restrict external resources in SVG images](https://developer.mozilla.org/en-US/docs/Web/SVG/Guides/SVG_as_an_image).

Update the PHP package and republish `chart-builder-shadcn` assets together: manifest `1.1.0` advertises SVG and PNG exports in SVG rendering mode. Review any customized published sources before overwriting them.
