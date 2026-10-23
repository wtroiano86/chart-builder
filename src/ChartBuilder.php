<?php

declare(strict_types=1);

namespace Wtroiano\ChartBuilder;

use Closure;
use Illuminate\Http\Request;
use stdClass;
use Wtroiano\ChartBuilder\Axes\Axis;
use Wtroiano\ChartBuilder\Charts\ChartConfiguration;
use Wtroiano\ChartBuilder\Charts\ConfiguredChart;
use Wtroiano\ChartBuilder\Contracts\DatasetProvider;
use Wtroiano\ChartBuilder\Coordinates\Coordinate;
use Wtroiano\ChartBuilder\Filters\Filter;
use Wtroiano\ChartBuilder\Series\Series;
use Wtroiano\ChartBuilder\Support\Json;

final class ChartBuilder
{
    /** @var array{schemaVersion: int, name: string, adapter: array<string, mixed>, title: ?string, description: ?string, datasets: array<string, mixed>, series: list<array<string, mixed>>, axes: list<array<string, mixed>>, coordinates: list<array<string, mixed>>, formats: array<string, array<string, mixed>>, state: array<string, mixed>, filters: list<array<string, mixed>>, appearance: array<string, mixed>, interactions: array{navigation: list<array<string, mixed>>, callbacks: array<string, string>}, requirements: list<array<string, mixed>>, adapterOptions: array<string, stdClass>, extensions: list<array<string, mixed>>, meta: array<string, mixed>} */
    private array $payload;

    /** @var array<string, DatasetProvider> */
    private array $providers = [];

    /** @var list<Series> */
    private array $series = [];

    /** @var list<Filter> */
    private array $filters = [];

    /** @var Closure(Request): bool|null */
    private ?Closure $authorize = null;

    /** @var Closure(Request): string|null */
    private ?Closure $scope = null;

    /** @var array<string, int> */
    private array $limits = [];

    private ?string $xField = null;

    private function __construct(string $name)
    {
        $this->payload = [
            'schemaVersion' => 1, 'name' => Json::identifier($name),
            'adapter' => ['name' => config('chart-builder.adapter', 'echarts'), 'apiVersion' => 1, 'manifestVersion' => '1.0.0'],
            'title' => null, 'description' => null, 'datasets' => [], 'series' => [],
            'axes' => [], 'coordinates' => [], 'formats' => [], 'state' => [], 'filters' => [],
            'appearance' => [
                'theme' => 'system', 'palette' => ['#2563eb', '#d97706', '#059669', '#9333ea', '#dc2626'],
                'height' => config('chart-builder.height', 320),
                'legend' => ['visible' => true, 'position' => 'bottom'], 'tooltip' => true, 'animation' => true,
                'renderingMode' => null,
            ],
            'interactions' => ['navigation' => [], 'callbacks' => []],
            'requirements' => [], 'adapterOptions' => [], 'extensions' => [],
            'meta' => ['locale' => config('chart-builder.locale', 'en-US'), 'timezone' => config('chart-builder.timezone', 'UTC')],
        ];
    }

    public static function make(string $name): self
    {
        return new self($name);
    }

    /** @param Closure(Request): bool $authorize */
    public function authorize(Closure $authorize): self
    {
        $this->authorize = $authorize;

        return $this;
    }

    public function public(): self
    {
        return $this->authorize(static fn (Request $request): bool => true);
    }

    /** @param Closure(Request): string $scope */
    public function scope(Closure $scope): self
    {
        $this->scope = $scope;

        return $this;
    }

    public function adapter(string $name): self
    {
        $this->payload['adapter']['name'] = Json::identifier($name);

        return $this;
    }

    public function title(string $title): self
    {
        $this->payload['title'] = $title;

        return $this;
    }

    public function description(string $description): self
    {
        $this->payload['description'] = $description;

        return $this;
    }

    public function data(DatasetProvider $provider): self
    {
        $this->providers['default'] = $provider;

        return $this;
    }

    /** @param array<string, DatasetProvider> $datasets */
    public function datasets(array $datasets): self
    {
        $this->providers = $datasets;

        return $this;
    }

    /** @param list<Series> $series */
    public function series(array $series): self
    {
        $this->series = $series;

        return $this;
    }

    public function xAxis(string $field, string $kind = 'category'): self
    {
        $this->xField = $field;
        $this->payload['axes'] = [Axis::make('x', $kind, 'bottom')->definition(), Axis::make('y')->definition()];
        $this->payload['coordinates'] = [Coordinate::cartesian()->definition()];

        return $this;
    }

    /** @param list<Axis> $axes */
    public function axes(array $axes): self
    {
        $this->payload['axes'] = array_map(static fn (Axis $axis): array => $axis->definition(), $axes);

        return $this;
    }

    /** @param list<Coordinate> $coordinates */
    public function coordinates(array $coordinates): self
    {
        $this->payload['coordinates'] = array_map(static fn (Coordinate $coordinate): array => $coordinate->definition(), $coordinates);

        return $this;
    }

    /** @param list<Filter> $filters */
    public function filters(array $filters): self
    {
        $this->filters = $filters;

        return $this;
    }

    /** @param array<string, mixed> $descriptor */
    public function format(string $id, array $descriptor): self
    {
        $this->payload['formats'][$id] = $descriptor;

        return $this;
    }

    public function locale(string $locale): self
    {
        $this->payload['meta']['locale'] = $locale;

        return $this;
    }

    public function timezone(string $timezone): self
    {
        $this->payload['meta']['timezone'] = $timezone;

        return $this;
    }

    public function theme(string $theme): self
    {
        $this->payload['appearance']['theme'] = $theme;

        return $this;
    }

    /** @param list<string> $colors */
    public function palette(array $colors): self
    {
        $this->payload['appearance']['palette'] = $colors;

        return $this;
    }

    public function height(int $pixels): self
    {
        $this->payload['appearance']['height'] = $pixels;

        return $this;
    }

    public function legend(bool $visible = true, string $position = 'bottom'): self
    {
        $this->payload['appearance']['legend'] = ['visible' => $visible, 'position' => $position];

        return $this;
    }

    public function tooltip(bool $enabled = true): self
    {
        $this->payload['appearance']['tooltip'] = $enabled;

        return $this;
    }

    public function animation(bool $enabled = true): self
    {
        $this->payload['appearance']['animation'] = $enabled;

        return $this;
    }

    public function renderingMode(?string $mode): self
    {
        $this->payload['appearance']['renderingMode'] = $mode;

        return $this;
    }

    /** @param array<string, mixed> $options */
    public function adapterOptions(string $adapter, array $options): self
    {
        $this->payload['adapterOptions'][$adapter] = Json::object($options);

        return $this;
    }

    /** @param array<string, mixed> $options */
    public function requireFeature(string $name, array $options = [], ?string $series = null): self
    {
        $this->payload['requirements'][] = ['name' => $name, 'target' => $series === null ? ['kind' => 'chart'] : ['kind' => 'series', 'id' => $series], 'options' => Json::object($options)];

        return $this;
    }

    /** @param array<string, mixed> $params */
    public function extension(string $kind, string $name, array $params = [], ?string $adapter = null): self
    {
        $this->payload['extensions'][] = ['kind' => $kind, 'name' => $name, 'requiredAdapter' => $adapter, 'params' => Json::object($params)];

        return $this;
    }

    public function on(string $event, string $handler): self
    {
        $this->payload['interactions']['callbacks'][$event] = $handler;

        return $this->requireFeature('interaction.'.$event);
    }

    public function navigate(string $series, string $dataset, string $datum, string $url, string $kind = 'row', string $target = '_self'): self
    {
        $this->payload['interactions']['navigation'][] = ['seriesId' => $series, 'datum' => ['datasetId' => $dataset, 'kind' => $kind, 'id' => $datum], 'url' => $url, 'target' => $target];

        return $this->requireFeature('interaction.point-activate');
    }

    /** @param array<string, int> $limits */
    public function limits(array $limits): self
    {
        $this->limits = $limits;

        return $this;
    }

    public function build(): Chart
    {
        return new ConfiguredChart($this->configuration());
    }

    public function configuration(): ChartConfiguration
    {
        return new ChartConfiguration(
            $this->payload,
            array_map(static fn (DatasetProvider $provider): DatasetProvider => clone $provider, $this->providers),
            array_map(static fn (Series $series): Series => clone $series, $this->series),
            array_map(static fn (Filter $filter): Filter => clone $filter, $this->filters),
            $this->authorize, $this->scope, $this->limits, $this->xField,
        );
    }
}
