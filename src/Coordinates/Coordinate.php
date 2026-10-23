<?php

declare(strict_types=1);

namespace Wtroiano\ChartBuilder\Coordinates;

use Wtroiano\ChartBuilder\Support\Json;

final readonly class Coordinate
{
    /** @param array<string, mixed> $options */
    public function __construct(public string $id, public string $kind, public array $options = [])
    {
        Json::identifier($id);
    }

    public static function cartesian(string $id = 'main', float $left = 0, float $top = 0, float $width = 1, float $height = 1): self
    {
        return new self($id, 'cartesian', ['bounds' => [$left, $top, $width, $height]]);
    }

    public static function polar(string $id = 'main', float $x = 0.5, float $y = 0.5, float $radius = 0.8): self
    {
        return new self($id, 'polar', ['center' => [$x, $y], 'radius' => $radius]);
    }

    /** @param list<array{id: string, label: string, min: int|float, max: int|float}> $indicators */
    public static function radar(string $id, array $indicators): self
    {
        return new self($id, 'radar', ['indicators' => $indicators]);
    }

    public static function geo(string $id, string $asset, ?string $projection = null): self
    {
        return new self($id, 'geo', ['asset' => $asset, 'projection' => $projection]);
    }

    public static function calendar(string $id, string $from, string $until, int $weekStartsOn = 1): self
    {
        return new self($id, 'calendar', ['from' => $from, 'until' => $until, 'weekStartsOn' => $weekStartsOn]);
    }

    /** @param list<string> $rows
     * @param  list<string>  $columns
     */
    public static function matrix(string $id, array $rows, array $columns): self
    {
        return new self($id, 'matrix', ['rows' => $rows, 'columns' => $columns]);
    }

    public static function parallel(string $id = 'main'): self
    {
        return new self($id, 'parallel');
    }

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return ['id' => $this->id, 'kind' => $this->kind, ...$this->options];
    }
}
