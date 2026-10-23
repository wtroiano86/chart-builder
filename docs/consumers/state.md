# Filters, requests and outcomes

Filters live under `charts[name][field]`. This namespace leaves table-builder state, unrelated query parameters and sibling chart filters intact.

```php
use Wtroiano\ChartBuilder\Filters\Filter;

$builder->filters([
    Filter::dateRange()->default(['from' => '2026-01-01', 'until' => '2026-01-31']),
    Filter::interval()->default('month'),
    Filter::select('region', ['north' => 'North', 'south' => 'South'])->clearable(),
]);
```

Date controls submit calendar dates in the reporting timezone. The end date is inclusive in the form and normalized to an exclusive instant for queries. Select options are allowlisted. Multiselect values are bounded and validated. Unknown query keys are not echoed. Empty and omitted values have distinct reset/default behavior.

Each page uses one coordinator. It merges queued intents, serializes managed reloads, preserves newer edits, and rebases unacknowledged changes after unrelated page visits. Reset clears only that chart namespace. History navigation cancels outstanding work and restores the URL as the authoritative state. Request tokens reject late managed responses; snapshots identify point events.

## Result contract

Every outcome has schema version, chart name, request token and opaque context key.

| Status | Contents | Frame behavior |
| --- | --- | --- |
| ready | Validated chart payload | Render current data |
| invalid | Field errors, filter definitions, bounded input | Keep same-scope prior data with a stale indicator |
| error | Safe code/message, retryability, reference ID | Keep same-scope data only when retryable |
| denied | unauthenticated or forbidden | Immediately remove canvas, data, links and exports |

A first-load failure never has prior data. Context changes clear retained data even for retryable failures. Denial also wins over stale request tokens. Transport failures expose retry controls; retry uses the latest filter intent. Renderer/configuration failures are terminal for the affected chart.

The context key should change when authorization scope changes. Set `scope(fn (Request $request): string => ...)` to include tenant and any relevant permission version. It is an opaque HMAC value, not a route authorization mechanism.
