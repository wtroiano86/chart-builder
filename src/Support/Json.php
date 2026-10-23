<?php

declare(strict_types=1);

namespace Wtroiano\ChartBuilder\Support;

use JsonException;
use stdClass;
use Wtroiano\ChartBuilder\Exceptions\ChartException;

final class Json
{
    public static function encode(mixed $value): string
    {
        try {
            return json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION);
        } catch (JsonException $jsonException) {
            throw new ChartException('Chart values must be finite JSON: '.$jsonException->getMessage());
        }
    }

    /** @param array<array-key, mixed> $value */
    public static function object(array $value): stdClass
    {
        return (object) $value;
    }

    public static function identifier(string $value): string
    {
        throw_unless(preg_match('/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/D', $value), ChartException::class, 'Identifiers must be 1–128 letters, digits, dots, colons, underscores or hyphens.');

        return $value;
    }

    /** @param array<array-key, mixed> $tuple */
    public static function identity(array $tuple): string
    {
        return hash('sha256', self::encode($tuple));
    }

    /** @return array<string, mixed> */
    public static function read(string $path): array
    {
        $json = file_get_contents($path);
        throw_if($json === false, ChartException::class, 'Unable to read chart contract: '.$path);

        $value = json_decode($json, true, flags: JSON_THROW_ON_ERROR);
        throw_if(! is_array($value) || array_is_list($value), ChartException::class, 'Expected a JSON object: '.$path);

        /** @var array<string, mixed> $value */
        return $value;
    }
}
