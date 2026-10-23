<?php

declare(strict_types=1);

namespace Wtroiano\ChartBuilder\Datasets;

use Closure;
use Illuminate\Database\Eloquent\Builder as EloquentBuilder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Query\Builder;
use Wtroiano\ChartBuilder\Contracts\ChartContext;
use Wtroiano\ChartBuilder\Contracts\DatasetProvider;

final class Dataset
{
    /** @param iterable<array<string, mixed>> $rows */
    public static function rows(iterable $rows): RowsDataset
    {
        return new RowsDataset($rows);
    }

    /** @param list<array<string, mixed>> $roots */
    public static function hierarchy(array $roots): PreparedDataset
    {
        return new PreparedDataset(['kind' => 'hierarchy', 'roots' => $roots]);
    }

    /** @param list<array<string, mixed>> $nodes
     * @param  list<array<string, mixed>>  $links
     */
    public static function graph(array $nodes, array $links, bool $directed = true): PreparedDataset
    {
        return new PreparedDataset(['kind' => 'graph', 'nodes' => $nodes, 'links' => $links, 'directed' => $directed]);
    }

    /** @param list<array{id: string, value: mixed}> $items */
    public static function series(array $items, RowsDataset $projection, ?string $adapter = null): CustomDataset
    {
        return new CustomDataset($items, $projection, $adapter);
    }

    /** @param DatasetProvider|Closure(ChartContext): (ResolvedDataset|iterable<array<string, mixed>>) $provider */
    public static function using(DatasetProvider|Closure $provider): DatasetProvider
    {
        return $provider instanceof DatasetProvider ? $provider : new CallbackDataset($provider);
    }

    /** @param Builder|EloquentBuilder<Model>|Closure(): (Builder|EloquentBuilder<Model>) $query */
    public static function query(Builder|EloquentBuilder|Closure $query): QueryDataset
    {
        return new QueryDataset($query);
    }

    /** @param array<string, mixed> $variation */
    public static function cached(DatasetProvider $provider, string $namespace, int $ttl, array $variation, string $version = '1'): CachedDataset
    {
        return new CachedDataset($provider, $namespace, $ttl, $variation, $version);
    }
}
