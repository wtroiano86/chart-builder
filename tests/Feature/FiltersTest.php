<?php

declare(strict_types=1);

use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Wtroiano\ChartBuilder\Filters\Filter;

it('normalizes inclusive dates to exclusive instants in the reporting timezone', function (): void {
    $filter = Filter::dateRange()->default(['from' => '2026-03-08', 'until' => '2026-03-08']);
    $state = $filter->resolve([], 'America/New_York');
    expect($state)->toBe(['from' => '2026-03-08T05:00:00.000000Z', 'until' => '2026-03-09T04:00:00.000000Z']);
    expect($filter->keys())->toBe(['from', 'until']);
    expect($filter->definition()['kind'])->toBe('date-range');
    expect(Filter::dateRange()->clearable()->resolve(['from' => '', 'until' => ''], 'UTC'))->toBe(['from' => null, 'until' => null]);

    $instant = Filter::dateRange()->resolve(['from' => '2026-01-01T00:00:00Z', 'until' => '2026-01-02T00:00:00Z'], 'UTC');
    expect($instant['until'])->toBe('2026-01-02T00:00:00.000000Z');
});

it('rejects malformed, reversed and partial ranges', function (array $input): void {
    expect(fn (): array => Filter::dateRange()->resolve($input, 'UTC'))->toThrow(ValidationException::class);
})->with([
    [['from' => '2026-01-01']],
    [['from' => '2026-01-03', 'until' => '2026-01-01']],
    [['from' => '2026-02-30', 'until' => '2026-03-01']],
    [['from' => '2026-99-99', 'until' => '2026-03-01']],
    [['from' => ['bad'], 'until' => '2026-03-01']],
]);

it('validates declared option domains and clearable multiselects', function (): void {
    $filter = Filter::select('region', ['west' => 'West', 'east' => 'East'], 'Region')->default('west');
    expect($filter->resolve([], 'UTC'))->toBe(['region' => 'west']);
    expect($filter->clearable()->resolve(['region' => ''], 'UTC'))->toBe(['region' => null]);

    $multi = Filter::select('regions', ['west' => 'West', 'east' => 'East'], multiple: true)->clearable();
    expect($multi->resolve(['regions' => ['west', 'west', 'east']], 'UTC'))->toBe(['regions' => ['west', 'east']]);
    expect($multi->resolve(['regions' => ''], 'UTC'))->toBe(['regions' => []]);
    expect(fn (): array => $filter->resolve(['region' => 'unknown'], 'UTC'))->toThrow(ValidationException::class);
});

it('contains malformed namespaces and bounds reflected input', function (string $query): void {
    $request = Request::create('/?'.$query);
    $request->setUserResolver(fn () => auth()->user());

    $result = revenueChart()->filters([Filter::interval()->default('month')])->build()->result($request)->toArray();
    expect($result['status'])->toBe('invalid');
})->with([
    'charts[revenue]=bad',
    'charts=bad',
    'charts[revenue][interval]='.str_repeat('a', 300),
]);
