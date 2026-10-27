<?php

declare(strict_types=1);

namespace Wtroiano\ChartBuilder\Charts;

use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;
use Wtroiano\ChartBuilder\Adapters\AdapterRegistry;
use Wtroiano\ChartBuilder\Adapters\CapabilityValidator;
use Wtroiano\ChartBuilder\Contracts\ChartContext;
use Wtroiano\ChartBuilder\Exceptions\ChartException;
use Wtroiano\ChartBuilder\Filters\Filter;
use Wtroiano\ChartBuilder\Payloads\ChartPayload;
use Wtroiano\ChartBuilder\Payloads\ChartResult;
use Wtroiano\ChartBuilder\Support\Json;
use Wtroiano\ChartBuilder\Support\ResourceBudget;
use Wtroiano\ChartBuilder\Support\Value;

final readonly class ChartResolver
{
    public function __construct(private AdapterRegistry $adapters) {}

    public function resolve(ChartConfiguration $configuration, Request $request): ChartPayload
    {
        $this->authorize($configuration, $request);

        return $this->resolveAuthorized($configuration, $request, $this->scopeKey($configuration, $request));
    }

    public function result(ChartConfiguration $configuration, Request $request): ChartResult
    {
        $token = $request->header('X-Chart-Request');
        $envelope = [
            'schemaVersion' => 1, 'name' => $configuration->payload['name'],
            'requestId' => is_string($token) && preg_match('/^[a-zA-Z0-9_-]{1,128}$/D', $token) ? $token : null,
            'contextKey' => '',
        ];
        try {
            $this->authorize($configuration, $request);
            $envelope['contextKey'] = $this->scopeKey($configuration, $request);
            $data = [...$envelope, 'status' => 'ready', 'chart' => $this->resolveAuthorized($configuration, $request, $envelope['contextKey'])->toArray()];
            $this->budget($configuration)->serialized($data);
        } catch (AuthenticationException|AuthorizationException $exception) {
            return $this->denied($envelope, $exception);
        } catch (ValidationException $exception) {
            $data = [...$envelope, 'status' => 'invalid', 'errors' => Json::object($exception->errors()),
                'filters' => array_map(static fn (Filter $filter): array => $filter->definition(), $configuration->filters),
                'input' => Json::object($this->input($configuration, $request, false)),
            ];
        } catch (Throwable $exception) {
            $reference = (string) Str::uuid();
            report($exception);
            $data = [...$envelope, 'status' => 'error', 'error' => [
                'code' => $exception instanceof ChartException ? $exception->errorCode : 'internal',
                'message' => $exception instanceof ChartException ? mb_substr($exception->getMessage(), 0, 512) : 'The chart could not be loaded.',
                'retryable' => $exception instanceof ChartException && $exception->retryable,
                'referenceId' => $reference,
            ]];
        }

        return new ChartResult($data);
    }

    private function resolveAuthorized(ChartConfiguration $configuration, Request $request, string $scopeKey): ChartPayload
    {
        $chart = $configuration->payload;
        $budget = $this->budget($configuration);
        $state = $this->filters($chart, $configuration, $request);
        $chart['state'] = Json::object($state);
        $chart['adapter'] = Value::map($chart['adapter']);
        $adapter = Value::string(Value::map($chart['adapter'])['name']);
        $manifest = $this->adapters->get($adapter);
        $chart['adapter']['manifestVersion'] = $manifest['manifestVersion'];
        $this->seriesDefinitions($chart, $configuration);

        $budget->check('series', count(Value::list($chart['series'])));
        new CapabilityValidator()->validate($chart, $manifest, false);
        $meta = Value::map($chart['meta']);
        $context = new ChartContext(
            $request, $state, Value::string($meta['locale']), Value::string($meta['timezone']),
            CarbonImmutable::now('UTC'), $scopeKey, $budget,
        );
        $datasets = [];
        foreach ($configuration->providers as $id => $provider) {
            Json::identifier($id);
            $datasets[$id] = $provider->resolve($context)->data;
        }

        $chart['datasets'] = Json::object($datasets);
        $chart['series'] = $this->split($chart, $configuration, $budget);
        $this->selectAdapterOptions($chart, $adapter);
        $chart['formats'] = Json::object(Value::map($chart['formats']));
        $chart['interactions'] = Value::map($chart['interactions']);
        $chart['interactions']['callbacks'] = Json::object(Value::map($chart['interactions']['callbacks']));
        $chart['meta'] = [
            ...$meta,
            'snapshotId' => (string) Str::uuid(), 'queryNamespace' => 'charts['.Value::string($chart['name']).']',
            'resolvedAt' => $context->now->toISOString(),
            'range' => isset($state['from'], $state['until']) ? ['from' => $state['from'], 'until' => $state['until']] : null,
        ];
        new PayloadValidator()->validate($chart, $this->budget($configuration));
        new CapabilityValidator()->validate($chart, $manifest, true);

        return new ChartPayload($chart);
    }

    /** @param array<string, mixed> $envelope */
    private function denied(array $envelope, AuthenticationException|AuthorizationException $exception): ChartResult
    {
        return new ChartResult([
            ...$envelope,
            'status' => 'denied',
            'reason' => $exception instanceof AuthenticationException ? 'unauthenticated' : 'forbidden',
        ]);
    }

    /** @param array<string, mixed> $chart
     * @return array<string, mixed>
     */
    private function filters(array &$chart, ChartConfiguration $configuration, Request $request): array
    {
        $chart['filters'] = Value::list($chart['filters']);
        $state = [];
        $filterKeys = [];
        $input = $this->input($configuration, $request);
        foreach ($configuration->filters as $filter) {
            foreach ($filter->keys() as $key) {
                throw_if(isset($filterKeys[$key]), ChartException::class, 'Filter keys must be unique within a chart.');

                $filterKeys[$key] = true;
            }

            $state = [...$state, ...$filter->resolve($input, Value::string(Value::map($chart['meta'])['timezone']))];
            $chart['filters'][] = $filter->definition();
        }

        return $state;
    }

    /** @param array<string, mixed> $chart */
    private function seriesDefinitions(array &$chart, ChartConfiguration $configuration): void
    {
        $chart['formats'] = Value::map($chart['formats']);
        $chart['requirements'] = Value::list($chart['requirements']);
        $chart['series'] = [];
        foreach ($configuration->series as $definition) {
            $series = $definition->definition($configuration->xField);
            $chart['series'][] = $series;
            if ($definition->formatDescriptor() !== null) {
                $chart['formats'][Value::string($series['formatId'])] = $definition->formatDescriptor();
            }

            $presentation = Value::map($series['presentation']);
            foreach (['stack', 'area', 'step', 'smooth'] as $feature) {
                if ($presentation[$feature] !== false && $presentation[$feature] !== null) {
                    $chart['requirements'][] = ['name' => 'series.'.$feature, 'target' => ['kind' => 'series', 'id' => $series['id']], 'options' => Json::object([])];
                }
            }
        }

        foreach (Value::list($chart['axes']) as $axis) {
            if (Value::map($axis)['kind'] === 'log') {
                $chart['requirements'][] = ['name' => 'axis.log', 'target' => ['kind' => 'chart'], 'options' => Json::object([])];
            }
        }

        foreach (Value::map($chart['formats']) as $format) {
            if (Value::map($format)['kind'] === 'custom') {
                $chart['requirements'][] = ['name' => 'format.custom', 'target' => ['kind' => 'chart'], 'options' => Json::object([])];
            }
        }

    }

    /** @param array<string, mixed> $chart */
    private function selectAdapterOptions(array &$chart, string $adapter): void
    {
        $chart['series'] = array_map(Value::map(...), Value::list($chart['series']));
        $selected = Value::map($chart['adapterOptions']);
        $chart['adapterOptions'] = Json::object(isset($selected[$adapter]) ? [$adapter => $selected[$adapter]] : []);
        foreach ($chart['series'] as &$series) {
            $options = Value::map($series['adapterOptions']);
            $series['adapterOptions'] = Json::object(isset($options[$adapter]) ? [$adapter => $options[$adapter]] : []);
        }

        unset($series);
    }

    private function authorize(ChartConfiguration $configuration, Request $request): void
    {
        if ($configuration->authorize instanceof Closure) {
            throw_unless(($configuration->authorize)($request), AuthorizationException::class);

            return;
        }

        throw_if($request->user() === null, AuthenticationException::class);
    }

    private function scopeKey(ChartConfiguration $configuration, Request $request): string
    {
        $scope = $configuration->scope instanceof Closure ? ($configuration->scope)($request) : (string) Value::scalar($request->user()?->getAuthIdentifier() ?? 'public');

        return hash_hmac('sha256', Json::encode([$configuration->payload['name'], $scope, $request->user()?->getAuthIdentifier()]), Value::string(config('app.key', 'chart-builder')));
    }

    private function budget(ChartConfiguration $configuration): ResourceBudget
    {
        /** @var array<string, int> $configured */
        $configured = config('chart-builder.limits');

        return new ResourceBudget([...$configured, ...$configuration->limits]);
    }

    /** @return array<string, mixed> */
    private function input(ChartConfiguration $configuration, Request $request, bool $strict = true): array
    {
        $charts = $request->query('charts', []);
        $input = is_array($charts) ? ($charts[Value::string($configuration->payload['name'])] ?? []) : [];
        if (! is_array($charts) || ! is_array($input)) {
            if ($strict) {
                throw ValidationException::withMessages(['chart' => 'Chart filters must be an object.']);
            }

            return [];
        }

        $allowed = [];
        foreach ($configuration->filters as $filter) {
            foreach ($filter->keys() as $key) {
                if (! array_key_exists($key, $input)) {
                    continue;
                }

                $value = $input[$key];
                if ($strict && ((is_string($value) && mb_strlen($value) > 256) || (is_array($value) && count($value) > 100))) {
                    throw ValidationException::withMessages([$key => 'The filter exceeds its size limit.']);
                }

                // Reflect only allowlisted bounded data; malformed values still fail validation.
                $allowed[$key] = is_string($value) ? mb_substr($value, 0, 256) : (is_array($value) ? array_map(static fn (mixed $item): string => is_scalar($item) ? mb_substr((string) $item, 0, 256) : '', array_slice($value, 0, 100)) : $value);
            }
        }

        return $allowed;
    }

    /** @param array<string, mixed> $chart
     * @return list<array<string, mixed>>
     */
    private function split(array &$chart, ChartConfiguration $configuration, ResourceBudget $budget): array
    {
        $result = [];
        $datasets = Value::map($chart['datasets']);
        $series = Value::list($chart['series']);
        foreach ($configuration->series as $index => $definition) {
            $item = Value::map($series[$index]);
            $field = $definition->splitField();
            if ($field === null) {
                $result[] = $item;

                continue;
            }

            $dataset = Value::map($datasets[Value::string($item['datasetId'])] ?? []);
            throw_if(($dataset['kind'] ?? null) !== 'rows', ChartException::class, 'Split series require row data.');

            $groups = [];
            foreach (Value::list($dataset['rows']) as $input) {
                $row = Value::map($input);
                $values = Value::map($row['values']);
                throw_unless(array_key_exists($field, $values), ChartException::class, 'Split dimension does not exist.');

                $key = Json::identity([Value::map($row['categoryKeys'] ?? [])[$field] ?? $values[$field]]);
                $groups[$key]['value'] = $values[$field];
                $groups[$key]['ids'][] = $row['id'];
                $budget->check('series', count($groups) + count($result));
            }

            foreach ($groups as $id => $group) {
                $result[] = [...$item, 'id' => Value::string($item['id']).':'.$id, 'label' => (string) Value::scalar($group['value'] ?? 'Missing'), 'itemIds' => $group['ids']];
            }

            $requirements = [];
            foreach (Value::list($chart['requirements']) as $input) {
                $requirement = Value::map($input);
                $target = Value::map($requirement['target']);
                if (($target['id'] ?? null) === $item['id']) {
                    foreach (array_keys($groups) as $id) {
                        $requirements[] = [...$requirement, 'target' => ['kind' => 'series', 'id' => Value::string($item['id']).':'.$id]];
                    }
                } else {
                    $requirements[] = $requirement;
                }
            }

            $chart['requirements'] = $requirements;
        }

        $budget->check('series', count($result));

        return $result;
    }
}
