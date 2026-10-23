<?php

declare(strict_types=1);

namespace Wtroiano\ChartBuilder\Providers;

use Illuminate\Support\ServiceProvider;
use Wtroiano\ChartBuilder\Adapters\AdapterRegistry;
use Wtroiano\ChartBuilder\ChartRegistry;
use Wtroiano\ChartBuilder\Commands\MakeChartCommand;

final class ChartBuilderServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(dirname(__DIR__, 2).'/config/chart-builder.php', 'chart-builder');
        $this->app->singleton(AdapterRegistry::class);
        $this->app->singleton(ChartRegistry::class);
    }

    public function boot(): void
    {
        if ($this->app->runningInConsole()) {
            $this->commands([MakeChartCommand::class]);
        }

        $root = dirname(__DIR__, 2);
        $target = resource_path('js/vendor/chart-builder');
        $this->publishes([$root.'/config/chart-builder.php' => config_path('chart-builder.php')], 'chart-builder-config');
        $this->publishes([$root.'/resources/react' => $target], 'chart-builder-react');
        $this->publishes([$root.'/resources/react/core' => $target.'/core'], 'chart-builder-react-core');
        $this->publishes([$root.'/resources/react/adapters/echarts' => $target.'/adapters/echarts'], 'chart-builder-echarts');
        $this->publishes([$root.'/resources/stubs/chart-builder-page.tsx.stub' => resource_path('js/pages/vendor/chart-builder.tsx')], 'chart-builder-react-page');
    }
}
