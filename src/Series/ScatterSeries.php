<?php

declare(strict_types=1);

namespace Wtroiano\ChartBuilder\Series;

final class ScatterSeries
{
    public static function make(string $id): Series
    {
        return Series::make($id, 'scatter');
    }
}
