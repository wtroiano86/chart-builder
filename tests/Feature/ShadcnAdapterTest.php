<?php

declare(strict_types=1);

use Illuminate\Support\ServiceProvider;
use Wtroiano\ChartBuilder\Adapters\AdapterRegistry;
use Wtroiano\ChartBuilder\ChartBuilder;
use Wtroiano\ChartBuilder\Datasets\Dataset;
use Wtroiano\ChartBuilder\Providers\ChartBuilderServiceProvider;
use Wtroiano\ChartBuilder\Series\AreaSeries;
use Wtroiano\ChartBuilder\Series\BarSeries;
use Wtroiano\ChartBuilder\Series\DonutSeries;
use Wtroiano\ChartBuilder\Series\HorizontalBarSeries;
use Wtroiano\ChartBuilder\Series\LineSeries;
use Wtroiano\ChartBuilder\Series\PieSeries;
use Wtroiano\ChartBuilder\Series\Series;
use Wtroiano\ChartBuilder\Series\StepLineSeries;
use Wtroiano\ChartBuilder\Support\Json;

it('ships matching shadcn manifests and publishes the optional adapter separately', function (): void {
    $manifest = resolve(AdapterRegistry::class)->get('shadcn');
    expect($manifest)->toBe(Json::read(dirname(__DIR__, 2).'/resources/react/adapters/shadcn/manifest.json'));
    expect($manifest['manifestVersion'])->toBe('1.1.0');
    expect($manifest['exports'])->toBe([['format' => 'svg', 'modes' => ['svg']], ['format' => 'png', 'modes' => ['svg']]]);

    $provider = ChartBuilderServiceProvider::class;
    $paths = ServiceProvider::pathsToPublish($provider, 'chart-builder-shadcn');
    expect(array_values($paths))->toBe([resource_path('js/vendor/chart-builder/adapters/shadcn')]);
    expect(array_values(ServiceProvider::pathsToPublish($provider, 'chart-builder-react')))
        ->not->toContain(resource_path('js/vendor/chart-builder/adapters/shadcn'), resource_path('js/vendor/chart-builder'));
});

it('resolves shadcn cartesian presets using the portable PHP contract', function (Series $series): void {
    $result = revenueChart()->adapter('shadcn')->series([$series->value('revenue')])->build()->result(request())->toArray();
    expect($result['status'])->toBe('ready')->and($result['chart']['adapter']['name'])->toBe('shadcn');
})->with([
    'line' => fn (): Series => LineSeries::make('revenue'),
    'area' => fn (): Series => AreaSeries::make('revenue'),
    'step' => fn (): Series => StepLineSeries::make('revenue'),
    'smooth' => fn (): Series => LineSeries::make('revenue')->smooth(),
    'bar' => fn (): Series => BarSeries::make('revenue'),
    'horizontal bar' => fn (): Series => HorizontalBarSeries::make('revenue'),
    'stacked bar' => fn (): Series => BarSeries::make('revenue')->stack('total'),
]);

it('resolves shadcn pie and donut row data', function (Series $series): void {
    $result = ChartBuilder::make('share')->adapter('shadcn')
        ->data(Dataset::rows([['label' => 'North', 'value' => 8]]))
        ->series([$series->encode('label', 'label')->value('value')])->build()->result(request())->toArray();
    expect($result['status'])->toBe('ready');
})->with([
    'pie' => fn (): Series => PieSeries::make('share'),
    'donut' => fn (): Series => DonutSeries::make('share'),
]);

it('rejects unsupported shadcn capabilities before providers and authorizes first', function (): void {
    $calls = 0;
    $builder = revenueChart()->adapter('shadcn')->data(Dataset::using(function () use (&$calls): array {
        $calls++;

        return [];
    }))->renderingMode('canvas');
    $result = $builder->build()->result(request())->toArray();
    expect($result['status'])->toBe('error')->and($result['error']['code'])->toBe('unsupported_feature')->and($calls)->toBe(0);
    expect($builder->authorize(fn (): bool => false)->build()->result(request())->toArray()['status'])->toBe('denied');
    expect($calls)->toBe(0);
});

it('serializes a real shadcn fixture for React consumers', function (): void {
    $result = revenueChart()->adapter('shadcn')->build()->result(request())->toArray();
    expect($result['status'])->toBe('ready');
    $fixture = json_decode(json_encode($result, JSON_THROW_ON_ERROR));
    $fixture->contextKey = 'scope-fixture';
    $fixture->chart->meta->snapshotId = 'snapshot-fixture';
    $fixture->chart->meta->resolvedAt = '2026-10-23T12:00:00.000000Z';

    $path = __DIR__.'/../react/fixtures/shadcn.json';
    if (getenv('UPDATE_REACT_CONTRACT') === '1') {
        file_put_contents($path, json_encode($fixture, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES).PHP_EOL);
    }

    expect($fixture)->toEqual(json_decode(file_get_contents($path)));
});
