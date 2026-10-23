<?php

declare(strict_types=1);

namespace Wtroiano\ChartBuilder\Series;

use stdClass;
use Wtroiano\ChartBuilder\Support\Json;

final class Series
{
    /** @var array{id: string, label: string, type: string, datasetId: string, coordinateId: ?string, axes: array<string, string>, encode: array<string, list<string>>, itemIds: ?list<string>, formatId: ?string, requiredAdapter: ?string, rendererName: ?string, presentation: array<string, mixed>, adapterOptions: array<string, stdClass>} */
    private array $definition;

    /** @var array<string, mixed>|null */
    private ?array $format = null;

    private ?string $split = null;

    public function __construct(string $id, string $type)
    {
        $this->definition = [
            'id' => Json::identifier($id), 'label' => $id, 'type' => $type,
            'datasetId' => 'default', 'coordinateId' => null, 'axes' => [], 'encode' => [],
            'itemIds' => null, 'formatId' => null, 'requiredAdapter' => null, 'rendererName' => null,
            'presentation' => [
                'color' => null, 'stack' => null, 'orientation' => 'vertical', 'area' => false,
                'step' => null, 'smooth' => false, 'radius' => null, 'symbolSize' => null,
            ],
            'adapterOptions' => [],
        ];
    }

    public static function make(string $id, string $type = 'line'): self
    {
        return new self($id, $type);
    }

    public function label(string $label): self
    {
        $this->definition['label'] = $label;

        return $this;
    }

    public function dataset(string $name): self
    {
        $this->definition['datasetId'] = $name;

        return $this;
    }

    public function coordinate(?string $id): self
    {
        $this->definition['coordinateId'] = $id;

        return $this;
    }

    public function axis(string $role, string $id): self
    {
        $this->definition['axes'][$role] = $id;

        return $this;
    }

    public function encode(string $role, string ...$fields): self
    {
        $this->definition['encode'][$role] = array_values($fields);

        return $this;
    }

    public function value(string $field): self
    {
        return $this->encode('value', $field);
    }

    public function splitBy(string $field): self
    {
        $this->split = $field;

        return $this;
    }

    public function color(string $color): self
    {
        $this->definition['presentation']['color'] = $color;

        return $this;
    }

    public function stack(?string $group = 'default'): self
    {
        $this->definition['presentation']['stack'] = $group;

        return $this;
    }

    public function horizontal(bool $enabled = true): self
    {
        $this->definition['presentation']['orientation'] = $enabled ? 'horizontal' : 'vertical';

        return $this;
    }

    public function area(bool $enabled = true): self
    {
        $this->definition['presentation']['area'] = $enabled;

        return $this;
    }

    public function step(?string $position = 'end'): self
    {
        $this->definition['presentation']['step'] = $position;

        return $this;
    }

    public function smooth(bool $enabled = true): self
    {
        $this->definition['presentation']['smooth'] = $enabled;

        return $this;
    }

    public function radius(float $inner, float $outer = 1): self
    {
        $this->definition['presentation']['radius'] = [$inner, $outer];

        return $this;
    }

    public function symbolSize(float $pixels): self
    {
        $this->definition['presentation']['symbolSize'] = $pixels;

        return $this;
    }

    /** @param array<string, mixed> $options */
    public function adapterOptions(string $adapter, array $options): self
    {
        $this->definition['adapterOptions'][$adapter] = Json::object($options);

        return $this;
    }

    public function requiresAdapter(string $name): self
    {
        $this->definition['requiredAdapter'] = $name;

        return $this;
    }

    public function renderer(string $name): self
    {
        $this->definition['rendererName'] = $name;

        return $this;
    }

    /** @param array<string, mixed> $descriptor */
    public function format(array $descriptor): self
    {
        $this->format = $descriptor;
        $this->definition['formatId'] = $this->definition['id'].'-format';

        return $this;
    }

    public function currency(string $currency, int $decimals = 2): self
    {
        return $this->format(['kind' => 'currency', 'currency' => $currency, 'decimals' => $decimals]);
    }

    public function decimals(int $decimals, bool $compact = false): self
    {
        return $this->format(['kind' => 'number', 'decimals' => $decimals, 'compact' => $compact]);
    }

    public function percent(string $input = 'ratio', int $decimals = 1): self
    {
        return $this->format(['kind' => 'percent', 'input' => $input, 'decimals' => $decimals]);
    }

    /** @return array<string, mixed>|null */
    public function formatDescriptor(): ?array
    {
        return $this->format;
    }

    public function splitField(): ?string
    {
        return $this->split;
    }

    /** @return array<string, mixed> */
    public function definition(?string $xField = null): array
    {
        $data = $this->definition;
        if ($xField !== null && in_array($data['type'], ['line', 'bar', 'scatter', 'effectScatter', 'pictorialBar', 'heatmap', 'boxplot', 'candlestick'], true) && $data['coordinateId'] === null) {
            $data['coordinateId'] = 'main';
            $data['axes'] = ['x' => 'x', 'y' => 'y', ...$data['axes']];
            if (isset($data['encode']['value'])) {
                $data['encode']['y'] = $data['encode']['value'];
                unset($data['encode']['value']);
            }

            $data['encode']['x'] ??= [$xField];
        }

        return array_replace($data, ['axes' => Json::object($data['axes']), 'encode' => Json::object($data['encode']), 'adapterOptions' => Json::object($data['adapterOptions'])]);
    }
}
