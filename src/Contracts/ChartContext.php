<?php

declare(strict_types=1);

namespace Wtroiano\ChartBuilder\Contracts;

use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Wtroiano\ChartBuilder\Support\ResourceBudget;

final readonly class ChartContext
{
    /** @param array<string, mixed> $state */
    public function __construct(
        public Request $request,
        public array $state,
        public string $locale,
        public string $timezone,
        public CarbonImmutable $now,
        public string $scopeKey,
        public ResourceBudget $budget,
    ) {}
}
