<?php

declare(strict_types=1);

namespace Wtroiano\ChartBuilder\Axes;

use Wtroiano\ChartBuilder\Support\Json;

final class Axis
{
    /** @var array{id: string, coordinateId: string, kind: string, position: string, title: ?string, domain: array{min: ?float, max: ?float, categories: ?list<string|int|float>}, logBase: int|float|null, formatId: ?string} */
    private array $definition;

    public function __construct(string $id, string $kind = 'value', string $position = 'left', string $coordinate = 'main')
    {
        $this->definition = [
            'id' => Json::identifier($id), 'coordinateId' => $coordinate, 'kind' => $kind, 'position' => $position,
            'title' => null, 'domain' => ['min' => null, 'max' => null, 'categories' => null],
            'logBase' => $kind === 'log' ? 10 : null, 'formatId' => null,
        ];
    }

    public static function make(string $id, string $kind = 'value', string $position = 'left', string $coordinate = 'main'): self
    {
        return new self($id, $kind, $position, $coordinate);
    }

    public function title(string $title): self
    {
        $this->definition['title'] = $title;

        return $this;
    }

    public function range(?float $min, ?float $max): self
    {
        $this->definition['domain']['min'] = $min;
        $this->definition['domain']['max'] = $max;

        return $this;
    }

    /** @param list<string|int|float> $categories */
    public function categories(array $categories): self
    {
        $this->definition['domain']['categories'] = $categories;

        return $this;
    }

    public function logBase(float $base): self
    {
        $this->definition['logBase'] = $base;

        return $this;
    }

    public function format(string $id): self
    {
        $this->definition['formatId'] = $id;

        return $this;
    }

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return $this->definition;
    }
}
