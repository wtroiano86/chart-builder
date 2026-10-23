# Datasets

Prepared datasets and query aggregation are equally supported. Choose prepared data for external APIs, domain calculations, pre-aggregated records and unusual chart shapes. Choose SQL aggregation for measures over a database population.

## Rows

```php
use Wtroiano\ChartBuilder\Datasets\Dataset;

$data = Dataset::rows($rows)->key('id')
    ->dimension('month', 'string', false, 'Month')
    ->dimension('revenue', 'number', true, 'Revenue');
```

Without explicit dimensions, types are inferred from the first row. Declare dimensions for empty datasets and when the first value may be null. Supported types are string, number, boolean, date (`YYYY-MM-DD`) and datetime (UTC ISO instant ending in Z). Null remains null. Numeric strings are not implicitly coerced by prepared rows.

Keys must be unique, nonempty strings. With no `key()`, generated `row:0` identities are snapshot-local. Stable keys enable interaction reconciliation and drill-down links.

Reserved input metadata includes `__display` (exact string display values), `__bucket` (time bucket bounds), and `__categoryKeys` (stable category identities emitted by SQL aggregation). Normalized values are typed; display strings do not replace measure arithmetic.

## Hierarchy, graph and custom items

```php
$tree = Dataset::hierarchy([
    ['id' => 'root', 'label' => 'Total', 'children' => [
        ['id' => 'a', 'label' => 'A', 'value' => 20],
    ]],
]);

$graph = Dataset::graph(
    [['id' => 'a', 'label' => 'A'], ['id' => 'b', 'label' => 'B']],
    [['id' => 'a-b', 'source' => 'a', 'target' => 'b', 'value' => 10]],
);

$custom = Dataset::series(
    [['id' => 'point', 'value' => [12, 20]]],
    Dataset::rows([['id' => 'point', 'x' => 12, 'y' => 20]])->key('id'),
    adapter: 'echarts',
);
```

Hierarchy node IDs are unique across the tree. Graph links have their own unique ID namespace and must reference existing nodes. Custom items require a typed row projection with the same ordered IDs for accessible data and CSV; raw items and projection both count against budgets. Adapter-specific custom data explicitly declares its adapter.

## Providers and caching

Implement `DatasetProvider::resolve(ChartContext $context): ResolvedDataset`, or pass a closure to `Dataset::using()`. A closure may return normalized `ResolvedDataset` or iterable prepared rows. Context includes the request, validated state, reporting locale/timezone, resolution instant, scope key and shared resource budget. Consume iterables incrementally and account for expansion before allocating.

```php
use Wtroiano\ChartBuilder\Contracts\ChartContext;

$provider = Dataset::using(fn (ChartContext $context) => fetchReport($context->state));
$cached = Dataset::cached(
    $provider,
    namespace: 'sales',
    ttl: 300,
    variation: ['scope' => $tenant->id, 'report-version' => 2],
);
```

Caching is opt-in and requires explicit scope variation. Keys additionally include chart scope, validated state, timezone, locale and cache version. Include every fixed provider input that changes results (for example a fixed date range, currency, permissions or reporting mode) in variation/version. Source queries and closures are not fingerprinted. Authorization runs before cache access. `forget($context)` invalidates the matching entry. Do not cache rendered envelopes, permission failures or invalid input.
