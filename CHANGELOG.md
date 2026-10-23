# Changelog

## 0.1.0

Initial development release of `wtroiano/chart-builder` and `@wtroiano/chart-builder-sdk`.

### Included

- Fluent PHP chart definitions and reusable chart classes for Laravel 13 and PHP 8.5.
- Prepared rows, hierarchies, graphs, and series datasets, plus SQL aggregation for SQLite, MySQL, MariaDB, and PostgreSQL.
- Lazy ECharts rendering with 36 gallery examples, including Cartesian, mixed, hierarchical, geographic, financial, and relationship charts.
- Date ranges, intervals, selects and multi-selects with validation, URL state, and coordinated Inertia partial updates.
- Shared React controls, light and dark themes, accessible data tables, CSV downloads, and adapter-supported PNG/SVG exports.
- Authorization before data/cache access, scoped caching, resource limits, and per-chart error outcomes.
- Public adapter SDK, schemas and capability manifests for independently developed rendering adapters.
- Asset publishing, `make:chart`, Laravel Boost resources, consumer documentation, a live PHP demo, and real chart screenshots.

### Compatibility

- React 18 with Inertia 2, or React 19 with Inertia 2 or 3.
- Bundled adapter: ECharts 6.1.x; SDK dependency: `^0.1.0`.
- Adapter API and payload schema: version `1`. ECharts capability manifest: `1.0.0`, versioned independently of the packages.
- Patch releases in `0.1.x` preserve compatibility. Breaking changes may be introduced in a later minor release while the packages remain below `1.0`.

Syncfusion requires a separate adapter and license. Geographic charts require registered geography assets; custom chart extensions require application renderers. See [installation](docs/consumers/getting-started.md) and [adapter documentation](docs/consumers/adapters.md).
