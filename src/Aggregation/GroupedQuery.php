<?php

declare(strict_types=1);

namespace Wtroiano\ChartBuilder\Aggregation;

use Carbon\CarbonImmutable;
use Illuminate\Database\Query\Builder;
use Wtroiano\ChartBuilder\Contracts\ChartContext;
use Wtroiano\ChartBuilder\Database\AggregationDialect;
use Wtroiano\ChartBuilder\Database\SqlExpression as Expression;
use Wtroiano\ChartBuilder\Support\Json;
use Wtroiano\ChartBuilder\Support\Value;

/** @internal */
final readonly class GroupedQuery
{
    /** @param list<string> $groups
     * @param  array<string, Measure>  $measures
     */
    public function __construct(private array $groups, private array $measures) {}

    /** @param list<array<string, mixed>> $domain
     * @return list<array<string, mixed>>
     */
    public function categories(Builder $base, ChartContext $context, array $domain, ?int $top, ?string $rank): array
    {
        if ($this->groups === []) {
            return [[]];
        }

        $dialect = new AggregationDialect;
        $query = clone $base;
        $query->select($this->groups)->groupBy(...$this->groups);
        foreach ($this->groups as $column) {
            $dialect->column($query, $column);
        }

        if ($top !== null) {
            $measure = $this->measures[$rank ?? ''];
            $expression = $dialect->measure($query, $measure);
            $aggregate = explode(' AS ', $expression)[0];
            $query->addSelect(new Expression($expression))
                ->orderBy(new Expression('CASE WHEN '.$aggregate.' IS NULL THEN 1 ELSE 0 END'))
                ->orderByDesc($measure->alias);
        }

        foreach ($this->groups as $column) {
            $query->orderBy($column);
        }

        $query->limit($top ?? $context->budget->limit('categories') + 1);
        $categories = [];
        foreach ($query->cursor() as $row) {
            $values = Value::map($row);
            foreach (array_keys($this->measures) as $alias) {
                unset($values[$alias]);
            }

            $categories[Json::identity($values)] = $values;
            $context->budget->check('categories', count($categories));
        }

        foreach ($domain as $category) {
            $categories[Json::identity($category)] = $category;
            $context->budget->check('categories', count($categories));
        }

        return array_values($categories);
    }

    /** @param list<array<string, mixed>> $categories */
    public function constrain(Builder $query, array $categories, bool $exclude): void
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
    public function aggregate(Builder $query, ChartContext $context, array $buckets, ?string $dateColumn, bool $other = false): array
    {
        $dialect = new AggregationDialect;
        $query->select([]);
        if (! $other) {
            foreach ($this->groups as $column) {
                $query->addSelect($column)->groupBy($column)->orderBy($column);
            }
        }

        if ($dateColumn !== null) {
            $parts = [];
            $bindings = [];
            $column = $dialect->column($query, $dateColumn);
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
}
