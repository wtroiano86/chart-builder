# Architecture

The PHP package and TypeScript SDK share schema version 1. The default rendering adapter is a separate lazy layer.

1. `ChartBuilder` snapshots configuration into `Charts\ConfiguredChart`; reusable `Chart` subclasses return a builder.
2. `Charts\ChartResolver` authorizes, resolves allowlisted filters, checks adapter requirements, builds context, resolves providers, expands split series and validates the full payload.
3. `Datasets` handles prepared shapes, custom callbacks, optional caching and bounded SQL aggregation. `Datasets\QueryDataset` configures aggregation and checks expansion budgets. Its internal collaborators, `Aggregation\GroupedQuery` and `Aggregation\QueryResultNormalizer`, handle bounded SQL queries and row normalization respectively. `Aggregation\BucketPlanner` plans timezone boundaries; `Database\AggregationDialect` emits quoted SQL.
4. `Payloads\ChartResult` contains ready/invalid/error/denied states. `Payloads\ChartPayload` is the strict renderable result.
5. `packages/sdk` provides engine-independent types, JSON schemas, validation and helpers.
6. `resources/react/core` owns Inertia coordination, state, filters, accessible data and export framing. `ChartCanvas` owns lazy loading, SSR, size/theme context and the adapter boundary.
7. `resources/react/adapters/echarts` translates the portable contract and owns ECharts lifecycle/events/exports.
8. `resources/react/adapters/shadcn` lazily loads Recharts and application-owned shadcn chart components for its declared row-based subset.

The service provider publishes sources and registers fresh chart factories and adapter manifests. It exposes no HTTP endpoints. Applications own routing, authorization policies, facts, provider dependencies and any custom renderer assets.

The separate fixture adapter imports the public SDK and React only. It demonstrates that prepared data and shared UI work without ECharts. Generated schemas are committed in both PHP resources and the npm package; `npm run schemas` regenerates them from SDK types.

[Specification](specification.md) records design intent. Consumer docs and tests resolve concrete API choices. Tests preserve a real PHP result as the frontend fixture, compare independently generated schemas, and validate installation/build boundaries.
