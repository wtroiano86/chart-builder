<?php

declare(strict_types=1);

namespace Wtroiano\ChartBuilder\Datasets;

use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Database\Eloquent\Builder as EloquentBuilder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Query\Builder;
use Wtroiano\ChartBuilder\Aggregation\BucketPlanner;
use Wtroiano\ChartBuilder\Aggregation\GroupedQuery;
use Wtroiano\ChartBuilder\Aggregation\Measure;
use Wtroiano\ChartBuilder\Aggregation\QueryResultNormalizer;
use Wtroiano\ChartBuilder\Contracts\ChartContext;
use Wtroiano\ChartBuilder\Contracts\DatasetProvider;
use Wtroiano\ChartBuilder\Database\AggregationDialect;
use Wtroiano\ChartBuilder\Exceptions\ChartException;

final class QueryDataset implements DatasetProvider
{
    private ?string $dateColumn = null;

    private ?CarbonImmutable $from = null;

    private ?CarbonImmutable $until = null;

    private ?string $timezone = null;

    private string $interval = 'month';

    private int $weekStart = 1;

    /** @var list<string> */
    private array $groups = [];

    /** @var array<string, Measure> */
    private array $measures = [];

    /** @var array<string, int|float|null> */
    private array $fill = [];

    /** @var list<array<string, mixed>> */
    private array $domain = [];

    private ?int $top = null;

    private ?string $rank = null;

    private bool $other = false;

    private ?int $scale = null;

    /** @param Builder|EloquentBuilder<Model>|Closure(): (Builder|EloquentBuilder<Model>) $source */
    public function __construct(private Builder|EloquentBuilder|Closure $source) {}

    public function __clone(): void
    {
        $this->source = clone $this->source;
    }

    public function dateColumn(string $column): self
    {
        $this->dateColumn = $column;

        return $this;
    }

    public function between(string|CarbonImmutable $from, string|CarbonImmutable $until): self
    {
        $this->from = CarbonImmutable::parse($from);
        $this->until = CarbonImmutable::parse($until);

        return $this;
    }

    public function timezone(string $timezone): self
    {
        $this->timezone = $timezone;

        return $this;
    }

    public function interval(string $interval): self
    {
        $this->interval = $interval;

        return $this;
    }

    public function weekStartsOn(int $day): self
    {
        $this->weekStart = $day;

        return $this;
    }

    public function groupBy(string ...$columns): self
    {
        $this->groups = array_values($columns);

        return $this;
    }

    public function measure(Measure $measure): self
    {
        throw_if(isset($this->measures[$measure->alias]), ChartException::class, 'Measure aliases must be unique.');

        $this->measures[$measure->alias] = $measure;

        return $this;
    }

    /** @param list<Measure> $measures */
    public function measures(array $measures): self
    {
        foreach ($measures as $measure) {
            $this->measure($measure);
        }

        return $this;
    }

    /** @param array<string, int|float|null> $values */
    public function fillMissing(array $values): self
    {
        $this->fill = $values;

        return $this;
    }

    /** @param list<array<string, mixed>> $categories */
    public function categories(array $categories): self
    {
        $this->domain = $categories;

        return $this;
    }

    public function top(int $count, string $by, bool $other = false): self
    {
        $this->top = $count;
        $this->rank = $by;
        $this->other = $other;

        return $this;
    }

    public function scale(int $decimals): self
    {
        throw_if($decimals < 0 || $decimals > 15, ChartException::class, 'Scale must be between zero and fifteen.');

        $this->scale = $decimals;

        return $this;
    }

    public function perMinute(): self
    {
        return $this->interval('minute');
    }

    public function perHour(): self
    {
        return $this->interval('hour');
    }

    public function perDay(): self
    {
        return $this->interval('day');
    }

    public function perWeek(): self
    {
        return $this->interval('week');
    }

    public function perMonth(): self
    {
        return $this->interval('month');
    }

    public function perQuarter(): self
    {
        return $this->interval('quarter');
    }

    public function perYear(): self
    {
        return $this->interval('year');
    }

    public function sum(string $column, string $as = 'sum'): self
    {
        return $this->measure(new Measure('sum', $column, $as));
    }

    public function count(string $column = '*', string $as = 'count'): self
    {
        return $this->measure(new Measure('count', $column, $as));
    }

    public function distinctCount(string $column, string $as = 'distinctCount'): self
    {
        return $this->measure(new Measure('distinct', $column, $as));
    }

    public function average(string $column, string $as = 'average'): self
    {
        return $this->measure(new Measure('avg', $column, $as));
    }

    public function min(string $column, string $as = 'min'): self
    {
        return $this->measure(new Measure('min', $column, $as));
    }

    public function max(string $column, string $as = 'max'): self
    {
        return $this->measure(new Measure('max', $column, $as));
    }

    public function resolve(ChartContext $context): ResolvedDataset
    {
        $source = $this->source instanceof Closure ? ($this->source)() : $this->source;
        $source = clone $source;

        $base = $source instanceof EloquentBuilder ? $source->toBase() : $source;
        $dialect = new AggregationDialect;
        $dialect->assertSupported($base);
        $this->validateSource($base, $context);
        $buckets = [];
        if ($this->dateColumn !== null) {
            $from = isset($context->state['from']) && is_string($context->state['from']) ? CarbonImmutable::parse($context->state['from']) : $this->from;
            $until = isset($context->state['until']) && is_string($context->state['until']) ? CarbonImmutable::parse($context->state['until']) : $this->until;
            throw_if(! $from instanceof CarbonImmutable || ! $until instanceof CarbonImmutable, ChartException::class, 'Time aggregation requires a bounded range.');

            $interval = is_string($context->state['interval'] ?? null) ? $context->state['interval'] : $this->interval;
            $buckets = new BucketPlanner()->plan($from, $until, $interval, $this->timezone ?? $context->timezone, $context->budget, $this->weekStart);
            $base->where($this->dateColumn, '>=', $this->timestamp($from))
                ->where($this->dateColumn, '<', $this->timestamp($until));
        }

        $base->reorder();
        $query = new GroupedQuery($this->groups, $this->measures);
        $categories = $query->categories($base, $context, $this->domain, $this->top, $this->rank);
        if ($this->fill !== []) {
            $context->budget->expansion(count($buckets) * max(1, count($categories) + (int) $this->other), count($this->groups) + count($this->measures) + 1);
        }

        $selected = clone $base;
        if ($this->top !== null) {
            $query->constrain($selected, $categories, false);
        }

        $rows = $query->aggregate($selected, $context, $buckets, $this->dateColumn);
        if ($this->other) {
            $remainder = clone $base;
            $query->constrain($remainder, $categories, true);
            $rows = array_merge($rows, $query->aggregate($remainder, $context, $buckets, $this->dateColumn, true));
        }

        return new QueryResultNormalizer($this->groups, $this->measures, $this->fill, $this->other, $this->scale)
            ->normalize($rows, $categories, $buckets, $context);
    }

    private function timestamp(CarbonImmutable $instant): string
    {
        return $instant->utc()->format($instant->micro === 0 ? 'Y-m-d H:i:s' : 'Y-m-d H:i:s.u');
    }

    private function validateSource(Builder $base, ChartContext $context): void
    {
        throw_if(($base->columns !== null && $base->columns !== ['*']) || $base->groups !== null || $base->havings !== null || $base->unions !== null || $base->limit !== null || $base->offset !== null, ChartException::class, 'Use a prepared provider for pre-aggregated, projected, unioned or limited queries.');

        throw_if($this->measures === [], ChartException::class, 'At least one aggregate measure is required.');

        throw_if(($this->from instanceof CarbonImmutable || $this->until instanceof CarbonImmutable) && $this->dateColumn === null, ChartException::class, 'A date range requires a date column.');

        $aliases = array_map(static fn (string $column): string => str_contains($column, '.') ? mb_substr($column, mb_strrpos($column, '.') + 1) : $column, $this->groups);
        $all = [...$aliases, ...array_keys($this->measures)];
        throw_if(count(array_unique($all)) !== count($all) || in_array('period', $all, true) || in_array('id', $all, true), ChartException::class, 'Grouping fields and measure aliases must be distinct; period and id are reserved.');

        $context->budget->check('dimensions', count($all) + (int) ($this->dateColumn !== null));
        throw_if($this->top !== null && ($this->top < 1 || $this->groups === [] || ! isset($this->measures[$this->rank ?? '']) || $this->domain !== []), ChartException::class, 'Top categories require grouping, a positive count and a declared ranking measure, without an explicit domain.');

        if ($this->top !== null) {
            $context->budget->check('categories', $this->top + (int) $this->other);
        }

        foreach (array_keys($this->fill) as $alias) {
            throw_unless(isset($this->measures[$alias]), ChartException::class, 'Missing-data defaults must reference declared measures.');
        }
    }
}
