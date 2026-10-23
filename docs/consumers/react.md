# React integration

The full entry `@/vendor/chart-builder` registers ECharts and exports shared components. Engine code loads only when a chart is mounted in the browser. The `core` entry has no engine imports and supports third-party adapters.

`Chart` requires `name`, `propName` and optional `result`. Its name must match the PHP envelope. The prop name identifies the top-level Inertia prop to reload. Distinct chart components on one page must have unique names.

```tsx
<Chart
    name="revenue"
    propName="revenueChart"
    result={revenueChart}
    reloadProps={["reportTotals"]}
    pollInterval={30_000}
    onPointClick={(event) => console.log(event.datum)}
/>
```

Polling runs only while the document is visible and the chart is idle. Minimum interval is one second. Optional slots are `toolbar`, `emptyState`, `loadingState` and `errorState(error)`; callbacks include `onError` and `onReady`. `ChartPage` provides a full-page frame. `ChartCanvas` renders a validated payload without Inertia filters/export framing.

The canvas observes its container, waits for nonzero width, responds to theme/reduced-motion changes, and disposes adapters on unmount. SSR emits a placeholder and accessible data without importing the engine. Updates preserve the mounted renderer when adapter identity is unchanged. ECharts keeps local legend selection and viewport percentages on compatible updates; application filters remain separate server state.

## Deferred results

```php
return Inertia\Inertia::render('reports', [
    'revenueChart' => Inertia\Inertia::defer(fn () => $chart->result(request())),
]);
```

Allow `undefined` for a deferred prop and mount the chart immediately so the error bridge can observe its request. Use `result()` inside the deferred callback to contain provider/authorization failures. Transport-level HTTP/network failures are bridged from Inertia events. Global failures with no request identity can only be associated with currently pending groups; the application retains control of Inertia's global error handling.

[State and outcomes](state.md) explains retained data and the page coordinator. [Exports](exports.md) covers accessible alternatives.
