<?php

declare(strict_types=1);

namespace Wtroiano\ChartBuilder\Charts;

use Closure;
use Illuminate\Http\Request;
use Wtroiano\ChartBuilder\Contracts\DatasetProvider;
use Wtroiano\ChartBuilder\Filters\Filter;
use Wtroiano\ChartBuilder\Series\Series;

final readonly class ChartConfiguration
{
    /** @param array<string, mixed> $payload
     * @param  array<string, DatasetProvider>  $providers
     * @param  list<Series>  $series
     * @param  list<Filter>  $filters
     * @param  Closure(Request):bool|null  $authorize
     * @param  Closure(Request):string|null  $scope
     * @param  array<string, int>  $limits
     */
    public function __construct(
        public array $payload,
        public array $providers,
        public array $series,
        public array $filters,
        public ?Closure $authorize,
        public ?Closure $scope,
        public array $limits,
        public ?string $xField,
    ) {}
}
