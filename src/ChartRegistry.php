<?php

declare(strict_types=1);

namespace Wtroiano\ChartBuilder;

use Closure;
use Wtroiano\ChartBuilder\Exceptions\ChartException;
use Wtroiano\ChartBuilder\Support\Json;

final class ChartRegistry
{
    /** @var array<string, Closure(): Chart> */
    private array $factories = [];

    /** @param Closure(): Chart $factory */
    public function register(string $name, Closure $factory): void
    {
        Json::identifier($name);
        throw_if(isset($this->factories[$name]), ChartException::class, 'Chart '.$name.' is already registered.');

        $this->factories[$name] = $factory;
    }

    public function get(string $name): Chart
    {
        return ($this->factories[$name] ?? throw new ChartException('Chart '.$name.' is not registered.'))();
    }
}
