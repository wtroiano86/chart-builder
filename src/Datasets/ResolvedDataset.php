<?php

declare(strict_types=1);

namespace Wtroiano\ChartBuilder\Datasets;

final readonly class ResolvedDataset
{
    /** @param array<string, mixed> $data */
    public function __construct(public array $data) {}
}
