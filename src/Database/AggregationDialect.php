<?php

declare(strict_types=1);

namespace Wtroiano\ChartBuilder\Database;

use Illuminate\Database\Query\Builder;
use Illuminate\Database\Query\Grammars\MySqlGrammar;
use Illuminate\Database\Query\Grammars\PostgresGrammar;
use Illuminate\Database\Query\Grammars\SQLiteGrammar;
use Wtroiano\ChartBuilder\Aggregation\Measure;
use Wtroiano\ChartBuilder\Exceptions\ChartException;

final class AggregationDialect
{
    public function assertSupported(Builder $query): void
    {
        $grammar = $query->getGrammar();
        throw_if(! $grammar instanceof SQLiteGrammar && ! $grammar instanceof MySqlGrammar && ! $grammar instanceof PostgresGrammar, ChartException::class, 'Unsupported aggregation database driver.');
    }

    public function column(Builder $query, string $column): string
    {
        throw_unless(preg_match('/^[a-zA-Z_][a-zA-Z0-9_]*(?:\\.[a-zA-Z_][a-zA-Z0-9_]*)?$/D', $column), ChartException::class, 'Grouping and aggregate columns must be trusted identifiers.');

        return $query->getGrammar()->wrap($column);
    }

    public function measure(Builder $query, Measure $measure): string
    {
        $column = $measure->column === '*' ? '*' : $this->column($query, $measure->column);
        $expression = $measure->function === 'distinct' ? 'COUNT(DISTINCT '.$column.')' : mb_strtoupper($measure->function).'('.$column.')';

        return $expression.' AS '.$query->getGrammar()->wrap($measure->alias);
    }
}
