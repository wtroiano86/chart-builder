<?php

declare(strict_types=1);

namespace Wtroiano\ChartBuilder\Contracts;

use Wtroiano\ChartBuilder\Datasets\ResolvedDataset;

interface DatasetProvider
{
    public function resolve(ChartContext $context): ResolvedDataset;
}
