<?php

declare(strict_types=1);

namespace Wtroiano\ChartBuilder\Support;

use stdClass;
use Wtroiano\ChartBuilder\Exceptions\ChartException;

final class ResourceBudget
{
    private int $items = 0;

    private int $scalars = 0;

    private int $bytes = 0;

    /** @param array<string, int> $limits */
    public function __construct(public readonly array $limits)
    {
        foreach (['items', 'scalars', 'bytes', 'depth', 'dimensions', 'buckets', 'categories', 'series'] as $key) {
            throw_if(($limits[$key] ?? 0) < 1, ChartException::class, 'Resource limits must be positive: '.$key);
        }
    }

    public function limit(string $name): int
    {
        return $this->limits[$name];
    }

    public function check(string $name, int $count): void
    {
        throw_if($count > $this->limit($name), ChartException::class, 'Chart exceeds the '.$name.' limit.', 'limit_exceeded');
    }

    public function remainingItems(): int
    {
        return $this->limit('items') - $this->items;
    }

    public function items(int $count = 1): void
    {
        $this->check('items', $this->items + $count);
        $this->items += $count;
    }

    public function expansion(int $rows, int $dimensions): void
    {
        $this->check('items', $this->items + $rows);
        $this->check('scalars', $this->scalars + $rows * $dimensions);
    }

    public function inspect(mixed $value, int $depth = 0): void
    {
        throw_if($depth > $this->limit('depth') * 2 + 8, ChartException::class, 'Chart JSON exceeds the depth limit.', 'limit_exceeded');
        if (is_array($value) || $value instanceof stdClass) {
            foreach (is_array($value) ? $value : get_object_vars($value) as $key => $child) {
                throw_if(in_array($key, ['__proto__', 'prototype', 'constructor'], true), ChartException::class, 'Prototype-related keys are not allowed.');

                $this->bytes += mb_strlen((string) $key, '8bit') + 4;
                $this->check('bytes', $this->bytes);
                $this->inspect($child, $depth + 1);
            }

            return;
        }

        throw_if(! is_scalar($value) && $value !== null, ChartException::class, 'Charts accept JSON values only.');

        throw_if(is_float($value) && ! is_finite($value), ChartException::class, 'Chart numbers must be finite.');

        throw_if((is_int($value) || (is_float($value) && floor($value) === $value)) && abs($value) > 9007199254740991, ChartException::class, 'Integer measures exceed JavaScript safe precision; transform the measure explicitly.');

        if (is_string($value)) {
            $this->check('bytes', mb_strlen($value, '8bit'));
        }

        $this->check('scalars', ++$this->scalars);
        $this->bytes += mb_strlen(Json::encode($value), '8bit') + 1;
        $this->check('bytes', $this->bytes);
    }

    public function serialized(mixed $value): void
    {
        $fresh = new self($this->limits);
        $fresh->inspect($value);
        $this->check('bytes', mb_strlen(Json::encode($value), '8bit'));
    }
}
