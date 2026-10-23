<?php

declare(strict_types=1);

namespace Wtroiano\ChartBuilder\Support;

use stdClass;
use Wtroiano\ChartBuilder\Exceptions\ChartException;

final class Value
{
    public static function dimension(mixed $value, string $type, bool $nullable): bool
    {
        if ($value === null) {
            return $nullable;
        }

        return match ($type) {
            'number' => is_int($value) || is_float($value),
            'boolean' => is_bool($value),
            'string' => is_string($value),
            'date', 'datetime' => is_string($value)
                && preg_match($type === 'date' ? '/^\d{4}-\d{2}-\d{2}$/D' : '/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?Z$/D', $value) === 1
                && checkdate((int) mb_substr($value, 5, 2), (int) mb_substr($value, 8, 2), (int) mb_substr($value, 0, 4)),
            default => false,
        };
    }

    /** @return array<string, mixed> */
    public static function map(mixed $value): array
    {
        if ($value instanceof stdClass) {
            $value = get_object_vars($value);
        }

        throw_unless(is_array($value), ChartException::class, 'Expected a chart object.');

        foreach (array_keys($value) as $key) {
            throw_unless(is_string($key), ChartException::class, 'Object keys must be strings.');
        }

        return array_combine(array_map(static fn (string $key): string => $key, array_keys($value)), array_values($value));
    }

    /** @return list<mixed> */
    public static function list(mixed $value): array
    {
        throw_if(! is_array($value) || ! array_is_list($value), ChartException::class, 'Expected a chart list.');

        return $value;
    }

    public static function string(mixed $value): string
    {
        throw_unless(is_string($value), ChartException::class, 'Expected a chart string.');

        return $value;
    }

    public static function scalar(mixed $value): string|int|float|bool|null
    {
        throw_if(! is_scalar($value) && $value !== null, ChartException::class, 'Expected a scalar chart value.');

        return $value;
    }

    public static function number(mixed $value): float
    {
        throw_unless(is_numeric($value), ChartException::class, 'Expected a numeric chart value.');

        return (float) $value;
    }
}
