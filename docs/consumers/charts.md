# Chart definitions

Use `ChartBuilder::make('stable-name')->build()` for an immutable configuration snapshot, or extend `Chart` and implement `definition(): ChartBuilder`. The builder clones its series, filters and provider configuration. Query providers clone query builders; closures are executed during resolution and may intentionally read fresh application state.

Use `result($request)` for an Inertia page prop. It contains failures within that chart. Use `resolve($request)` or `toArray()` when the caller should receive exceptions. Never put an unresolved chart directly into a dashboard prop when sibling chart failures must be isolated.

## Series and coordinates

`xAxis('month')` creates a Cartesian coordinate with category x and numeric y axes. `xAxis('period', 'time')` creates a time x axis. Cartesian series map `value('revenue')` to y automatically.

```php
use Wtroiano\ChartBuilder\ChartBuilder;
use Wtroiano\ChartBuilder\Datasets\Dataset;
use Wtroiano\ChartBuilder\Series\BarSeries;
use Wtroiano\ChartBuilder\Series\LineSeries;

$chart = ChartBuilder::make('sales')
    ->datasets(['sales' => Dataset::rows($rows)->key('id')])
    ->xAxis('month')
    ->series([
        BarSeries::make('actual')->dataset('sales')->value('actual')->currency('USD'),
        LineSeries::make('target')->dataset('sales')->value('target')->color('#d97706'),
    ])->build();
```

Named factories in `Wtroiano\ChartBuilder\Series` include Line, Area, StepLine, Bar, HorizontalBar, PictorialBar, Scatter, Bubble, EffectScatter, Pie, Donut, Rose, Funnel, Gauge, Radar, Heatmap, Boxplot, Candlestick, Tree, Treemap, Sunburst, Graph, Sankey, Chord, Parallel, ThemeRiver, Map, Lines and Custom (each ends in `Series`). Each returns the common `Series` builder. `Series::make('id', 'engine-family')` supports adapter-defined families.

Advanced mappings use `encode('role', ...$fields)`, `coordinate('id')` and `axis('role', 'axis-id')`. Declare axes with `Axis::make()` and coordinates with `Coordinate::cartesian()`, `polar()`, `radar()`, `geo()`, `calendar()`, `matrix()` or `parallel()`. The selected adapter manifest defines legal families, roles and coordinate combinations; unsupported requests fail before data access when possible.

`splitBy('region')` creates stable series IDs and item selections over one row dataset. Splitting is performed in PHP and respects the series limit. SQL category identity distinguishes a real category labelled Other from the computed remainder.

## Presentation and interactions

Chart options include `title()`, `description()`, `height()`, `theme('light'|'dark'|'system')`, `palette()`, `locale()`, `timezone()`, `legend()`, `tooltip()`, `animation()` and `renderingMode()`. Series support `color()`, `stack()`, `area()`, `smooth()`, `step()`, `radius()`, `symbolSize()`, `currency()`, `percent()` and `decimals()`.

`navigate('series', 'dataset', 'datum-id', '/reports/item')` defines an accessible link and point activation. Use stable dataset keys. `on('point-activate', 'handler-name')` references a local registered handler. Register callback handlers using `registerChartExtension('renderer', 'handler-name', callback)`. Navigation and callbacks never execute PHP-supplied JavaScript. See [adapters](adapters.md) for named formatters, custom rendering and engine options.
