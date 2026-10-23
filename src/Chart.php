<?php

declare(strict_types=1);

namespace Wtroiano\ChartBuilder;

use Illuminate\Contracts\Support\Arrayable;
use Illuminate\Http\Request;
use JsonSerializable;
use Wtroiano\ChartBuilder\Charts\ChartConfiguration;
use Wtroiano\ChartBuilder\Charts\ChartResolver;
use Wtroiano\ChartBuilder\Payloads\ChartPayload;
use Wtroiano\ChartBuilder\Payloads\ChartResult;

/** @implements Arrayable<string, mixed> */
abstract class Chart implements Arrayable, JsonSerializable
{
    abstract public function definition(): ChartBuilder;

    public function configuration(): ChartConfiguration
    {
        return $this->definition()->configuration();
    }

    public function resolve(Request $request): ChartPayload
    {
        return resolve(ChartResolver::class)->resolve($this->configuration(), $request);
    }

    public function result(Request $request): ChartResult
    {
        return resolve(ChartResolver::class)->result($this->configuration(), $request);
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return $this->resolve(request())->toArray();
    }

    /** @return array<string, mixed> */
    public function jsonSerialize(): array
    {
        return $this->toArray();
    }
}
