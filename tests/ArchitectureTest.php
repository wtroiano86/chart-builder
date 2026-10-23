<?php

declare(strict_types=1);

use Wtroiano\ChartBuilder\Aggregation\Measure;
use Wtroiano\ChartBuilder\Chart;
use Wtroiano\ChartBuilder\Charts\ChartConfiguration;
use Wtroiano\ChartBuilder\Commands\MakeChartCommand;
use Wtroiano\ChartBuilder\Contracts\ChartContext;
use Wtroiano\ChartBuilder\Coordinates\Coordinate;
use Wtroiano\ChartBuilder\Datasets\ResolvedDataset;
use Wtroiano\ChartBuilder\Exceptions\ChartException;
use Wtroiano\ChartBuilder\Support\ResourceBudget;

arch()->preset()->php();
// Public readonly value objects and Laravel's generator are intentional API boundaries.
arch()->preset()->strict()->ignoring([
    Chart::class, ChartConfiguration::class, MakeChartCommand::class, ChartContext::class,
    ResolvedDataset::class, Measure::class, Coordinate::class, ChartException::class, ResourceBudget::class,
]);
arch()->preset()->laravel();
arch()->preset()->security();
arch()->expect('Wtroiano\\ChartBuilder')->toUseStrictTypes();
arch()->expect('Wtroiano\\ChartBuilder')->toUseStrictEquality();
arch()->expect('Wtroiano\\ChartBuilder')->classes()->toBeFinal()->ignoring(Chart::class);
