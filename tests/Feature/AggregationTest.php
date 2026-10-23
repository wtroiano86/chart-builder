<?php

declare(strict_types=1);

use Carbon\CarbonImmutable;
use Illuminate\Database\Query\Builder;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Wtroiano\ChartBuilder\Aggregation\BucketPlanner;
use Wtroiano\ChartBuilder\Aggregation\Measure;
use Wtroiano\ChartBuilder\ChartBuilder;
use Wtroiano\ChartBuilder\Datasets\Dataset;
use Wtroiano\ChartBuilder\Datasets\QueryDataset;
use Wtroiano\ChartBuilder\Datasets\ResolvedDataset;
use Wtroiano\ChartBuilder\Exceptions\ChartException;
use Wtroiano\ChartBuilder\Series\LineSeries;

beforeEach(function (): void {
    Schema::create('chart_aggregate', function (Blueprint $table): void {
        $table->id();
        $table->string('region')->nullable();
        $table->string('tenant');
        $table->dateTime('paid_at');
        $table->decimal('amount', 14, 2)->nullable();
    });
    DB::table('chart_aggregate')->insert([
        ['region' => 'A', 'tenant' => 'one', 'paid_at' => '2026-01-01 00:00:00', 'amount' => 10],
        ['region' => 'A', 'tenant' => 'one', 'paid_at' => '2026-01-20 00:00:00', 'amount' => 30],
        ['region' => 'B', 'tenant' => 'one', 'paid_at' => '2026-02-01 00:00:00', 'amount' => 100],
        ['region' => 'C', 'tenant' => 'one', 'paid_at' => '2026-02-02 00:00:00', 'amount' => null],
        ['region' => null, 'tenant' => 'one', 'paid_at' => '2026-02-03 00:00:00', 'amount' => 20],
        ['region' => 'Z', 'tenant' => 'two', 'paid_at' => '2026-02-03 00:00:00', 'amount' => 999],
    ]);
});

afterEach(function (): void {
    Schema::drop('chart_aggregate');
});

function aggregateSource(): Builder
{
    return DB::table('chart_aggregate')->where('tenant', 'one');
}

it('resolves multiple measures in one grouped query and preserves null semantics', function (): void {
    DB::enableQueryLog();
    $data = Dataset::query(fn (): Builder => aggregateSource())->sum('amount', 'total')->count(as: 'rows')
        ->count('amount', 'present')->distinctCount('amount', 'unique')->average('amount', 'average')
        ->min('amount', 'minimum')->max('amount', 'maximum')->scale(2)->resolve(chartContext())->data;
    $values = $data['rows'][0]['values'];
    expect($values)->toEqual((object) ['total' => 160.0, 'rows' => 5.0, 'present' => 4.0, 'unique' => 4.0, 'average' => 40.0, 'minimum' => 10.0, 'maximum' => 100.0]);
    expect(DB::getQueryLog())->toHaveCount(1);
    DB::disableQueryLog();
});

it('ranks categories over the full range and recomputes Other averages and distinct counts', function (): void {
    $provider = Dataset::query(aggregateSource())->groupBy('region')->sum('amount', 'total')
        ->average('amount', 'average')->distinctCount('amount', 'unique')->top(1, 'total', other: true);
    $rows = $provider->resolve(chartContext())->data['rows'];
    expect($rows)->toHaveCount(2)->and($rows[0]['values']->region)->toBe('B')->and($rows[0]['values']->total)->toBe(100.0);
    expect($rows[1]['values']->region)->toBe('Other')->and($rows[1]['values']->total)->toBe(60.0)
        ->and($rows[1]['values']->average)->toBe(20.0)->and($rows[1]['values']->unique)->toBe(3.0);
});

it('fills the selected observed and explicit categories while retaining real nulls', function (): void {
    $data = Dataset::query(aggregateSource())->dateColumn('paid_at')->between('2026-01-01', '2026-03-01')
        ->timezone('UTC')->perMonth()->groupBy('region')->sum('amount', 'total')
        ->categories([['region' => 'D']])->fillMissing(['total' => 0])->resolve(chartContext())->data;
    expect($data['rows'])->toHaveCount(10);
    $c = array_values(array_filter($data['rows'], fn (array $row): bool => $row['values']->region === 'C' && str_starts_with($row['values']->period, '2026-02')));
    expect($c[0]['values']->total)->toBeNull();
    $d = array_values(array_filter($data['rows'], fn (array $row): bool => $row['values']->region === 'D'));
    expect(array_map(fn (array $row) => $row['values']->total, $d))->toBe([0, 0]);
});

it('bounds category discovery and refuses a composite fill before materialization', function (): void {
    expect(fn (): ResolvedDataset => Dataset::query(aggregateSource())->groupBy('region')->sum('amount')->resolve(chartContext(['categories' => 2])))->toThrow(ChartException::class, 'categories');
    expect(fn (): ResolvedDataset => Dataset::query(aggregateSource())->groupBy('region')->dateColumn('paid_at')->between('2026-01-01', '2026-03-01')->perDay()->sum('amount')->fillMissing(['sum' => 0])->resolve(chartContext(['items' => 20])))->toThrow(ChartException::class, 'items');
});

it('uses bounded result consumption when no dense fill is requested', function (): void {
    expect(fn (): ResolvedDataset => Dataset::query(aggregateSource())->groupBy('region')->sum('amount')->resolve(chartContext(['items' => 2])))->toThrow(ChartException::class, 'items');
});

it('handles empty rankings, Other fill and qualified grouping fields', function (): void {
    $empty = Dataset::query(aggregateSource()->whereRaw('1 = 0'))->groupBy('region')->sum('amount')->top(1, 'sum')->resolve(chartContext())->data;
    expect($empty['rows'])->toBe([]);
    $withOther = Dataset::query(aggregateSource()->whereRaw('1 = 0'))->groupBy('chart_aggregate.region')->dateColumn('paid_at')
        ->between('2026-01-01', '2026-02-01')->sum('amount')->top(1, 'sum', true)->fillMissing(['sum' => 0])->resolve(chartContext())->data;
    expect($withOther['rows'])->toHaveCount(1)->and($withOther['rows'][0]['values']->region)->toBe('Other');
    $qualified = Dataset::query(aggregateSource())->groupBy('chart_aggregate.region')->measures([new Measure('count', '*', 'count')])->resolve(chartContext())->data;
    expect($qualified['rows'])->toHaveCount(4);
});

it('supports every interval preset and filter-provided bounds', function (): void {
    $end = ['Minute' => '2026-01-01 00:03:00', 'Hour' => '2026-01-01 03:00:00', 'Day' => '2026-01-04', 'Week' => '2026-02-01', 'Month' => '2026-04-01', 'Quarter' => '2026-10-01', 'Year' => '2028-01-01'];
    foreach ($end as $interval => $until) {
        $provider = Dataset::query(aggregateSource())->dateColumn('paid_at')->between('2026-01-01', $until)->sum('amount')->weekStartsOn(7);
        $provider->{'per'.$interval}()->resolve(chartContext());
    }

    $provider = Dataset::query(aggregateSource())->dateColumn('paid_at')->sum('amount');
    $rows = $provider->resolve(chartContext(state: ['from' => '2026-02-01T00:00:00Z', 'until' => '2026-03-01T00:00:00Z', 'interval' => 'month']))->data['rows'];
    expect($rows[0]['values']->sum)->toBe(120.0);
});

it('rejects ambiguous query inputs and invalid aggregation configuration', function (Closure $make): void {
    expect(fn () => $make()->resolve(chartContext()))->toThrow(ChartException::class);
})->with([
    [fn (): QueryDataset => Dataset::query(aggregateSource()->limit(1))->count()],
    [fn (): QueryDataset => Dataset::query(aggregateSource()->select('amount'))->count()],
    [fn (): QueryDataset => Dataset::query(aggregateSource()->groupBy('region'))->count()],
    [fn (): QueryDataset => Dataset::query(aggregateSource())],
    [fn (): QueryDataset => Dataset::query(aggregateSource())->between('2026-01-01', '2026-02-01')->count()],
    [fn (): QueryDataset => Dataset::query(aggregateSource())->dateColumn('paid_at')->count()],
    [fn (): QueryDataset => Dataset::query(aggregateSource())->groupBy('region')->sum('amount', 'region')],
    [fn (): QueryDataset => Dataset::query(aggregateSource())->count(as: 'period')],
    [fn (): QueryDataset => Dataset::query(aggregateSource())->sum('amount')->top(1, 'sum')],
    [fn (): QueryDataset => Dataset::query(aggregateSource())->groupBy('region')->sum('amount')->top(0, 'sum')],
    [fn (): QueryDataset => Dataset::query(aggregateSource())->sum('amount')->fillMissing(['missing' => 0])],
    [fn (): QueryDataset => Dataset::query(aggregateSource())->sum('amount')->scale(20)],
    [fn (): QueryDataset => Dataset::query(aggregateSource())->sum('amount')->sum('amount')],
    [fn (): QueryDataset => Dataset::query(aggregateSource())->groupBy('region; DROP TABLE users')->count()],
]);

it('plans daylight-saving transitions using instant identity and calendar boundaries', function (): void {
    $planner = new BucketPlanner;
    $budget = chartContext()->budget;
    $fall = $planner->plan(CarbonImmutable::parse('2026-11-01T04:00:00Z'), CarbonImmutable::parse('2026-11-01T08:00:00Z'), 'hour', 'America/New_York', $budget);
    expect($fall)->toHaveCount(4)->and(array_unique(array_column($fall, 'start')))->toHaveCount(4);
    $spring = $planner->plan(CarbonImmutable::parse('2026-03-08T05:00:00Z'), CarbonImmutable::parse('2026-03-09T04:00:00Z'), 'day', 'America/New_York', $budget);
    expect($spring)->toHaveCount(1)->and($spring[0]['until'])->toBe('2026-03-09T04:00:00.000000Z');
    $partial = $planner->plan(CarbonImmutable::parse('2026-01-15'), CarbonImmutable::parse('2026-02-10'), 'month', 'UTC', $budget);
    expect(array_column($partial, 'partial'))->toBe([true, true]);
    expect(fn (): array => $planner->plan(CarbonImmutable::parse('2026-02-01'), CarbonImmutable::parse('2026-01-01'), 'day', 'UTC', $budget))->toThrow(ChartException::class);
    expect(fn (): array => $planner->plan(CarbonImmutable::parse('2026-01-01'), CarbonImmutable::parse('2026-02-01'), 'unknown', 'UTC', $budget))->toThrow(ChartException::class);
});

it('fills Other buckets and keeps an actual Other category distinct when splitting', function (): void {
    DB::table('chart_aggregate')->where('region', 'B')->update(['region' => 'Other']);
    $provider = Dataset::query(aggregateSource())->dateColumn('paid_at')->between('2026-01-01', '2026-04-01')->groupBy('region')->sum('amount', 'total')->top(1, 'total', other: true)->fillMissing(['total' => 0]);
    $chart = ChartBuilder::make('top')->data($provider)->xAxis('period', 'time')->series([LineSeries::make('total')->value('total')->splitBy('region')->area()])->requireFeature('interaction.point-activate')->build()->resolve(request())->toArray();
    expect($chart['series'])->toHaveCount(2)->and($chart['series'][0]['id'])->not->toBe($chart['series'][1]['id']);
    expect($chart['datasets']->default['rows'])->toHaveCount(6);
    $targets = array_map(fn (array $requirement) => $requirement['target']['id'] ?? null, $chart['requirements']);
    expect($targets)->toContain($chart['series'][0]['id'], $chart['series'][1]['id']);
});

it('snapshots a query source when the chart is built', function (): void {
    $source = aggregateSource();
    $chart = revenueChart()->data(Dataset::query($source)->dateColumn('paid_at')->between('2026-01-01', '2026-03-01')->sum('amount', 'revenue'))->xAxis('period', 'time')->build();
    $source->where('region', 'missing');
    expect($chart->resolve(request())->toArray()['datasets']->default['rows'])->toHaveCount(2);
});

it('preserves decimal display strings from PDO and rejects unsafe integer aggregates', function (): void {
    $pdo = DB::connection()->getPdo();
    $previous = $pdo->getAttribute(PDO::ATTR_STRINGIFY_FETCHES);
    try {
        $pdo->setAttribute(PDO::ATTR_STRINGIFY_FETCHES, true);
        $data = Dataset::query(aggregateSource())->sum('amount', 'total')->resolve(chartContext())->data;
        expect($data['rows'][0]['values']->total)->toBe(160.0)->and($data['rows'][0]['display']->total)->toBeString();
        $source = DB::query()->fromSub(DB::query()->selectRaw("'9007199254740992' AS amount"), 'source');
        expect(fn (): ResolvedDataset => Dataset::query($source)->max('amount')->resolve(chartContext()))->toThrow(ChartException::class, 'precision');
    } finally {
        $pdo->setAttribute(PDO::ATTR_STRINGIFY_FETCHES, $previous);
    }
});

it('preserves subsecond precision at half-open query boundaries', function (): void {
    $rows = Dataset::query(aggregateSource())->dateColumn('paid_at')->between('2026-01-01T00:00:00.500000Z', '2026-02-01T00:00:00.500000Z')->sum('amount', 'total')->resolve(chartContext())->data['rows'];
    expect(array_sum(array_map(fn (array $row): float => $row['values']->total, $rows)))->toBe(130.0);
});
