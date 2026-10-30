# Rendering adapters

The PHP API produces portable, versioned JSON. An adapter translates it into a rendering engine and implements a small React lifecycle. ECharts ships by default; the optional bundled [shadcn adapter](shadcn.md) integrates application-owned Recharts 3 components; a separately distributed Syncfusion adapter can use the same PHP builders, datasets, authorization, filters and accessible/export frame. This repository does not include Syncfusion or its license.

## Two registrations, one manifest

An adapter owns a JSON manifest with its name, API version, manifest version, supported payload versions, dataset kinds, series/coordinate/encoding combinations, feature schemas, rendering modes and export formats.

Register the exact manifest in PHP:

```php
use Wtroiano\ChartBuilder\Adapters\AdapterRegistry;

app(AdapterRegistry::class)->registerFile(resource_path('charts/vendor/adapter-manifest.json'));
$builder->adapter('vendor-adapter');
```

Register its JavaScript entry before rendering:

```tsx
import { registerChartAdapter } from "@/vendor/chart-builder/core";
import { adapter } from "your-chart-adapter";
registerChartAdapter(adapter.name, adapter);
```

The core checks manifest/version agreement, validates payloads, checks required capabilities and named extensions, then loads the engine. Missing capabilities produce explicit errors. Adapters must not silently fall back to another family or discard required features.

## SDK and lifecycle

Depend on the public `@wtroiano/chart-builder-sdk` package, not application aliases. It exports types, JSON schemas, validation, capability checks, formatting and CSV helpers. SDK imports contain no Inertia or rendering-engine code.

A `ChartAdapter` exposes `name`, `apiVersion: 1`, `manifest`, `validate(chart)` and lazy `load()`. The loaded module exports `Component`, receiving `chart`, `context`, `onEvent`, `onError` and `onReady`. Context provides dimensions, theme/palette/tokens, locale/timezone, reduced-motion preference and optional `resolveExtension(kind, name)`.

The adapter handle requires `resize()`; `exportImage()` is optional. Report `onReady(null)` on disposal. Create engine instances in effects, handle StrictMode remounts, update in place, and remove listeners/observers on unmount.

Events carry chart name, snapshot ID and `origin: 'user'|'programmatic'`. Supported event forms are point activation, series visibility and viewport change. Datum references distinguish row, hierarchy/graph node, graph link and custom item identities. Do not turn programmatic updates into user navigation.

The independent fixture adapter demonstrates an engine-free alternative. The package test script packs the SDK, installs it into a separate consumer, and builds the fixture plus shared core without workspace aliases.

## ECharts options and extensions

`adapterOptions('echarts', [...])` exists on charts and series. Objects merge recursively, arrays replace, and null replaces the previous value. The contract forbids overriding managed data, IDs, encodings and coordinate definitions. Values must be JSON: no functions, executable strings, nonfinite numbers or prototype keys.

Register local JavaScript with `registerChartExtension('formatter'|'renderer'|'geography', name, value)`. PHP `extension()` declares required references. Custom format descriptors and `Series::renderer()` resolve registered functions; geographic assets resolve registered GeoJSON. A geographic projection resolves a named renderer object with the engine's projection functions.

ECharts' full adapter is lazy. For a smaller bundle, use `createModularEChartsAdapter(manifest, loadEngine)` and register only the ECharts modules needed by the restricted manifest. Register the same restricted manifest in PHP. The application owns the module list and engine upgrades.

## Versioning

The SDK package uses semver. API and payload schema versions are explicit integers. Additive optional wire fields can retain schema version 1; breaking changes require a new version. Generated schemas accept additive fields but still validate known discriminants and required fields. The `categoryKeys` row metadata and presentation extension resolver are additive version-1 fields. Release PHP, SDK and bundled manifest changes together.
