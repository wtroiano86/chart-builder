<?php

declare(strict_types=1);

namespace Wtroiano\ChartBuilder\Aggregation;

use Carbon\CarbonImmutable;
use Wtroiano\ChartBuilder\Exceptions\ChartException;
use Wtroiano\ChartBuilder\Support\ResourceBudget;

final class BucketPlanner
{
    /** @return list<array{start: string, until: string, timezone: string, partial: bool}> */
    public function plan(CarbonImmutable $from, CarbonImmutable $until, string $interval, string $timezone, ResourceBudget $budget, int $weekStartsOn = 1): array
    {
        throw_if($from >= $until || $weekStartsOn < 1 || $weekStartsOn > 7, ChartException::class, 'A time range must have from < until and a valid ISO week start.');

        $local = $from->setTimezone($timezone);
        $cursor = match ($interval) {
            'minute' => $local->startOfMinute(),
            'hour' => $local->startOfHour(),
            'day' => $local->startOfDay(),
            'week' => $local->startOfWeek($weekStartsOn % 7),
            'month' => $local->startOfMonth(),
            'quarter' => $local->startOfQuarter(),
            'year' => $local->startOfYear(),
            default => throw new ChartException('Unsupported bucket interval.'),
        };
        $buckets = [];
        while ($cursor < $until) {
            $budget->check('buckets', count($buckets) + 1);
            $end = match ($interval) {
                'minute' => $cursor->utc()->addMinute()->setTimezone($timezone),
                'hour' => $cursor->utc()->addHour()->setTimezone($timezone),
                'day' => $cursor->addDay(),
                'week' => $cursor->addWeek(),
                'month' => $cursor->addMonth(),
                'quarter' => $cursor->addQuarter(),
                default => $cursor->addYear(),
            };
            $buckets[] = [
                'start' => $cursor->utc()->format('Y-m-d\TH:i:s.u\Z'),
                'until' => $end->utc()->format('Y-m-d\TH:i:s.u\Z'),
                'timezone' => $timezone,
                'partial' => $cursor < $from || $end > $until,
            ];
            $cursor = $end;
        }

        return $buckets;
    }
}
