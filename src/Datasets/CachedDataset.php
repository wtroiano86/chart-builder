<?php

declare(strict_types=1);

namespace Wtroiano\ChartBuilder\Datasets;

use Illuminate\Support\Facades\Cache;
use Wtroiano\ChartBuilder\Charts\PayloadValidator;
use Wtroiano\ChartBuilder\Contracts\ChartContext;
use Wtroiano\ChartBuilder\Contracts\DatasetProvider;
use Wtroiano\ChartBuilder\Exceptions\ChartException;
use Wtroiano\ChartBuilder\Support\Json;
use Wtroiano\ChartBuilder\Support\ResourceBudget;

final readonly class CachedDataset implements DatasetProvider
{
    /** @param array<string, mixed> $variation */
    public function __construct(
        private DatasetProvider $provider,
        private string $namespace,
        private int $ttl,
        private array $variation,
        private string $version,
    ) {
        throw_if($namespace === '' || $ttl < 1 || ! isset($variation['scope']), ChartException::class, 'Caching requires a namespace, positive TTL and explicit scope variation.');
    }

    public function resolve(ChartContext $context): ResolvedDataset
    {
        $key = $this->key($context);
        $cached = Cache::get($key);
        if ($cached instanceof ResolvedDataset) {
            new PayloadValidator()->validateDataset($cached->data, $context->budget);

            return $cached;
        }

        $resolved = $this->provider->resolve($context);
        $context->budget->serialized($resolved->data);
        new PayloadValidator()->validateDataset($resolved->data, new ResourceBudget($context->budget->limits));
        Cache::put($key, $resolved, $this->ttl);

        return $resolved;
    }

    public function forget(ChartContext $context): void
    {
        Cache::forget($this->key($context));
    }

    private function key(ChartContext $context): string
    {
        return 'chart-builder:'.$this->namespace.':'.Json::identity([
            $this->version, $this->variation, $context->scopeKey, $context->state, $context->timezone, $context->locale,
        ]);
    }
}
