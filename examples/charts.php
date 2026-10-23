<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Wtroiano\ChartBuilder\Axes\Axis;
use Wtroiano\ChartBuilder\ChartBuilder;
use Wtroiano\ChartBuilder\Contracts\ChartContext;
use Wtroiano\ChartBuilder\Datasets\Dataset;
use Wtroiano\ChartBuilder\Datasets\ResolvedDataset;
use Wtroiano\ChartBuilder\Filters\Filter;
use Wtroiano\ChartBuilder\Series\BarSeries;
use Wtroiano\ChartBuilder\Series\DonutSeries;
use Wtroiano\ChartBuilder\Series\LineSeries;
use Wtroiano\ChartBuilder\Series\ScatterSeries;
use Wtroiano\ChartBuilder\Series\TreemapSeries;

return [
    'revenueChart' => ChartBuilder::make('revenue')
        ->title('Revenue over time')
        ->description('Change the date range, interval or region to rerun the SQL aggregation.')
        ->data(Dataset::using(function (ChartContext $context): ResolvedDataset {
            $query = DB::table('demo_orders');
            if ($context->state['region'] !== null) {
                $query->where('region', $context->state['region']);
            }

            return Dataset::query($query)->dateColumn('paid_at')->sum('total', 'revenue')
                ->fillMissing(['revenue' => 0])->resolve($context);
        }))
        ->filters([
            Filter::dateRange()->default(['from' => '2026-01-01', 'until' => '2026-12-31']),
            Filter::interval(['month', 'quarter', 'year'])->default('month'),
            Filter::select('region', ['North' => 'North', 'South' => 'South', 'East' => 'East', 'West' => 'West'], 'Region')->clearable(),
        ])
        ->xAxis('period', 'time')
        ->format('date', ['kind' => 'date', 'dateStyle' => 'short', 'timeStyle' => null])
        ->format('money', ['kind' => 'currency', 'currency' => 'USD', 'decimals' => 0])
        ->axes([Axis::make('x', 'time', 'bottom')->format('date'), Axis::make('y')->format('money')])
        ->series([LineSeries::make('revenue')->label('Revenue')->value('revenue')->area()->smooth()->currency('USD')]),

    'regionalChart' => ChartBuilder::make('regions')
        ->title('Revenue by region')
        ->description('One SQL dataset, split into four stacked series in PHP.')
        ->data(Dataset::query(DB::table('demo_orders'))->dateColumn('paid_at')
            ->between('2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z')
            ->perQuarter()->groupBy('region')->sum('total', 'revenue'))
        ->xAxis('period')
        ->format('date', ['kind' => 'date', 'dateStyle' => 'short', 'timeStyle' => null])
        ->axes([Axis::make('x', 'category', 'bottom')->format('date'), Axis::make('y')])
        ->series([BarSeries::make('region')->value('revenue')->splitBy('region')->stack()->currency('USD')]),

    'productChart' => ChartBuilder::make('products')
        ->title('Product mix')
        ->description('A donut chart backed by SQL revenue totals for each product.')
        ->data(Dataset::query(DB::table('demo_orders'))->groupBy('product')->sum('total', 'revenue'))
        ->series([DonutSeries::make('product')->radius(0.4, 0.7)->adapterOptions('echarts', ['center' => ['50%', '45%']])->label('Product revenue')->value('revenue')->encode('label', 'product')->currency('USD')]),

    'targetChart' => ChartBuilder::make('targets')
        ->title('Actual vs target')
        ->description('Prepared rows shared by a bar series and a line series.')
        ->data(Dataset::rows([
            ['id' => 'jan', 'month' => 'Jan', 'actual' => 28400, 'target' => 30000],
            ['id' => 'feb', 'month' => 'Feb', 'actual' => 35200, 'target' => 32000],
            ['id' => 'mar', 'month' => 'Mar', 'actual' => 31800, 'target' => 34000],
            ['id' => 'apr', 'month' => 'Apr', 'actual' => 42600, 'target' => 36000],
            ['id' => 'may', 'month' => 'May', 'actual' => 39800, 'target' => 38000],
            ['id' => 'jun', 'month' => 'Jun', 'actual' => 48700, 'target' => 40000],
        ])->key('id'))
        ->xAxis('month')
        ->series([
            BarSeries::make('actual')->label('Actual')->value('actual')->currency('USD'),
            LineSeries::make('target')->label('Target')->value('target')->currency('USD')->color('#d97706'),
        ]),

    'scatterChart' => ChartBuilder::make('engagement')
        ->title('Engagement and retention')
        ->description('Monthly sessions (x) against retention percentage (y), from prepared rows.')
        ->data(Dataset::rows([
            ['id' => 'a', 'sessions' => 4, 'retention' => 38],
            ['id' => 'b', 'sessions' => 7, 'retention' => 49],
            ['id' => 'c', 'sessions' => 9, 'retention' => 45],
            ['id' => 'd', 'sessions' => 12, 'retention' => 64],
            ['id' => 'e', 'sessions' => 14, 'retention' => 72],
            ['id' => 'f', 'sessions' => 18, 'retention' => 68],
            ['id' => 'g', 'sessions' => 21, 'retention' => 85],
            ['id' => 'h', 'sessions' => 25, 'retention' => 94],
        ])->key('id'))
        ->xAxis('sessions', 'value')
        ->axes([Axis::make('x', 'value', 'bottom'), Axis::make('y')->range(0, 100)])
        ->series([ScatterSeries::make('accounts')->label('Accounts')->value('retention')->symbolSize(16)]),

    'hierarchyChart' => ChartBuilder::make('portfolio')
        ->title('Portfolio breakdown')
        ->description('A prepared hierarchy, with a shared accessible table and CSV export.')
        ->data(Dataset::hierarchy([
            ['id' => 'software', 'label' => 'Software', 'children' => [
                ['id' => 'platform', 'label' => 'Platform', 'value' => 65000],
                ['id' => 'analytics', 'label' => 'Analytics', 'value' => 38000],
                ['id' => 'integrations', 'label' => 'Integrations', 'value' => 24000],
            ]],
            ['id' => 'services', 'label' => 'Services', 'children' => [
                ['id' => 'consulting', 'label' => 'Consulting', 'value' => 42000],
                ['id' => 'support', 'label' => 'Support', 'value' => 18000],
            ]],
        ]))
        ->legend(false)
        ->series([TreemapSeries::make('portfolio')->adapterOptions('echarts', ['breadcrumb' => ['show' => false]])->label('Portfolio')->currency('USD')]),
];
