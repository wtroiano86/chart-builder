<?php

declare(strict_types=1);

namespace Wtroiano\ChartBuilder\Adapters;

use Wtroiano\ChartBuilder\Exceptions\ChartException;
use Wtroiano\ChartBuilder\Support\Json;
use Wtroiano\ChartBuilder\Support\SchemaValidator;
use Wtroiano\ChartBuilder\Support\Value;

final class AdapterRegistry
{
    /** @var array<string, array<string, mixed>> */
    private array $manifests = [];

    /** @param array<string, mixed> $manifest */
    public function register(array $manifest): void
    {
        $wire = $manifest;
        $wire['series'] = (object) array_map(static function (mixed $entry): mixed {
            if (is_array($entry)) {
                $entry['roles'] = (object) ($entry['roles'] ?? []);
            }

            return $entry;
        }, Value::map($manifest['series'] ?? []));
        $wire['features'] = (object) ($manifest['features'] ?? []);
        new SchemaValidator()->validate('adapter-manifest', $wire);
        $name = $manifest['name'];
        throw_if(! is_string($name) || isset($this->manifests[$name]), ChartException::class, 'An adapter name must be unique.');

        Json::identifier($name);
        $this->manifests[$name] = $manifest;
    }

    public function registerFile(string $path): void
    {
        $this->register(Json::read($path));
    }

    /** @return array<string, mixed> */
    public function get(string $name): array
    {
        if (in_array($name, ['echarts', 'shadcn'], true) && ! isset($this->manifests[$name])) {
            $this->registerFile(dirname(__DIR__, 2).'/resources/manifests/'.$name.'.json');
        }

        return $this->manifests[$name] ?? throw new ChartException('Adapter '.$name.' is not registered.');
    }
}
