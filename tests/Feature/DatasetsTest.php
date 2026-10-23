<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Cache;
use Wtroiano\ChartBuilder\Contracts\ChartContext;
use Wtroiano\ChartBuilder\Datasets\CachedDataset;
use Wtroiano\ChartBuilder\Datasets\CustomDataset;
use Wtroiano\ChartBuilder\Datasets\Dataset;
use Wtroiano\ChartBuilder\Datasets\PreparedDataset;
use Wtroiano\ChartBuilder\Datasets\ResolvedDataset;
use Wtroiano\ChartBuilder\Datasets\RowsDataset;
use Wtroiano\ChartBuilder\Exceptions\ChartException;
use Wtroiano\ChartBuilder\Support\ResourceBudget;
use Wtroiano\ChartBuilder\Support\SchemaValidator;

it('normalizes typed rows without coercing booleans, nulls or identifier strings', function (): void {
    $input = [
        ['key' => '90071992547409920', 'label' => 'A', 'active' => true, 'value' => null, 'date' => '2024-02-29', 'instant' => '2026-10-23T12:00:00Z'],
        ['key' => 'next', 'label' => 'B', 'active' => false, 'value' => 0, 'date' => '2024-03-01', 'instant' => '2026-10-23T13:00:00Z'],
    ];
    $dataset = Dataset::rows($input)->key('key')->dimension('label', 'string')->dimension('active', 'boolean')->dimension('value', 'number')->dimension('date', 'date')->dimension('instant', 'datetime');
    $data = $dataset->resolve(chartContext())->data;
    expect($data['identity'])->toBe('stable')->and($data['rows'][0]['id'])->toBe('90071992547409920')
        ->and($data['rows'][0]['values']->value)->toBeNull()->and($data['rows'][1]['values']->value)->toBe(0);
    new SchemaValidator()->validate('dataset', $data);
    $positional = Dataset::rows([['x' => 'A', 'y' => 2, 'active' => true]])->resolve(chartContext())->data;
    expect($positional['identity'])->toBe('snapshot')->and($positional['rows'][0]['id'])->toBe('row:0');
});

it('rejects duplicate keys, invalid types, unsafe integers and malformed JSON early', function (Closure $dataset): void {
    expect(fn () => $dataset()->resolve(chartContext()))->toThrow(ChartException::class);
})->with([
    'duplicate' => [fn (): RowsDataset => Dataset::rows([['id' => 'a', 'value' => 1], ['id' => 'a', 'value' => 2]])->key('id')],
    'missing ID' => [fn (): RowsDataset => Dataset::rows([['value' => 1]])->key('id')],
    'numeric ID' => [fn (): RowsDataset => Dataset::rows([['id' => 1, 'value' => 1]])->key('id')],
    'invalid number' => [fn (): RowsDataset => Dataset::rows([['value' => '12']])->dimension('value', 'number')],
    'nonnullable' => [fn (): RowsDataset => Dataset::rows([['value' => null]])->dimension('value', 'number', false)],
    'invalid date' => [fn (): RowsDataset => Dataset::rows([['date' => '2026-02-30']])->dimension('date', 'date')],
    'invalid instant' => [fn (): RowsDataset => Dataset::rows([['date' => '2026-10-23']])->dimension('date', 'datetime')],
    'unknown type' => [fn (): RowsDataset => Dataset::rows([['value' => 'a']])->dimension('value', 'unknown')],
    'unsafe integer' => [fn (): RowsDataset => Dataset::rows([['value' => 9007199254740992]])],
    'infinity' => [fn (): RowsDataset => Dataset::rows([['value' => INF]])],
    'object' => [fn (): RowsDataset => Dataset::rows([['value' => new DateTimeImmutable]])],
    'prototype' => [fn (): RowsDataset => Dataset::rows([['__proto__' => 'value']])],
]);

it('bounds an iterable while consuming it instead of collecting an unlimited source', function (): void {
    $consumed = 0;
    $rows = (function () use (&$consumed): Generator {
        for ($i = 0; $i < 100; $i++) {
            $consumed++;
            yield ['value' => $i];
        }
    })();
    expect(fn (): ResolvedDataset => Dataset::rows($rows)->resolve(chartContext(['items' => 3])))->toThrow(ChartException::class, 'items');
    expect($consumed)->toBe(4);
});

it('resolves hierarchy, graph parallel links and custom projections with matching identities', function (): void {
    $hierarchy = Dataset::hierarchy([['id' => 'company', 'children' => [['id' => 'sales', 'value' => 5]]]])->resolve(chartContext());
    expect($hierarchy->data['roots'][0]['children'][0]['label'])->toBe('sales');
    new SchemaValidator()->validate('dataset', $hierarchy->data);
    $graph = Dataset::graph([['id' => 'a'], ['id' => 'b']], [
        ['id' => 'first', 'source' => 'a', 'target' => 'b', 'value' => 2],
        ['id' => 'second', 'source' => 'a', 'target' => 'b', 'value' => 3],
    ], false)->resolve(chartContext());
    expect($graph->data['directed'])->toBeFalse()->and($graph->data['links'])->toHaveCount(2);
    new SchemaValidator()->validate('dataset', $graph->data);
    $custom = Dataset::series([['id' => 'one', 'value' => [1, 2]]], Dataset::rows([['id' => 'one', 'value' => 2]])->key('id'), 'echarts')->resolve(chartContext());
    expect($custom->data['requiredAdapter'])->toBe('echarts');
    new SchemaValidator()->validate('dataset', $custom->data);
});

it('rejects invalid structured data and mismatched custom projections', function (Closure $provider): void {
    expect(fn () => $provider()->resolve(chartContext()))->toThrow(ChartException::class);
})->with([
    [fn (): PreparedDataset => Dataset::hierarchy([['id' => 'a', 'children' => [['id' => 'a']]]])],
    [fn (): PreparedDataset => Dataset::hierarchy([['id' => 'a', 'children' => 'invalid']])],
    [fn (): PreparedDataset => Dataset::graph([['id' => 'a']], [['id' => 'edge', 'source' => 'a', 'target' => 'missing']])],
    [fn (): CustomDataset => Dataset::series([['id' => 'one', 'value' => 1]], Dataset::rows([['id' => 'two', 'value' => 1]])->key('id'))],
]);

it('supports lazy provider results and only caches normalized successful data within scope', function (): void {
    $calls = 0;
    $provider = Dataset::using(function (ChartContext $context) use (&$calls): array {
        $calls++;

        return [['value' => $context->state['amount'] ?? 5]];
    });
    expect(Dataset::using($provider))->toBe($provider);
    $cache = Dataset::cached($provider, 'reports', 60, ['scope' => 'tenant-one'], 'v1');
    expect($cache->resolve(chartContext())->data)->toBe($cache->resolve(chartContext())->data)->and($calls)->toBe(1);
    $cache->resolve(chartContext(state: ['amount' => 8]));
    expect($calls)->toBe(2);
    $cache->forget(chartContext());
    $cache->resolve(chartContext());

    expect($calls)->toBe(3);
    $ready = new ResolvedDataset(['kind' => 'rows', 'identity' => 'stable', 'dimensions' => [], 'rows' => []]);
    expect(Dataset::using(fn (): ResolvedDataset => $ready)->resolve(chartContext()))->toBe($ready);
    expect(fn (): CachedDataset => Dataset::cached($provider, '', 0, []))->toThrow(ChartException::class);
    Cache::flush();
});

it('enforces composite fill and UTF-8 byte budgets before expanding data', function (): void {
    $budget = new ResourceBudget(config('chart-builder.limits'));
    expect(fn () => $budget->expansion(1000 * 100, 3))->toThrow(ChartException::class, 'items');
    expect(fn () => chartContext(['bytes' => 16])->budget->serialized(str_repeat('😀', 8)))->toThrow(ChartException::class, 'bytes');
    expect(fn (): ChartContext => chartContext(['items' => 0]))->toThrow(ChartException::class);

    $nested = 1;
    for ($depth = 0; $depth < 20; $depth++) {
        $nested = [$nested];
    }

    expect(fn () => chartContext(['depth' => 1])->budget->inspect($nested))->toThrow(ChartException::class, 'depth');
});
