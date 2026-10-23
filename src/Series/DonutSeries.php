<?php

declare(strict_types=1);

namespace Wtroiano\ChartBuilder\Series;

final class DonutSeries
{
    public static function make(string $id): Series
    {
        return Series::make($id, 'pie')->radius(0.5, 0.8);
    }
}
