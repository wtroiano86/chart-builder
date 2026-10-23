<?php

declare(strict_types=1);

namespace Wtroiano\ChartBuilder\Support;

use Opis\JsonSchema\Validator;
use stdClass;
use Wtroiano\ChartBuilder\Exceptions\ChartException;

final class SchemaValidator
{
    public function validate(string $contract, mixed $value): void
    {
        $path = dirname(__DIR__, 2).'/resources/schemas/'.$contract.'.v1.json';
        $schema = json_decode((string) file_get_contents($path), flags: JSON_THROW_ON_ERROR);
        $this->against($schema, $value);
    }

    public function against(mixed $schema, mixed $value): void
    {
        $encoded = Json::encode($schema);
        $decoded = json_decode($encoded, flags: JSON_THROW_ON_ERROR);
        throw_if(! $decoded instanceof stdClass && ! is_bool($decoded), ChartException::class, 'A JSON Schema must be an object or boolean.');

        $this->localReferences($decoded);
        $result = new Validator()->validate(
            json_decode(Json::encode($value), flags: JSON_THROW_ON_ERROR),
            $decoded,
        );
        throw_unless($result->isValid(), ChartException::class, 'Chart contract validation failed.');
    }

    private function localReferences(mixed $value): void
    {
        if (! is_array($value) && ! $value instanceof stdClass) {
            return;
        }

        foreach (is_array($value) ? $value : get_object_vars($value) as $key => $child) {
            throw_if(in_array($key, ['$ref', '$dynamicRef'], true) && (! is_string($child) || ! str_starts_with($child, '#')), ChartException::class, 'Schema references must be local.');

            $this->localReferences($child);
        }
    }
}
