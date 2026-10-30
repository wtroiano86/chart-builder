# Testing and quality checks

```sh
composer install
composer lint
composer test
composer test:docs
composer test:distribution
composer test:release
npm ci
npm run schemas
npm run check
npm run test:package
sh .github/scripts/test-install.sh
npx playwright install chromium
npm run test:browser
```

PHP checks include Pint, Rector, PHPStan max, architecture/behavior tests, 100% type coverage and exactly 100% production line coverage. Coverage requires Xdebug or PCOV. There are no coverage exclusions for implemented production behavior.

Frontend checks include TypeScript, Prettier, Vitest and production builds. Browser tests use Chromium, real Inertia clients, a development contract server, the family gallery, CSV downloads, concurrent filters, deferred data, denial clearing, narrow viewports and axe accessibility checks. The server simulates application endpoints; it does not establish Laravel route/policy integration by itself. The separate install smoke builds an actual Laravel consumer with published assets.

CI tests highest and lowest PHP dependencies, SQLite, MySQL 8.4, MariaDB 11.4 and PostgreSQL 17. Set `CHART_TEST_DB_DRIVER` (`mysql` or `pgsql`), `CHART_TEST_DB_HOST`, `CHART_TEST_DB_PORT`, `CHART_TEST_DB_DATABASE`, `CHART_TEST_DB_USERNAME` and `CHART_TEST_DB_PASSWORD` to run against a dedicated test database. Default is in-memory SQLite. Tests create/drop their fixture tables.

Frontend matrix: React 18/Inertia 2, React 19/Inertia 2 and React 19/Inertia 3. SDK packing tests use an isolated consumer with no workspace TypeScript aliases and verify an engine-free core bundle. `npm run schemas` must leave generated contracts unchanged after formatting.

For interactive checks, `npm run dev` serves `http://127.0.0.1:4174/demo`, `/charts`, `/gallery` and `/shadcn`. The shadcn gallery uses a PHP-generated fixture and an upstream MIT-licensed chart component fixture; browser checks cover all eleven presets, actual paths, formatted tooltips, updates, sizing, dark theme, CSV and denial clearing. Image export checks decode SVG/PNG downloads for every shadcn family and inspect pixels, styles, legend text and filtered dark-theme snapshots. The demo invokes `examples/demo.php` on each request and resolves the definitions in `examples/charts.php` through the package. Its six charts include real SQL aggregation against deterministic, in-memory SQLite sample data; filters rerun PHP and charts retain independent state. PHP example edits reload the preview. Set `CHART_PREVIEW_PHP` to an executable path if PHP is not on PATH. Both Composer and npm development dependencies must be installed. Browser checks cover this PHP bridge, filtered results, SVG export, dark theme and narrow layouts in addition to the transport fixtures. Browser artifacts live under `tmp/browser-results`. Inspect rendered data, not just canvas/SVG element presence.

Documentation checks validate local links/anchors, fences, PHP/JSON snippet syntax and skill metadata. They do not execute application-specific model examples. Archive checks require runtime, docs and Boost assets and reject development dependencies/fixtures.

The shadcn preview compiles its upstream component utilities with Tailwind 4, without applying Preflight resets to the other demos. Its browser checks verify actual legend swatch dimensions, tooltip padding/background/shadow, theme color changes, all four legend positions, distinct grouped-series colors and six rendered data points, so an unstyled component cannot pass merely by producing SVG paths.

## README screenshots

With the dependencies above installed, run `npm run dev` and leave it running. In a second terminal, run:

```sh
npx playwright install chromium
npm run screenshots
```

The capture script opens the live PHP demo with Chromium, waits for all six charts to render, and saves four PNGs under `docs/images`: the light and dark chart grids, the revenue chart with its filters, and the treemap. It uses a fixed viewport, locale, timezone, and deterministic sample data. Captures include the actual package controls and rendering without replacing data or styling. Review the images and commit them with the README so GitHub can display them without a running demo. These captures are updated explicitly; ordinary browser tests do not overwrite them.

## Boost smoke test

```sh
composer install --working-dir=.github/fixtures/boost --prefer-dist --no-interaction --no-scripts
php .github/scripts/test-boost.php .github/fixtures/boost
```

The fixture uses Boost 2.10.3 and writes only its disposable `.test-agent`, storage and cache directories. Never run that writer against a working application.
