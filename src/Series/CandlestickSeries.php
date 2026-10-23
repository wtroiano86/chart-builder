<?php

declare(strict_types=1);

namespace Wtroiano\ChartBuilder\Series;

final class CandlestickSeries
{
    public static function make(string $id): Series
    {
        return Series::make($id, 'candlestick');
    }
}
