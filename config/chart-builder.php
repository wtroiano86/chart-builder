<?php

declare(strict_types=1);

return [
    'adapter' => 'echarts',
    'locale' => 'en-US',
    'timezone' => 'UTC',
    'height' => 320,
    'limits' => [
        'buckets' => 1000,
        'categories' => 100,
        'series' => 50,
        'items' => 10000,
        'dimensions' => 64,
        'scalars' => 100000,
        'depth' => 32,
        'bytes' => 2097152,
    ],
];
