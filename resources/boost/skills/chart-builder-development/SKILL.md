---
name: chart-builder-development
description: Define and troubleshoot PHP charts, prepared datasets, SQL aggregation, authorization and caching in a Laravel application using Chart Builder.
---

Read vendor/wtroiano/chart-builder/docs/consumers/charts.md, data.md, aggregation.md and security.md.

1. Find the application's chart definition and permitted data population. Use make:chart for a reusable Chart subclass or ChartBuilder for an inline definition.
2. Choose prepared rows/hierarchy/graph/custom projections or Dataset::query for fact aggregation. Declare empty/nullable dataset dimensions explicitly.
3. Authorize chart access and scope every query/provider to the current tenant. Cache only with explicit scope and all fixed inputs in variation.
4. Use stable string IDs, typed numeric measures, bounded ranges and explicit missing-data defaults. Retain nulls and safe numeric precision.
5. Return result(request()) for each dashboard prop so one failure does not discard siblings.
6. Verify allowed/denied outcomes, valid/invalid filters, provider limits and representative data before completing the change.

Do not invent chart routes, bypass policies, accept arbitrary SQL from filters, or install repository development tooling into the consumer app.
