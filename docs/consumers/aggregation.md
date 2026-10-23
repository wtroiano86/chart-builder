# SQL aggregation

Query providers aggregate in SQL and preserve Eloquent scopes, connection and application constraints. Scope every source query to its permitted tenant/population.

```php
use App\Models\Order;
use Wtroiano\ChartBuilder\Datasets\Dataset;

$data = Dataset::query(fn () => Order::query()->where('tenant_id', $tenantId))
    ->dateColumn('paid_at')
    ->between('2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z')
    ->timezone('America/New_York')
    ->perMonth()
    ->groupBy('region')
    ->sum('total', 'revenue')
    ->count(as: 'orders')
    ->average('total', 'average')
    ->fillMissing(['revenue' => 0, 'orders' => 0]);
```

Other measures are `min()`, `max()` and `distinctCount()`. Multiple measures share one grouped SQL query. Category discovery/ranking and an optional Other group use separate bounded grouped queries. No raw fact rows are loaded into PHP.

Time intervals are minute, hour, day, week, month, quarter and year. `weekStartsOn(1)` uses Monday. Time ranges are half-open: from is included and until is excluded. Inputs and database timestamps represent UTC instants; reporting boundaries are planned in the requested timezone. Day/month boundaries follow the calendar, and repeated DST hours retain different instant identities. Bucket metadata marks partial intervals.

Validated filter state named `from`, `until` and `interval` overrides configured values. A time query requires an explicit bounded range, either in state or in `between()`. Store UTC timestamps; do not pass local timestamps as if they were UTC.

## Categories and filling

`top(5, by: 'revenue', other: true)` ranks over the whole filtered range. Ties use grouping columns. Null ranking values sort last on all supported drivers. Other recomputes all measures over excluded facts; averages and distinct counts are not sums of group aggregates.

`categories([['region' => 'North']])` augments the observed category domain for filling. It cannot be combined with top ranking. Filling applies only to absent bucket/category rows. Existing null aggregate values remain null. Unspecified measure defaults are null. Planned dense expansions must fit the shared limits before allocation.

## Precision and supported sources

SQL numeric results become JSON numbers; decimal strings are also retained as display text. `scale(2)` explicitly rounds normalized numeric values. Integers beyond JavaScript safe precision are rejected. Transform large measures in an application provider (for example into millions), or expose exact amounts as strings in an accessible projection.

SQLite, MySQL 8.4, MariaDB 11.4 and PostgreSQL 17 are covered by the test matrix. The portable planner emits bound CASE expressions for timezone buckets, avoiding database timezone-table dependencies. Column and measure identifiers come from trusted PHP code and are validated and quoted. User input cannot select arbitrary columns or expressions.

Pre-grouped/projected queries, unions, limits and offsets are rejected. Use a prepared provider for those cases. Index the scoped date column and inspect query plans for large fact tables: bounded chart output does not guarantee an inexpensive database scan.
