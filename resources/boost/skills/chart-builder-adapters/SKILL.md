---
name: chart-builder-adapters
description: Build or integrate rendering adapters using Chart Builder's public SDK, capability manifests, lazy loading, lifecycle, events and image exports.
---

Read vendor/wtroiano/chart-builder/docs/consumers/adapters.md and [the lifecycle checklist](references/lifecycle.md).

Keep the PHP-defined API portable. Register the same versioned manifest in PHP and JavaScript. Unsupported combinations must produce explicit errors before rendering, and before provider work where possible.

Import only the public @wtroiano/chart-builder-sdk and peer React in the adapter contract. Load the rendering engine lazily. Use stable datum references and distinguish user events from programmatic updates. Require typed projections for custom data.

The bundled optional shadcn adapter uses createShadcnAdapter(() => import("@/components/ui/chart")), Recharts 3 and the application’s ChartContainer, ChartTooltipContent and ChartLegendContent. Read vendor/wtroiano/chart-builder/docs/consumers/shadcn.md. Shadcn manifest 1.1.0 supports SVG (scale 1) and PNG (positive finite scale) exports in SVG mode. Respect the documented pixel limits, cancel stale exports, and keep both manifests synchronized. Do not assume full ECharts feature parity.

Declare supported rendering/export combinations accurately. Keep named formatters, renderers and geography assets in local JavaScript; PHP sends names and JSON parameters. Verify the adapter in an independent consumer without application import aliases.

For shadcn styling, ensure the application compiles the generated chart component's Tailwind utilities and defines the shadcn theme tokens. The component module alone does not include CSS. An explicit PHP palette overrides the application's chart color tokens; palette([]) selects --chart-1 through --chart-5. Style the shared .cb-* frame separately to match the application.

Keep the published adapter's shadcn.css with its rendering module and preserve ChartLegendContent className forwarding for side legends. PHP 0.1.1 uses the unchanged SDK 0.1.0; use the documented GitHub SDK tarball until npm publication.
