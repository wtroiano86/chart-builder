<?php

declare(strict_types=1);

namespace Wtroiano\ChartBuilder\Datasets;

use Wtroiano\ChartBuilder\Contracts\ChartContext;
use Wtroiano\ChartBuilder\Contracts\DatasetProvider;
use Wtroiano\ChartBuilder\Exceptions\ChartException;
use Wtroiano\ChartBuilder\Support\Json;
use Wtroiano\ChartBuilder\Support\Value;

final class RowsDataset implements DatasetProvider
{
    private ?string $keyColumn = null;

    /** @var array<string, array{key: string, label: string, type: string, nullable: bool}> */
    private array $dimensions = [];

    /** @param iterable<array<string, mixed>> $rows */
    public function __construct(private readonly iterable $rows) {}

    public function key(string $column): self
    {
        $this->keyColumn = $column;

        return $this;
    }

    public function dimension(string $name, string $type = 'number', bool $nullable = true, ?string $label = null): self
    {
        $this->dimensions[$name] = ['key' => $name, 'label' => $label ?? $name, 'type' => $type, 'nullable' => $nullable];

        return $this;
    }

    public function resolve(ChartContext $context): ResolvedDataset
    {
        $rows = [];
        $ids = [];
        $dimensions = $this->dimensions;
        foreach ($this->rows as $row) {
            $context->budget->items();
            $context->budget->inspect($row);
            if ($dimensions === []) {
                foreach ($row as $name => $value) {
                    if ($name === $this->keyColumn || str_starts_with($name, '__')) {
                        continue;
                    }

                    $dimensions[$name] = [
                        'key' => $name, 'label' => $name,
                        'type' => is_int($value) || is_float($value) ? 'number' : (is_bool($value) ? 'boolean' : 'string'),
                        'nullable' => true,
                    ];
                }
            }

            $context->budget->check('dimensions', count($dimensions));
            $id = $this->keyColumn === null ? 'row:'.count($rows) : ($row[$this->keyColumn] ?? null);
            throw_if(! is_string($id) || $id === '' || isset($ids[$id]), ChartException::class, 'Rows require unique nonempty string keys.');

            $ids[$id] = true;
            $values = [];
            foreach ($dimensions as $name => $dimension) {
                $value = $row[$name] ?? null;
                $valid = Value::dimension($value, $dimension['type'], $dimension['nullable']);
                throw_unless($valid, ChartException::class, 'Invalid value for dimension '.$name.'.');

                $values[$name] = $value;
            }

            $rows[] = [
                'id' => $id,
                ...(isset($row['__categoryKeys']) ? ['categoryKeys' => Json::object(Value::map($row['__categoryKeys']))] : []),
                'values' => Json::object($values),
                'display' => Json::object(is_array($row['__display'] ?? null) ? $row['__display'] : []),
                'bucket' => $row['__bucket'] ?? null,
            ];
        }

        return new ResolvedDataset(['kind' => 'rows', 'identity' => $this->keyColumn === null ? 'snapshot' : 'stable', 'dimensions' => array_values($dimensions), 'rows' => $rows]);
    }
}
