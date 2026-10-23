<?php

declare(strict_types=1);

namespace Wtroiano\ChartBuilder\Charts;

use Wtroiano\ChartBuilder\Chart;
use Wtroiano\ChartBuilder\ChartBuilder;
use Wtroiano\ChartBuilder\Exceptions\ChartException;

final class ConfiguredChart extends Chart
{
    public function __construct(private readonly ChartConfiguration $config) {}

    public function definition(): ChartBuilder
    {
        throw new ChartException('A built chart has an immutable configuration; create a new builder to change it.');
    }

    public function configuration(): ChartConfiguration
    {
        return $this->config;
    }
}
