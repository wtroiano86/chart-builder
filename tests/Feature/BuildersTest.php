<?php

declare(strict_types=1);

use Illuminate\Support\Facades\File;
use Illuminate\Support\ServiceProvider;
use Wtroiano\ChartBuilder\Axes\Axis;
use Wtroiano\ChartBuilder\Chart;
use Wtroiano\ChartBuilder\ChartBuilder;
use Wtroiano\ChartBuilder\ChartRegistry;
use Wtroiano\ChartBuilder\Coordinates\Coordinate;
use Wtroiano\ChartBuilder\Datasets\Dataset;
use Wtroiano\ChartBuilder\Exceptions\ChartException;
use Wtroiano\ChartBuilder\Providers\ChartBuilderServiceProvider;
use Wtroiano\ChartBuilder\Series\LineSeries;
use Wtroiano\ChartBuilder\Series\Series;
use Wtroiano\ChartBuilder\Support\Json;

it('snapshots builders and supports class definitions, registry factories and strict serialization', function (): void {
    $builder = revenueChart();
    $chart = $builder->build();
    $builder->title('Changed');
    expect($chart->resolve(request())->toArray()['title'])->toBe('Revenue');
    $class = new class extends Chart
    {
        public function definition(): ChartBuilder
        {
            return revenueChart();
        }
    };
    expect($class->toArray()['title'])->toBe('Revenue');
    expect(json_decode(json_encode($class))->name)->toBe('revenue');
    expect(json_decode(json_encode($chart->resolve(request())))->name)->toBe('revenue');
    expect(json_decode(json_encode($chart->result(request())))->status)->toBe('ready');
    expect(fn (): ChartBuilder => $chart->definition())->toThrow(ChartException::class);

    $registry = new ChartRegistry;
    $registry->register('revenue', fn (): Chart => revenueChart()->build());

    expect($registry->get('revenue'))->not->toBe($registry->get('revenue'));
    expect(fn () => $registry->register('revenue', fn (): Chart => revenueChart()->build()))->toThrow(ChartException::class);
    expect(fn (): Chart => $registry->get('missing'))->toThrow(ChartException::class);
});

it('translates chart presentation, formatting, named extensions and navigation', function (): void {
    $chart = revenueChart()->public()->scope(fn (): string => 'tenant-1')->adapter('echarts')
        ->description('Revenue in USD')->locale('en-GB')->timezone('Europe/London')
        ->theme('dark')->palette(['#123456'])->height(400)->legend(true, 'top')->tooltip(false)->animation(false)->renderingMode('svg')
        ->format('money', ['kind' => 'currency', 'currency' => 'USD', 'decimals' => 2])
        ->axes([Axis::make('x', 'category', 'bottom')->categories(['Jan', 'Feb'])->title('Month'), Axis::make('y')->range(0, 20000)->format('money')])
        ->coordinates([Coordinate::cartesian()])
        ->adapterOptions('echarts', ['animationDuration' => 0])->adapterOptions('unused', ['ignored' => true])
        ->on('point-activate', 'selected')->extension('renderer', 'selected')
        ->navigate('revenue', 'default', 'jan', '/reports/jan')
        ->limits(['items' => 10])->build()->resolve(request())->toArray();
    expect($chart['appearance']['theme'])->toBe('dark')->and($chart['appearance']['height'])->toBe(400)
        ->and($chart['adapterOptions'])->toHaveProperty('echarts')->not->toHaveProperty('unused');
    expect($chart['axes'][1]['domain']['min'])->toBe(0.0);
});

it('provides every named series preset through the common contract', function (): void {
    foreach (glob(dirname(__DIR__, 2).'/src/Series/*Series.php') as $path) {
        $class = 'Wtroiano\\ChartBuilder\\Series\\'.basename($path, '.php');
        if ($class === Series::class) {
            continue;
        }

        $series = $class::make('example');
        expect($series)->toBeInstanceOf(Series::class);
        expect($series->definition()['id'])->toBe('example');
    }

    $series = Series::make('example', 'line')->label('Label')->dataset('data')->coordinate('main')
        ->axis('x', 'x')->encode('x', 'month')->encode('y', 'value')
        ->color('#112233')->stack()->horizontal()->area()->step()->smooth()->radius(0.4, 0.8)->symbolSize(20)
        ->adapterOptions('echarts', ['opacity' => 0.5])->requiresAdapter('echarts')->renderer('custom')
        ->percent('whole', 2)->decimals(3, true);
    expect($series->definition()['presentation']['orientation'])->toBe('horizontal');
    expect($series->formatDescriptor())->toBe(['kind' => 'number', 'decimals' => 3, 'compact' => true]);
});

it('expands split series in PHP and reuses a single named dataset', function (): void {
    $rows = Dataset::rows([
        ['id' => 'a', 'month' => 'Jan', 'value' => 10, 'region' => 'West'],
        ['id' => 'b', 'month' => 'Jan', 'value' => 20, 'region' => 'East'],
        ['id' => 'c', 'month' => 'Feb', 'value' => 15, 'region' => 'West'],
    ])->key('id');
    $chart = ChartBuilder::make('split')->datasets(['sales' => $rows])->xAxis('month')
        ->series([LineSeries::make('revenue')->dataset('sales')->value('value')->splitBy('region')])->build()->resolve(request())->toArray();
    expect($chart['series'])->toHaveCount(2)->and($chart['series'][0]['itemIds'])->toBe(['a', 'c'])
        ->and($chart['series'][1]['itemIds'])->toBe(['b']);
    expect($chart['datasets'])->toHaveProperty('sales');
});

it('supports coordinate definitions and axis configuration without engine-specific payloads', function (): void {
    expect(Coordinate::polar()->definition()['kind'])->toBe('polar');
    expect(Coordinate::radar('r', [['id' => 'a', 'label' => 'A', 'min' => 0, 'max' => 10]])->definition()['indicators'])->toHaveCount(1);
    expect(Coordinate::geo('map', 'world')->definition()['asset'])->toBe('world');
    expect(Coordinate::calendar('c', '2026-01-01', '2026-02-01')->definition()['weekStartsOn'])->toBe(1);
    expect(Coordinate::matrix('m', ['a'], ['b'])->definition()['rows'])->toBe(['a']);
    expect(Coordinate::parallel()->definition()['kind'])->toBe('parallel');
    expect(Axis::make('log', 'log')->logBase(2)->definition()['logBase'])->toBe(2.0);
    expect(fn (): string => Json::identifier('bad[name]'))->toThrow(ChartException::class);
    expect(fn (): string => Json::encode(NAN))->toThrow(ChartException::class);
});

it('publishes all source entry points and scaffolds reusable charts', function (): void {
    $provider = ChartBuilderServiceProvider::class;
    foreach (['chart-builder-config', 'chart-builder-react', 'chart-builder-react-core', 'chart-builder-echarts', 'chart-builder-react-page'] as $tag) {
        expect(ServiceProvider::pathsToPublish($provider, $tag))->not->toBeEmpty();
    }

    $path = app_path('Charts/GeneratedRevenue.php');
    try {
        $this->artisan('make:chart', ['name' => 'GeneratedRevenue', '--force' => true])->assertSuccessful();
        expect(file_get_contents($path))->toContain('extends Chart', 'LineSeries::make');
    } finally {
        if (is_file($path)) {
            File::delete($path);
        }
    }
});
