<?php

declare(strict_types=1);

namespace Wtroiano\ChartBuilder\Database;

use Illuminate\Contracts\Database\Query\Expression;
use Illuminate\Database\Grammar;

/** @internal SQL assembled from validated identifiers by the aggregation compiler. Values use bindings. */
final readonly class SqlExpression implements Expression
{
    public function __construct(private string $sql) {}

    public function getValue(Grammar $grammar): string
    {
        return $this->sql;
    }
}
