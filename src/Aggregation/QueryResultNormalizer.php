<?php

declare(strict_types=1);

namespace Wtroiano\ChartBuilder\Aggregation;

use Wtroiano\ChartBuilder\Contracts\ChartContext;
use Wtroiano\ChartBuilder\Datasets\Dataset;
use Wtroiano\ChartBuilder\Datasets\ResolvedDataset;
use Wtroiano\ChartBuilder\Exceptions\ChartException;
use Wtroiano\ChartBuilder\Support\Json;
use Wtroiano\ChartBuilder\Support\ResourceBudget;
use Wtroiano\ChartBuilder\Support\Value;

/** @internal */
final readonly class QueryResultNormalizer
{
    /** @param list<string> $groups
     * @param  array<string, Measure>  $measures
     * @param  array<string, int|float|null>  $fill
     */
    public function __construct(
        private array $groups,
        private array $measures,
        private array $fill,
        private bool $other,
        private ?int $scale,
    ) {}

    /** @param list<array<string, mixed>> $rows
     * @param  list<array<string, mixed>>  $categories
     * @param  list<array{start: string, until: string, timezone: string, partial: bool}>  $buckets
     */
    public function normalize(array $rows, array $categories, array $buckets, ChartContext $context): ResolvedDataset
    {
        $normalized = $this->rows($rows, $buckets);
        $this->fill($normalized, $categories, $buckets, $context);
        $this->categoryValues($normalized);

        return $this->prepared($normalized, $buckets !== [], $context);
    }

    /** @param list<array<string, mixed>> $rows
     * @param  list<array{start: string, until: string, timezone: string, partial: bool}>  $buckets
     * @return array<string, array<string, mixed>>
     */
    private function rows(array $rows, array $buckets): array
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

        return $normalized;
    }

    /** @param array<string, array<string, mixed>> $normalized
     * @param  list<array<string, mixed>>  $categories
     * @param  list<array{start: string, until: string, timezone: string, partial: bool}>  $buckets
     */
    private function fill(array &$normalized, array $categories, array $buckets, ChartContext $context): void
    {
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

    }

    /** @param array<string, array<string, mixed>> $normalized */
    private function categoryValues(array &$normalized): void
    {
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

    }

    /** @param array<string, array<string, mixed>> $normalized */
    private function prepared(array $normalized, bool $hasBuckets, ChartContext $context): ResolvedDataset
    {
        // Normalize from the converted grouping values and a fresh budget; final chart validation combines all datasets.
        $prepared = Dataset::rows(array_values($normalized))->key('id');
        if ($hasBuckets) {
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
