# Getting started

Use PHP 8.5, Laravel 13, a working Inertia React application, and Node 22 or newer for frontend builds. The PHP package auto-discovers its service provider. It adds no routes.

## Install from this checkout

Until the first Composer/npm release, add a Composer path repository in the consuming application's composer.json. Change the path to this checkout:

```json
{
    "repositories": [
        {
            "type": "path",
            "url": "../Packages/chart-builder",
            "options": { "symlink": true }
        }
    ]
}
```

Then, in the application:

```sh
composer require wtroiano/chart-builder:@dev
php artisan vendor:publish --tag=chart-builder-react
php artisan vendor:publish --tag=chart-builder-config
php artisan make:chart RevenueChart
```

Build and pack the SDK from the package checkout:

```sh
npm ci
npm run build:sdk
mkdir -p tmp
npm pack --workspace=@wtroiano/chart-builder-sdk --pack-destination=tmp
```

Install that tarball in the application's frontend project and add ECharts:

```sh
npm install /absolute/path/to/chart-builder/tmp/wtroiano-chart-builder-sdk-0.1.0.tgz echarts@~6.1.0
```

## Install release 0.1.0

After the GitHub tag `v0.1.0` is published, install from its VCS repository:

```sh
composer config repositories.chart-builder vcs https://github.com/wtroiano86/chart-builder
composer require wtroiano/chart-builder:^0.1.0
php artisan vendor:publish --tag=chart-builder-react
```

Once the SDK is published to npm:

```sh
npm install @wtroiano/chart-builder-sdk@^0.1.0 echarts@~6.1.0
```

The SDK tarball supplied with the release can also be installed directly, using `npm install /path/to/wtroiano-chart-builder-sdk-0.1.0.tgz echarts@~6.1.0`. If the Composer package is later registered on Packagist, the custom VCS repository is unnecessary. This repository does not publish packages automatically.

Both packages begin at `0.1.0`; adapter API and payload schema versions remain `1`. Pin compatible `^0.1.0` ranges during initial development and review release notes before moving to another minor version.

Published React sources live under `resources/js/vendor/chart-builder`. If the app does not map `@` to `resources/js`, use relative imports. Keep its installed React and Inertia versions; do not install a second React copy.

## Return a result

```php
use App\Charts\RevenueChart;
use Illuminate\Http\Request;
use Inertia\Inertia;

Route::get('/reports', function (Request $request, RevenueChart $chart) {
    return Inertia::render('reports', [
        'revenueChart' => $chart->result($request),
    ]);
})->middleware('auth');
```

```tsx
import { Chart, type ChartResult } from "@/vendor/chart-builder";

export default function Reports({ revenueChart }: { revenueChart: ChartResult }) {
    return <Chart name="RevenueChart" propName="revenueChart" result={revenueChart} />;
}
```

The generated class initially uses its class name as the chart name. You can rename that stable identifier inside `definition()`; the React `name` must match it. The page prop name can differ.

Publish the optional full-page component with `chart-builder-react-page`. For an alternative renderer, publish `chart-builder-react-core` and import its `core` entry. See [adapters](adapters.md).

Publishing with `--force` replaces local source customizations. Review changes before updating customized components.
