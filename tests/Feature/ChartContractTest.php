<?php

declare(strict_types=1);

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Wtroiano\ChartBuilder\Datasets\Dataset;
use Wtroiano\ChartBuilder\Filters\Filter;
use Wtroiano\ChartBuilder\Support\SchemaValidator;

it('serializes a portable ready result with stable references and a matching schema', function (): void {
    $result = revenueChart()->build()->result(request())->toArray();
    expect($result['status'])->toBe('ready');
    expect($result['chart']['series'][0]['encode']->y)->toBe(['revenue']);
    expect($result['chart']['datasets']->default['rows'][0]['id'])->toBe('jan');
    new SchemaValidator()->validate('chart-result', $result);
    $fixture = json_decode(json_encode($result, JSON_THROW_ON_ERROR));
    $fixture->contextKey = 'scope-fixture';
    $fixture->chart->meta->snapshotId = 'snapshot-fixture';
    $fixture->chart->meta->resolvedAt = '2026-10-23T12:00:00.000000Z';

    $path = __DIR__.'/../react/fixtures/revenue.json';
    if (getenv('UPDATE_REACT_CONTRACT') === '1') {
        if (! is_dir(dirname($path))) {
            mkdir(dirname($path), recursive: true);
        }

        file_put_contents($path, json_encode($fixture, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES).PHP_EOL);
    }

    expect($fixture)->toEqual(json_decode(file_get_contents($path)));
});

it('contains provider failures without losing sibling outcomes and denies before loading', function (): void {
    $calls = 0;
    $provider = Dataset::using(function () use (&$calls): never {
        $calls++;
        throw new RuntimeException('secret SQL');
    });
    $denied = revenueChart()->data($provider)->authorize(fn (): bool => false)->build()->result(request())->toArray();
    expect($denied)->toBe([
        'schemaVersion' => 1, 'name' => 'revenue', 'requestId' => null, 'contextKey' => '',
        'status' => 'denied', 'reason' => 'forbidden',
    ])->and($calls)->toBe(0);
    $failure = revenueChart()->data($provider)->build()->result(request())->toArray();
    expect($failure['status'])->toBe('error')->and($failure['error']['message'])->not->toContain('SQL')->and($calls)->toBe(1);
    expect(revenueChart()->build()->result(request())->toArray()['status'])->toBe('ready');
});

it('contains invalid initial filters and echoes bounded request tokens', function (): void {
    $request = Request::create('/?charts[revenue][interval]=invalid');
    $request->setUserResolver(fn () => auth()->user());
    $request->headers->set('X-Chart-Request', 'visit-1');

    $result = revenueChart()->filters([Filter::interval()->default('month')])->build()->result($request)->toArray();
    expect($result['status'])->toBe('invalid')->and($result['requestId'])->toBe('visit-1');
    expect($result['errors']->interval)->toBe(['Select an allowed value.']);
    new SchemaValidator()->validate('chart-result', $result);
});

it('aggregates in SQL and fills absent months without changing its source query', function (): void {
    Schema::create('chart_orders', function (Blueprint $table): void {
        $table->id();
        $table->dateTime('paid_at');
        $table->decimal('total', 14, 2);
        $table->string('tenant');
    });
    try {
        DB::table('chart_orders')->insert([
            ['paid_at' => '2026-01-01 00:00:00', 'total' => 12, 'tenant' => 'one'],
            ['paid_at' => '2026-01-15 00:00:00', 'total' => 8, 'tenant' => 'one'],
            ['paid_at' => '2026-02-01 00:00:00', 'total' => 99, 'tenant' => 'two'],
        ]);
        $query = DB::table('chart_orders')->where('tenant', 'one');
        $sql = $query->toSql();
        $dataset = Dataset::query($query)->dateColumn('paid_at')->between('2026-01-01', '2026-03-01')->sum('total', 'revenue')->fillMissing(['revenue' => 0]);
        $payload = revenueChart()->data($dataset)->xAxis('period', 'time')->build()->resolve(request())->toArray();
        $rows = $payload['datasets']->default['rows'];
        expect($rows)->toHaveCount(2)->and($rows[0]['values']->revenue)->toBe(20.0)->and($rows[1]['values']->revenue)->toBe(0);
        expect($query->toSql())->toBe($sql)->and($query->count())->toBe(2);
    } finally {
        Schema::drop('chart_orders');
    }
});
