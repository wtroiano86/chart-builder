<?php

declare(strict_types=1);

namespace Wtroiano\ChartBuilder\Charts;

use Wtroiano\ChartBuilder\Exceptions\ChartException;
use Wtroiano\ChartBuilder\Support\ResourceBudget;
use Wtroiano\ChartBuilder\Support\SchemaValidator;
use Wtroiano\ChartBuilder\Support\Value;

final class PayloadValidator
{
    /** @param array<string, mixed> $dataset */
    public function validateDataset(array $dataset, ResourceBudget $budget): void
    {
        $budget->inspect($dataset);
        new SchemaValidator()->validate('dataset', $dataset);
        $this->dataset($dataset, $budget);
    }

    /** @param array<string, mixed> $chart */
    public function validate(array $chart, ResourceBudget $budget): void
    {
        $budget->serialized($chart);
        new SchemaValidator()->validate('chart-payload', $chart);
        $coordinates = $this->index($chart['coordinates']);
        $axes = $this->index($chart['axes']);
        $series = $this->index($chart['series']);
        $budget->check('series', count($series));
        $formats = Value::map($chart['formats']);
        $datasets = Value::map($chart['datasets']);
        $items = [];
        foreach ($datasets as $id => $input) {
            $dataset = Value::map($input);
            $items[$id] = $this->dataset($dataset, $budget);
        }

        $this->axes($axes, $coordinates, $formats);
        $this->series($series, $datasets, $coordinates, $axes, $formats, $items);
        $this->requirements(Value::list($chart['requirements']), $series);
        $this->navigation(Value::list(Value::map($chart['interactions'])['navigation']), $series, $datasets, $items);
    }

    /** @param array<string, array<string, mixed>> $axes
     * @param  array<string, array<string, mixed>>  $coordinates
     * @param  array<string, mixed>  $formats
     */
    private function axes(array $axes, array $coordinates, array $formats): void
    {
        foreach ($axes as $axis) {
            throw_unless(isset($coordinates[Value::string($axis['coordinateId'])]), ChartException::class, 'Axes must reference an existing coordinate.');

            $domain = Value::map($axis['domain']);
            throw_if(($domain['min'] !== null && $domain['max'] !== null && $domain['min'] > $domain['max']) || ($axis['kind'] === 'log' && (($domain['min'] !== null && $domain['min'] <= 0) || $axis['logBase'] <= 1)), ChartException::class, 'Invalid axis domain.');

            $this->format($axis['formatId'], $formats);
        }

    }

    /** @param array<string, array<string, mixed>> $series
     * @param  array<string, mixed>  $datasets
     * @param  array<string, array<string, mixed>>  $coordinates
     * @param  array<string, array<string, mixed>>  $axes
     * @param  array<string, mixed>  $formats
     * @param  array<string, array<string, true>>  $items
     */
    private function series(array $series, array $datasets, array $coordinates, array $axes, array $formats, array $items): void
    {
        foreach ($series as $value) {
            $datasetId = Value::string($value['datasetId']);
            throw_unless(isset($datasets[$datasetId]), ChartException::class, 'Series reference an unknown dataset.');

            throw_if($value['coordinateId'] !== null && ! isset($coordinates[Value::string($value['coordinateId'])]), ChartException::class, 'Series reference an unknown coordinate.');

            foreach (Value::map($value['axes']) as $axisId) {
                $axis = $axes[Value::string($axisId)] ?? null;
                throw_if($axis === null || $axis['coordinateId'] !== $value['coordinateId'], ChartException::class, 'Series axes must belong to their coordinate.');
            }

            $this->format($value['formatId'], $formats);
            if ($value['itemIds'] !== null) {
                throw_if(in_array(Value::map($datasets[$datasetId])['kind'], ['hierarchy', 'graph'], true), ChartException::class, 'Structured datasets cannot select individual items.');
                foreach (Value::list($value['itemIds']) as $id) {
                    throw_unless(isset($items[$datasetId][Value::string($id)]), ChartException::class, 'Series item selection contains an unknown datum.');
                }
            }

            $presentation = Value::map($value['presentation']);
            $radius = $presentation['radius'];
            if ($radius !== null) {
                $range = Value::list($radius);
                throw_if($range[0] < 0 || $range[0] > $range[1] || $range[1] > 1, ChartException::class, 'Radial bounds must be ordered fractions.');
            }
        }

    }

    /** @param list<mixed> $requirements
     * @param  array<string, array<string, mixed>>  $series
     */
    private function requirements(array $requirements, array $series): void
    {
        foreach ($requirements as $input) {
            $target = Value::map(Value::map($input)['target']);
            throw_if($target['kind'] === 'series' && ! isset($series[Value::string($target['id'])]), ChartException::class, 'Feature target series does not exist.');
        }

    }

    /** @param list<mixed> $rules
     * @param  array<string, array<string, mixed>>  $series
     * @param  array<string, mixed>  $datasets
     * @param  array<string, array<string, true>>  $items
     */
    private function navigation(array $rules, array $series, array $datasets, array $items): void
    {
        foreach ($rules as $input) {
            $navigation = Value::map($input);
            $datum = Value::map($navigation['datum']);
            $id = Value::string($datum['id']);
            $datasetId = Value::string($datum['datasetId']);
            $selected = $series[Value::string($navigation['seriesId'])] ?? [];
            throw_if(($selected['datasetId'] ?? null) !== $datasetId || ! isset($items[$datasetId][$id]), ChartException::class, 'Navigation must reference a datum in its series.');
            $dataset = Value::map($datasets[$datasetId]);
            $kind = $dataset['kind'] === 'graph' ? $datum['kind'] : match ($dataset['kind']) {
                'hierarchy' => 'node', 'series' => 'item', default => 'row'
            };
            throw_if($datum['kind'] !== $kind || ($dataset['kind'] === 'graph' && (! in_array($kind, ['node', 'link'], true) || ! isset($this->index($dataset[$kind === 'link' ? 'links' : 'nodes'])[$id]))) || ($selected['itemIds'] !== null && ! in_array($id, Value::list($selected['itemIds']), true)), ChartException::class, 'Navigation datum kind or selection does not match.');

            $url = Value::string($navigation['url']);
            throw_if(preg_match('/[\\x00-\\x20\\\\]/', $url) || ! preg_match('~^(?:/(?!/)|https?://[^/]+(?:/|$))~i', $url), ChartException::class, 'Navigation requires a relative application path or HTTP(S) URL.');
        }
    }

    /** @return array<string, array<string, mixed>> */
    private function index(mixed $input): array
    {
        $result = [];
        foreach (Value::list($input) as $item) {
            $value = Value::map($item);
            $id = Value::string($value['id']);
            throw_if($id === '' || isset($result[$id]), ChartException::class, 'Definition IDs must be nonempty and unique.');

            $result[$id] = $value;
        }

        return $result;
    }

    /** @param array<string, mixed> $dataset
     * @return array<string, true>
     */
    private function dataset(array $dataset, ResourceBudget $budget): array
    {
        $ids = [];
        if ($dataset['kind'] === 'hierarchy') {
            $this->tree(Value::list($dataset['roots']), $budget, $ids);

            return $ids;
        }

        if ($dataset['kind'] === 'graph') {
            $nodes = $this->index($dataset['nodes']);
            $links = $this->index($dataset['links']);
            $budget->items(count($nodes) + count($links));
            foreach ($links as $link) {
                throw_unless(isset($nodes[Value::string($link['source'])], $nodes[Value::string($link['target'])]), ChartException::class, 'Graph link endpoint is unknown.');
            }

            return array_fill_keys([...array_keys($nodes), ...array_keys($links)], true);
        }

        $rows = $this->index($dataset[$dataset['kind'] === 'rows' ? 'rows' : 'items']);
        $budget->items(count($rows));
        if ($dataset['kind'] === 'series') {
            $projection = $this->dataset(Value::map($dataset['projection']), $budget);
            throw_if(array_keys($rows) !== array_keys($projection), ChartException::class, 'Custom items require matching projection row IDs.');
        } else {
            $dimensions = [];
            foreach (Value::list($dataset['dimensions']) as $input) {
                $dimension = Value::map($input);
                $key = Value::string($dimension['key']);
                throw_if(isset($dimensions[$key]), ChartException::class, 'Dimension names must be unique.');

                $dimensions[$key] = $dimension;
            }

            $budget->check('dimensions', count($dimensions));
            foreach ($rows as $row) {
                $values = Value::map($row['values']);
                throw_if(array_diff_key($dimensions, $values) !== [] || array_diff_key($values, $dimensions) !== [] || array_diff_key(Value::map($row['display']), $dimensions) !== [], ChartException::class, 'Row values and display fields must match declared dimensions.');
                foreach ($dimensions as $key => $dimension) {
                    throw_unless(Value::dimension($values[$key], Value::string($dimension['type']), $dimension['nullable'] === true), ChartException::class, 'Row value does not match dimension '.$key.'.');
                }
            }
        }

        return array_fill_keys(array_keys($rows), true);
    }

    /** @param list<mixed> $nodes
     * @param  array<string, true>  $ids
     */
    private function tree(array $nodes, ResourceBudget $budget, array &$ids, int $depth = 1): void
    {
        foreach ($nodes as $input) {
            $budget->check('depth', $depth);
            $node = Value::map($input);
            $id = Value::string($node['id']);
            throw_if($id === '' || isset($ids[$id]), ChartException::class, 'Hierarchy node IDs must be nonempty and unique.');

            $ids[$id] = true;
            $budget->items();
            $this->tree(Value::list($node['children']), $budget, $ids, $depth + 1);
        }
    }

    /** @param array<string, mixed> $formats */
    private function format(mixed $id, array $formats): void
    {
        throw_if($id !== null && ! isset($formats[Value::string($id)]), ChartException::class, 'Unknown formatter reference.');
    }
}
