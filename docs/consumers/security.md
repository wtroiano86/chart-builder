# Authorization and resource limits

Charts require authentication by default. A custom `authorize(fn (Request $request): bool => ...)` replaces that default, so include the desired authentication/policy check. `public()` intentionally permits anonymous access. Authorization runs before providers and cache reads.

Authorization does not add tenant constraints to application queries. Scope every query/provider and set the chart context scope for tenant or permission changes. Cache variation must include explicit scope and all fixed provider inputs.

Only application-owned PHP definitions select datasets, columns, measures, adapters and callbacks. URL input is limited to declared filters. JSON validation rejects executable values, prototype-related keys, NaN/infinity and unsafe integers. SQL identifiers are checked and values are bound. Navigation allows application-relative and HTTP(S) URLs; the renderer uses text/rich-text tooltips rather than executing payload HTML.

Default limits are 1,000 time buckets, 100 categories, 50 series, 10,000 normalized items, 64 dimensions, 100,000 scalar values, hierarchy depth 32 and 2 MiB serialized UTF-8 bytes. Raw custom items and accessible projections both count. Providers check consumption/expansion incrementally; final payload validation applies combined limits. General JSON nesting has bounded allowance for wire containers in addition to logical hierarchy depth.

Use `limits()` or configuration for an intentional change to a limit. Do not raise limits to avoid fixing an unbounded query. The database may still scan a large population: rate limiting, policies, query indexes and application request timeouts remain application responsibilities.

Unexpected failures return a generic message and a reference ID, while the underlying exception is reported to Laravel. Keep application logging configured appropriately. Known configuration errors are useful to the chart author and are bounded before being returned.
