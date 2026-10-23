<?php

declare(strict_types=1);

namespace Wtroiano\ChartBuilder\Aggregation;

use Wtroiano\ChartBuilder\Exceptions\ChartException;
use Wtroiano\ChartBuilder\Support\Json;

final readonly class Measure
{
    public function __construct(public string $function, public string $column, public string $alias)
    {
        Json::identifier($alias);
        throw_unless(in_array($function, ['sum', 'count', 'distinct', 'avg', 'min', 'max'], true), ChartException::class, 'Unsupported aggregate function.');

        throw_if($column === '*' && $function !== 'count', ChartException::class, 'Only count accepts the wildcard column.');
    }
}
