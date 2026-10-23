<?php

declare(strict_types=1);

namespace Wtroiano\ChartBuilder\Datasets;

use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Database\Eloquent\Builder as EloquentBuilder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Query\Builder;
use Wtroiano\ChartBuilder\Aggregation\BucketPlanner;
use Wtroiano\ChartBuilder\Aggregation\Measure;
use Wtroiano\ChartBuilder\Contracts\ChartContext;
use Wtroiano\ChartBuilder\Contracts\DatasetProvider;
use Wtroiano\ChartBuilder\Database\AggregationDialect;
use Wtroiano\ChartBuilder\Database\SqlExpression as Expression;
use Wtroiano\ChartBuilder\Exceptions\ChartException;
use Wtroiano\ChartBuilder\Support\Json;
use Wtroiano\ChartBuilder\Support\ResourceBudget;
use Wtroiano\ChartBuilder\Support\Value;

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
        $categories = $this->categoriesFor($base, $context, $dialect);
        if ($this->fill !== []) {
            $context->budget->expansion(count($buckets) * max(1, count($categories) + (int) $this->other), count($this->groups) + count($this->measures) + 1);
        }

        $selected = clone $base;
        if ($this->top !== null) {
            $this->constrain($selected, $categories, false);
        }

        $rows = $this->aggregate($selected, $context, $dialect, $buckets);
        if ($this->other) {
            $remainder = clone $base;
            $this->constrain($remainder, $categories, true);
            $rows = array_merge($rows, $this->aggregate($remainder, $context, $dialect, $buckets, true));
        }

        return $this->normalize($rows, $categories, $buckets, $context);
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

    /** @return list<array<string, mixed>> */
    private function categoriesFor(Builder $base, ChartContext $context, AggregationDialect $dialect): array
    {
        if ($this->groups === []) {
            return [[]];
        }

        $query = clone $base;
        $query->select($this->groups)->groupBy(...$this->groups);
        foreach ($this->groups as $column) {
            $dialect->column($query, $column);
        }

        if ($this->top !== null) {
            $measure = $this->measures[$this->rank ?? ''];
            $expression = $dialect->measure($query, $measure);
            $aggregate = explode(' AS ', $expression)[0];
            $query->addSelect(new Expression($expression))
                ->orderBy(new Expression('CASE WHEN '.$aggregate.' IS NULL THEN 1 ELSE 0 END'))
                ->orderByDesc($measure->alias);
        }

        foreach ($this->groups as $column) {
            $query->orderBy($column);
        }

        $query->limit($this->top ?? $context->budget->limit('categories') + 1);
        $categories = [];
        foreach ($query->cursor() as $row) {
            $values = Value::map($row);
            foreach (array_keys($this->measures) as $alias) {
                unset($values[$alias]);
            }

            $categories[Json::identity($values)] = $values;
            $context->budget->check('categories', count($categories));
        }

        foreach ($this->domain as $category) {
            $categories[Json::identity($category)] = $category;
            $context->budget->check('categories', count($categories));
        }

        return array_values($categories);
    }

    /** @param list<array<string, mixed>> $categories */
    private function constrain(Builder $query, array $categories, bool $exclude): void
    {
        if ($categories === []) {
            if (! $exclude) {
                $query->whereRaw('1 = 0');
            }

            return;
        }

        // CASE yields a non-null membership boolean, so NULL groups survive exclusion.
        $parts = [];
        $bindings = [];
        $dialect = new AggregationDialect;
        foreach ($categories as $category) {
            $terms = [];
            foreach ($this->groups as $column) {
                $name = str_contains($column, '.') ? mb_substr($column, mb_strrpos($column, '.') + 1) : $column;
                $value = $category[$name];
                $terms[] = $dialect->column($query, $column).($value === null ? ' IS NULL' : ' = ?');
                if ($value !== null) {
                    $bindings[] = $value;
                }
            }

            $parts[] = '('.implode(' AND ', $terms).')';
        }

        $query->whereRaw(new Expression('(CASE WHEN '.implode(' OR ', $parts).' THEN 1 ELSE 0 END) = '.($exclude ? '0' : '1')), $bindings);
    }

    /** @param list<array{start: string, until: string, timezone: string, partial: bool}> $buckets
     * @return list<array<string, mixed>>
     */
    private function aggregate(Builder $query, ChartContext $context, AggregationDialect $dialect, array $buckets, bool $other = false): array
    {
        $query->select([]);
        if (! $other) {
            foreach ($this->groups as $column) {
                $query->addSelect($column)->groupBy($column)->orderBy($column);
            }
        }

        if ($this->dateColumn !== null) {
            $parts = [];
            $bindings = [];
            $column = $dialect->column($query, $this->dateColumn);
            foreach ($buckets as $index => $bucket) {
                $parts[] = 'WHEN '.$column.' >= ? AND '.$column.' < ? THEN '.$index;
                $bindings[] = CarbonImmutable::parse($bucket['start'])->format('Y-m-d H:i:s');
                $bindings[] = CarbonImmutable::parse($bucket['until'])->format('Y-m-d H:i:s');
            }

            $expression = 'CASE '.implode(' ', $parts).' END';
            $query->addSelect(new Expression($expression.' AS '.$query->getGrammar()->wrap('__bucket_index')))
                ->addBinding($bindings, 'select')->groupBy('__bucket_index')->orderBy('__bucket_index');
        }

        foreach ($this->measures as $measure) {
            $query->addSelect(new Expression($dialect->measure($query, $measure)));
        }

        $query->limit($context->budget->remainingItems() + 1);
        $rows = [];
        foreach ($query->cursor() as $row) {
            $context->budget->items();
            $values = Value::map($row);
            if ($other) {
                foreach ($this->groups as $column) {
                    $name = str_contains($column, '.') ? mb_substr($column, mb_strrpos($column, '.') + 1) : $column;
                    $values[$name] = 'Other';
                }

                $values['__other'] = true;
            }

            $context->budget->inspect($values);
            $rows[] = $values;
        }

        return $rows;
    }

    /** @param list<array<string, mixed>> $rows
     * @param  list<array<string, mixed>>  $categories
     * @param  list<array{start: string, until: string, timezone: string, partial: bool}>  $buckets
     */
    private function normalize(array $rows, array $categories, array $buckets, ChartContext $context): ResolvedDataset
    {
        $normalized = [];
        foreach ($rows as $row) {
            $bucket = isset($row['__bucket_index']) ? $buckets[(int) Value::number($row['__bucket_index'])] : null;
            unset($row['__bucket_index']);
            if ($bucket !== null) {
                $row['period'] = $bucket['start'];
                $row['__bucket'] = $bucket;
            }

            foreach ($this->measures as $measure) {
                $value = $row[$measure->alias];
                if (is_string($value)) {
                    throw_if(preg_match('/^-?\\d+$/D', $value) && abs((float) $value) > 9007199254740991, ChartException::class, 'Integer aggregates exceed JavaScript safe precision.');

                    $display = Value::map($row['__display'] ?? []);
                    $display[$measure->alias] = $value;
                    $row['__display'] = $display;
                }

                $row[$measure->alias] = $value === null ? null : ($this->scale === null ? Value::number($value) : round(Value::number($value), $this->scale));
            }

            $row['id'] = $this->rowId($row);
            $normalized[$row['id']] = $row;
        }

        if ($this->fill !== []) {
            $fillCategories = $categories;
            if ($this->other) {
                $other = ['__other' => true];
                foreach ($this->groups as $column) {
                    $name = str_contains($column, '.') ? mb_substr($column, mb_strrpos($column, '.') + 1) : $column;
                    $other[$name] = 'Other';
                }

                $fillCategories[] = $other;
            }

            foreach ($buckets as $bucket) {
                foreach ($fillCategories as $category) {
                    $row = [...$category, 'period' => $bucket['start'], '__bucket' => $bucket];
                    foreach ($this->measures as $measure) {
                        $row[$measure->alias] = $this->fill[$measure->alias] ?? null;
                    }

                    $row['id'] = $this->rowId($row);
                    if (! isset($normalized[$row['id']])) {
                        $context->budget->items();
                        $context->budget->inspect($row);
                        $normalized[$row['id']] = $row;
                    }
                }
            }
        }

        foreach ($this->groups as $column) {
            $name = str_contains($column, '.') ? mb_substr($column, mb_strrpos($column, '.') + 1) : $column;
            foreach ($normalized as &$row) {
                $keys = Value::map($row['__categoryKeys'] ?? []);
                $keys[$name] = Json::identity([$row['__other'] ?? false, $row[$name]]);
                $row['__categoryKeys'] = $keys;
                $row[$name] = $row[$name] === null ? null : (string) Value::scalar($row[$name]);
            }

            unset($row);
        }

        // Normalize from the converted grouping values and a fresh budget; final chart validation combines all datasets.
        $prepared = Dataset::rows(array_values($normalized))->key('id');
        if ($buckets !== []) {
            $prepared->dimension('period', 'datetime', false);
        }

        foreach ($this->groups as $column) {
            $name = str_contains($column, '.') ? mb_substr($column, mb_strrpos($column, '.') + 1) : $column;
            $prepared->dimension($name, 'string');
        }

        foreach ($this->measures as $measure) {
            $prepared->dimension($measure->alias, 'number');
        }

        $fresh = new ChartContext($context->request, $context->state, $context->locale, $context->timezone, $context->now, $context->scopeKey, new ResourceBudget($context->budget->limits));

        return $prepared->resolve($fresh);
    }

    /** @param array<string, mixed> $row */
    private function rowId(array $row): string
    {
        $identity = [$row['period'] ?? null, $row['__other'] ?? false];
        foreach ($this->groups as $column) {
            $name = str_contains($column, '.') ? mb_substr($column, mb_strrpos($column, '.') + 1) : $column;
            $identity[] = $row[$name];
        }

        return Json::identity($identity);
    }
}
