<?php

declare(strict_types=1);

namespace Wtroiano\ChartBuilder\Datasets;

use Wtroiano\ChartBuilder\Contracts\ChartContext;
use Wtroiano\ChartBuilder\Contracts\DatasetProvider;
use Wtroiano\ChartBuilder\Exceptions\ChartException;

final readonly class CustomDataset implements DatasetProvider
{
    /** @param list<array{id: string, value: mixed}> $items */
    public function __construct(private array $items, private RowsDataset $projection, private ?string $adapter) {}

    public function resolve(ChartContext $context): ResolvedDataset
    {
        $context->budget->expansion(count($this->items) * 2, 1);
        $context->budget->items(count($this->items));
        $context->budget->inspect($this->items);

        $projection = $this->projection->resolve($context)->data;
        $ids = array_column($this->items, 'id');
        /** @var list<array{id: string}> $rows */
        $rows = $projection['rows'];
        throw_if(count(array_unique($ids)) !== count($ids) || $ids !== array_column($rows, 'id'), ChartException::class, 'Custom item IDs must match projection row IDs in order.');

        return new ResolvedDataset(['kind' => 'series', 'requiredAdapter' => $this->adapter, 'items' => $this->items, 'projection' => $projection]);
    }
}
