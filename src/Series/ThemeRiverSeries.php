<?php

declare(strict_types=1);

namespace Wtroiano\ChartBuilder\Series;

final class ThemeRiverSeries
{
    public static function make(string $id): Series
    {
        return Series::make($id, 'themeRiver');
    }
}
