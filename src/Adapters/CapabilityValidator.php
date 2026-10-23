<?php

declare(strict_types=1);

namespace Wtroiano\ChartBuilder\Adapters;

use Wtroiano\ChartBuilder\Exceptions\ChartException;
use Wtroiano\ChartBuilder\Support\SchemaValidator;
use Wtroiano\ChartBuilder\Support\Value;

final class CapabilityValidator
{
    /** @param array<string, mixed> $chart
     * @param  array<string, mixed>  $manifest
     */
    public function validate(array $chart, array $manifest, bool $resolved): void
    {
        $adapter = Value::string(Value::map($chart['adapter'])['name']);
        throw_if($manifest['apiVersion'] !== 1 || ! in_array(1, Value::list($manifest['payloadSchemaVersions']), true), ChartException::class, 'Incompatible adapter API or payload version.');

        $mode = Value::map($chart['appearance'])['renderingMode'];
        if ($mode !== null && ! in_array($mode, Value::list($manifest['renderingModes']), true)) {
            $this->fail('appearance.renderingMode');
        }

        $coordinates = [];
        foreach (Value::list($chart['coordinates']) as $coordinate) {
            $value = Value::map($coordinate);
            $coordinates[Value::string($value['id'])] = $value['kind'];
        }

        $types = Value::map($manifest['series']);
        $combinations = [];
        foreach (Value::list($chart['series']) as $index => $input) {
            $series = Value::map($input);
            $type = Value::string($series['type']);
            $path = 'series.'.$index;
            $capability = Value::map($types[$type] ?? []);
            $coordinateId = $series['coordinateId'];
            $coordinate = $coordinateId === null ? 'none' : ($coordinates[Value::string($coordinateId)] ?? '');
            if ($capability === [] || ! in_array($coordinate, Value::list($capability['coordinates']), true)) {
                $this->fail($path.'.type/coordinate');
            }

            if ($series['requiredAdapter'] !== null && $series['requiredAdapter'] !== $adapter) {
                $this->fail($path.'.requiredAdapter');
            }

            $combinations[Value::string($coordinateId ?? 'none')][$type] = true;
            $this->options(Value::map($series['adapterOptions'])[$adapter] ?? [], true);
            if ($resolved) {
                $datasets = Value::map($chart['datasets']);
                $dataset = Value::map($datasets[Value::string($series['datasetId'])] ?? []);
                if (! isset($dataset['kind']) || ! in_array($dataset['kind'], Value::list($capability['datasetKinds']), true) || ! in_array($dataset['kind'], Value::list($manifest['datasetKinds']), true)) {
                    $this->fail($path.'.datasetId');
                }

                if (($dataset['requiredAdapter'] ?? null) !== null && $dataset['requiredAdapter'] !== $adapter) {
                    $this->fail($path.'.datasetId.requiredAdapter');
                }

                $this->mapping($series, $dataset, $capability, $path);
            }
        }

        foreach ($combinations as $coordinateId => $combination) {
            if (count($combination) < 2) {
                continue;
            }

            $kind = $coordinates[$coordinateId] ?? 'none';
            $supported = false;
            foreach (Value::list($manifest['mixedSeries']) as $input) {
                $rule = Value::map($input);
                if ($rule['coordinate'] === $kind && array_diff(array_keys($combination), array_map(Value::string(...), Value::list($rule['types']))) === []) {
                    $supported = true;
                }
            }

            if (! $supported) {
                $this->fail('coordinates.'.$coordinateId.'.mixedSeries');
            }
        }

        $features = Value::map($manifest['features']);
        foreach (Value::list($chart['requirements']) as $input) {
            $requirement = Value::map($input);
            $name = Value::string($requirement['name']);
            $feature = Value::map($features[$name] ?? []);
            $target = Value::map($requirement['target']);
            if ($feature === [] || ! in_array($target['kind'], Value::list($feature['scopes']), true)) {
                $this->fail('requirements.'.$name);
            }

            new SchemaValidator()->against($feature['optionsSchema'], $requirement['options']);
        }

        foreach (Value::list($chart['extensions']) as $input) {
            $extension = Value::map($input);
            if ($extension['requiredAdapter'] !== null && $extension['requiredAdapter'] !== $adapter) {
                $this->fail('extensions.requiredAdapter');
            }
        }

        $this->options(Value::map($chart['adapterOptions'])[$adapter] ?? [], false);
    }

    /** @param array<string, mixed> $series
     * @param  array<string, mixed>  $dataset
     * @param  array<string, mixed>  $capability
     */
    private function mapping(array $series, array $dataset, array $capability, string $path): void
    {
        $roles = Value::map($capability['roles']);
        $mapping = Value::map($series['encode']);
        $dimensions = [];
        foreach (Value::list($dataset['dimensions'] ?? []) as $input) {
            $dimension = Value::map($input);
            $dimensions[Value::string($dimension['key'])] = $dimension['type'];
        }

        foreach ($mapping as $role => $fields) {
            if (! isset($roles[$role])) {
                $this->fail($path.'.encode.'.$role);
            }

            $rule = Value::map($roles[$role]);
            $names = Value::list($fields);
            if (count($names) < $rule['minFields'] || count($names) > $rule['maxFields']) {
                $this->fail($path.'.encode.'.$role);
            }

            foreach ($names as $name) {
                if (! in_array($dimensions[Value::string($name)] ?? null, Value::list($rule['dimensionTypes']), true)) {
                    $this->fail($path.'.encode.'.$role);
                }
            }
        }

        foreach ($roles as $role => $input) {
            $rule = Value::map($input);
            if ($rule['required'] && ! isset($mapping[$role])) {
                $this->fail($path.'.encode.'.$role);
            }
        }
    }

    private function options(mixed $value, bool $series): void
    {
        $options = Value::map($value);
        $protected = $series ? ['id', 'name', 'type', 'data', 'datasetId', 'datasetIndex', 'encode', 'coordinateSystem', 'xAxisIndex', 'yAxisIndex', 'gridIndex', 'polarIndex', 'angleAxisIndex', 'radiusAxisIndex', 'geoIndex', 'radarIndex', 'calendarIndex', 'matrixIndex', 'parallelIndex', 'singleAxisIndex', 'renderItem', 'links', 'nodes', 'edges'] : ['dataset', 'series', 'xAxis', 'yAxis', 'angleAxis', 'radiusAxis', 'parallelAxis', 'singleAxis', 'grid', 'polar', 'geo', 'radar', 'calendar', 'matrix', 'parallel'];
        foreach ($protected as $key) {
            throw_if(array_key_exists($key, $options), ChartException::class, 'Adapter options cannot override managed field '.$key.'.');
        }
    }

    private function fail(string $path): never
    {
        throw new ChartException('The selected adapter does not support '.$path.'.', 'unsupported_feature');
    }
}
