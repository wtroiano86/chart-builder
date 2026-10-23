<?php

declare(strict_types=1);

use Carbon\CarbonImmutable;
use Wtroiano\ChartBuilder\ChartBuilder;
use Wtroiano\ChartBuilder\Contracts\ChartContext;
use Wtroiano\ChartBuilder\Datasets\Dataset;
use Wtroiano\ChartBuilder\Series\LineSeries;
use Wtroiano\ChartBuilder\Support\ResourceBudget;
use Wtroiano\ChartBuilder\Tests\TestCase;

pest()->extend(TestCase::class)->in('Feature');

function chartContext(array $limits = [], array $state = []): ChartContext
{
    return new ChartContext(request(), $state, 'en-US', 'UTC', CarbonImmutable::parse('2026-10-23'), 'tenant-one', new ResourceBudget([...config('chart-builder.limits'), ...$limits]));
}

function revenueChart(): ChartBuilder
{
    return ChartBuilder::make('revenue')->title('Revenue')
        ->data(Dataset::rows([
            ['id' => 'jan', 'month' => 'Jan', 'revenue' => 12500],
            ['id' => 'feb', 'month' => 'Feb', 'revenue' => 14800],
        ])->key('id'))
        ->xAxis('month')->series([LineSeries::make('revenue')->value('revenue')->currency('USD')]);
}
