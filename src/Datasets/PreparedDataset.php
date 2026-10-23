<?php

declare(strict_types=1);

namespace Wtroiano\ChartBuilder\Datasets;

use Wtroiano\ChartBuilder\Contracts\ChartContext;
use Wtroiano\ChartBuilder\Contracts\DatasetProvider;
use Wtroiano\ChartBuilder\Exceptions\ChartException;
use Wtroiano\ChartBuilder\Support\Json;

final readonly class PreparedDataset implements DatasetProvider
{
    /** @param array<string, mixed> $input */
    public function __construct(private array $input) {}

    public function resolve(ChartContext $context): ResolvedDataset
    {
        $seen = [];
        if ($this->input['kind'] === 'hierarchy') {
            /** @var list<array<string, mixed>> $roots */
            $roots = $this->input['roots'];

            return new ResolvedDataset(['kind' => 'hierarchy', 'roots' => $this->nodes($roots, $context, $seen)]);
        }

        /** @var list<array<string, mixed>> $nodes */
        $nodes = $this->input['nodes'];
        /** @var list<array<string, mixed>> $links */
        $links = $this->input['links'];
        $result = [];
        foreach ($nodes as $node) {
            $id = $this->id($node, $seen, $context);
            $result[] = [
                'id' => $id, 'label' => $node['label'] ?? $id,
                'value' => $node['value'] ?? null,
                'attributes' => (object) ($node['attributes'] ?? []),
            ];
        }

        $edges = [];
        $linkIds = [];
        foreach ($links as $link) {
            $id = $this->id($link, $linkIds, $context);
            $source = $link['source'] ?? null;
            $target = $link['target'] ?? null;
            throw_if(! is_string($source) || ! is_string($target) || ! isset($seen[$source], $seen[$target]), ChartException::class, 'Graph links must reference existing nodes.');

            $edges[] = [
                'id' => $id, 'source' => $source, 'target' => $target,
                'label' => $link['label'] ?? null, 'value' => $link['value'] ?? null,
            ];
        }

        return new ResolvedDataset(['kind' => 'graph', 'nodes' => $result, 'links' => $edges, 'directed' => $this->input['directed']]);
    }

    /** @param list<array<string, mixed>> $nodes
     * @param  array<string, true>  $seen
     * @return list<array<string, mixed>>
     */
    private function nodes(array $nodes, ChartContext $context, array &$seen, int $depth = 1): array
    {
        $result = [];
        foreach ($nodes as $node) {
            $context->budget->check('depth', $depth);
            $id = $this->id($node, $seen, $context);
            $children = $node['children'] ?? [];
            throw_if(! is_array($children) || ! array_is_list($children), ChartException::class, 'Hierarchy children must be a list.');

            /** @var list<array<string, mixed>> $children */
            $result[] = [
                'id' => $id, 'label' => $node['label'] ?? $id, 'value' => $node['value'] ?? null,
                'children' => $this->nodes($children, $context, $seen, $depth + 1),
            ];
        }

        return $result;
    }

    /** @param array<string, mixed> $item
     * @param  array<string, true>  $seen
     */
    private function id(array $item, array &$seen, ChartContext $context): string
    {
        $context->budget->items();
        $id = $item['id'] ?? null;
        throw_if(! is_string($id) || $id === '' || isset($seen[$id]), ChartException::class, 'Structured data requires unique nonempty string IDs.');

        $seen[$id] = true;
        unset($item['children']);
        $context->budget->inspect(Json::object($item));

        return $id;
    }
}
