<?php

declare(strict_types=1);

namespace Wtroiano\ChartBuilder\Datasets;

use Closure;
use Wtroiano\ChartBuilder\Contracts\ChartContext;
use Wtroiano\ChartBuilder\Contracts\DatasetProvider;

final readonly class CallbackDataset implements DatasetProvider
{
    /** @param Closure(ChartContext): (ResolvedDataset|iterable<array<string, mixed>>) $callback */
    public function __construct(private Closure $callback) {}

    public function resolve(ChartContext $context): ResolvedDataset
    {
        $value = ($this->callback)($context);

        return $value instanceof ResolvedDataset ? $value : Dataset::rows($value)->resolve($context);
    }
}
