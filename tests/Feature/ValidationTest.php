<?php

declare(strict_types=1);

use Illuminate\Http\Request;
use Wtroiano\ChartBuilder\Adapters\AdapterRegistry;
use Wtroiano\ChartBuilder\Adapters\CapabilityValidator;
use Wtroiano\ChartBuilder\Axes\Axis;
use Wtroiano\ChartBuilder\ChartBuilder;
use Wtroiano\ChartBuilder\Charts\PayloadValidator;
use Wtroiano\ChartBuilder\Datasets\Dataset;
use Wtroiano\ChartBuilder\Exceptions\ChartException;
use Wtroiano\ChartBuilder\Filters\Filter;
use Wtroiano\ChartBuilder\Series\LineSeries;
use Wtroiano\ChartBuilder\Series\Series;
use Wtroiano\ChartBuilder\Support\Json;

it('checks adapter capabilities before any provider runs', function (Closure $change): void {
    $calls = 0;
    $builder = revenueChart()->data(Dataset::using(function () use (&$calls): array {
        $calls++;

        return [];
    }));
    $change($builder);
    expect($builder->build()->result(request())->toArray()['status'])->toBe('error')->and($calls)->toBe(0);
})->with([
    'rendering mode' => [fn ($builder) => $builder->renderingMode('pdf')],
    'unknown type' => [fn ($builder) => $builder->series([Series::make('missing', 'unknown')])],
    'adapter binding' => [fn ($builder) => $builder->series([LineSeries::make('line')->value('revenue')->requiresAdapter('syncfusion')])],
    'feature' => [fn ($builder) => $builder->requireFeature('unknown')],
    'extension' => [fn ($builder) => $builder->extension('renderer', 'name', adapter: 'syncfusion')],
    'managed options' => [fn ($builder) => $builder->adapterOptions('echarts', ['series' => []])],
]);

it('checks mapping and dataset capability failures after resolution', function (Closure $change, string $path): void {
    $chart = revenueChart()->build()->resolve(request())->toArray();
    $manifest = resolve(AdapterRegistry::class)->get('echarts');
    $change($chart, $manifest);
    expect(fn () => new CapabilityValidator()->validate($chart, $manifest, true))->toThrow(ChartException::class, $path);
})->with([
    'api version' => [function (&$chart, array &$manifest): void {
        $manifest['apiVersion'] = 2;
    }, 'Incompatible'],
    'dataset kind' => [function (&$chart): void {
        $chart['datasets']->default['kind'] = 'hierarchy';
    }, 'datasetId'],
    'dataset binding' => [function (&$chart): void {
        $chart['datasets']->default['requiredAdapter'] = 'syncfusion';
    }, 'requiredAdapter'],
    'unknown role' => [function (array &$chart): void {
        $chart['series'][0]['encode']->unknown = ['month'];
    }, 'encode.unknown'],
    'cardinality' => [function (array &$chart): void {
        $chart['series'][0]['encode']->x = [];
    }, 'encode.x'],
    'missing dimension' => [function (array &$chart): void {
        $chart['series'][0]['encode']->y = ['missing'];
    }, 'encode.y'],
    'required role' => [function (array &$chart): void {
        unset($chart['series'][0]['encode']->y);
    }, 'encode.y'],
    'mixed types' => [function (array &$chart, array &$manifest): void {
        $chart['series'][] = [...$chart['series'][0], 'id' => 'bar', 'type' => 'bar'];
        $manifest['mixedSeries'] = [];
    }, 'mixedSeries'],
]);

it('resolves structured and radial charts through the full PHP contract', function (): void {
    $hierarchy = Dataset::hierarchy([['id' => 'root', 'children' => [['id' => 'leaf', 'value' => 3]]]]);
    $graph = Dataset::graph([['id' => 'a'], ['id' => 'b']], [['id' => 'edge', 'source' => 'a', 'target' => 'b', 'value' => 2]]);
    foreach ([['tree', $hierarchy], ['graph', $graph]] as [$type, $dataset]) {
        $chart = ChartBuilder::make($type)->data($dataset)->series([Series::make($type, $type)])->build()->resolve(request())->toArray();
        expect($chart['datasets']->default['kind'])->toBe($type === 'tree' ? 'hierarchy' : 'graph');
    }

    $custom = Dataset::series([['id' => 'item', 'value' => [1, 2]]], Dataset::rows([['id' => 'item', 'x' => 1]])->key('id'), 'echarts');
    $chart = ChartBuilder::make('custom')->data($custom)->series([Series::make('custom', 'custom')->renderer('draw')])->build()->resolve(request())->toArray();
    expect($chart['datasets']->default['kind'])->toBe('series');
    $pie = ChartBuilder::make('pie')->data(Dataset::rows([['label' => 'A', 'value' => 1]]))
        ->series([Series::make('pie', 'pie')->value('value')->encode('label', 'label')->radius(0.3, 0.8)])->build()->resolve(request())->toArray();
    expect($pie['series'][0]['presentation']['radius'])->toBe([0.3, 0.8]);
});

it('resolves mixed series and declares presentation, log and custom format features', function (): void {
    $chart = revenueChart()->axes([Axis::make('x', 'category', 'bottom'), Axis::make('y', 'log')->range(1, 20000)])
        ->series([LineSeries::make('line')->value('revenue')->area()->smooth()->step()->stack()
            ->format(['kind' => 'custom', 'name' => 'money', 'params' => (object) []]),
            Series::make('bar', 'bar')->value('revenue')])
        ->extension('formatter', 'money')->build()->resolve(request())->toArray();
    expect(array_column($chart['requirements'], 'name'))->toContain('axis.log', 'format.custom', 'series.stack');
});

it('validates semantic references even for normalized custom provider output', function (Closure $change): void {
    $chart = revenueChart()->build()->resolve(request())->toArray();
    $change($chart);
    expect(fn () => new PayloadValidator()->validate($chart, chartContext()->budget))->toThrow(ChartException::class);
})->with([
    'duplicate series' => [function (array &$chart): void {
        $chart['series'][] = $chart['series'][0];
    }],
    'axis coordinate' => [function (array &$chart): void {
        $chart['axes'][0]['coordinateId'] = 'missing';
    }],
    'series coordinate' => [function (array &$chart): void {
        $chart['series'][0]['coordinateId'] = 'missing';
    }],
    'axis reference' => [function (array &$chart): void {
        $chart['series'][0]['axes']->x = 'missing';
    }],
    'selection' => [function (array &$chart): void {
        $chart['series'][0]['itemIds'] = ['missing'];
    }],
    'format' => [function (array &$chart): void {
        $chart['series'][0]['formatId'] = 'missing';
    }],
    'typed value' => [function (&$chart): void {
        $chart['datasets']->default['rows'][0]['values']->revenue = '100';
    }],
    'nullable' => [function (&$chart): void {
        $chart['datasets']->default['dimensions'][1]['nullable'] = false;
        $chart['datasets']->default['rows'][0]['values']->revenue = null;
    }],
    'navigation' => [function (array &$chart): void {
        $chart['interactions']['navigation'][] = ['seriesId' => 'revenue', 'datum' => ['datasetId' => 'default', 'kind' => 'row', 'id' => 'jan'], 'url' => 'javascript:alert(1)', 'target' => '_self'];
    }],
]);

it('contains duplicate filters and default unauthenticated outcomes', function (): void {
    $request = Request::create('/');
    expect(revenueChart()->build()->result($request)->toArray()['reason'])->toBe('unauthenticated');
    $result = revenueChart()->filters([Filter::interval()->default('month'), Filter::interval()->default('month')])->build()->result(request())->toArray();
    expect($result['status'])->toBe('error');
    expect(revenueChart()->series([LineSeries::make('revenue')->value('revenue')->splitBy('missing')])->build()->result(request())->toArray()['status'])->toBe('error');
});

it('registers manifests with duplicate protection and rejects unregistered adapters', function (): void {
    $registry = new AdapterRegistry;
    $manifest = $registry->get('echarts');
    expect(fn () => $registry->register($manifest))->toThrow(ChartException::class);
    expect(fn (): array => $registry->get('absent'))->toThrow(ChartException::class);
    expect(Json::read(dirname(__DIR__, 2).'/resources/manifests/echarts.json')['name'])->toBe('echarts');
});
