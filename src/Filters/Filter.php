<?php

declare(strict_types=1);

namespace Wtroiano\ChartBuilder\Filters;

use Carbon\CarbonImmutable;
use Carbon\Exceptions\InvalidFormatException;
use Illuminate\Validation\ValidationException;
use Wtroiano\ChartBuilder\Support\Json;

final class Filter
{
    private mixed $default = null;

    private bool $clearable = false;

    /** @param list<array{value: string, label: string}> $options */
    private function __construct(
        private readonly string $kind,
        private readonly string $key,
        private readonly string $label,
        private readonly array $options = [],
        private readonly string $fromKey = 'from',
        private readonly string $untilKey = 'until',
    ) {
        Json::identifier($key);
        Json::identifier($fromKey);
        Json::identifier($untilKey);
    }

    public static function dateRange(string $key = 'period', string $label = 'Period', string $fromKey = 'from', string $untilKey = 'until'): self
    {
        return new self('date-range', $key, $label, fromKey: $fromKey, untilKey: $untilKey);
    }

    /** @param array<string, string> $options */
    public static function select(string $key, array $options, ?string $label = null, bool $multiple = false): self
    {
        $items = [];
        foreach ($options as $value => $text) {
            $items[] = ['value' => (string) $value, 'label' => $text];
        }

        return new self($multiple ? 'multiselect' : 'select', $key, $label ?? $key, $items);
    }

    /** @param list<string> $intervals */
    public static function interval(array $intervals = ['day', 'week', 'month', 'quarter', 'year']): self
    {
        return new self('interval', 'interval', 'Interval', array_map(static fn (string $value): array => ['value' => $value, 'label' => ucfirst($value)], $intervals));
    }

    public function default(mixed $value): self
    {
        $this->default = $value;

        return $this;
    }

    public function clearable(bool $enabled = true): self
    {
        $this->clearable = $enabled;

        return $this;
    }

    /** @return list<string> */
    public function keys(): array
    {
        return $this->kind === 'date-range' ? [$this->fromKey, $this->untilKey] : [$this->key];
    }

    /** @return array<string, mixed> */
    public function definition(): array
    {
        $base = ['kind' => $this->kind, 'key' => $this->key, 'label' => $this->label, 'clearable' => $this->clearable];

        return $this->kind === 'date-range' ? [...$base, 'fromKey' => $this->fromKey, 'untilKey' => $this->untilKey] : [...$base, 'options' => $this->options];
    }

    /** @param array<string, mixed> $input
     * @return array<string, mixed>
     */
    public function resolve(array $input, string $timezone): array
    {
        if ($this->kind === 'date-range') {
            $defaults = is_array($this->default) ? $this->default : [];
            $from = array_key_exists($this->fromKey, $input) ? $input[$this->fromKey] : ($defaults['from'] ?? null);
            $until = array_key_exists($this->untilKey, $input) ? $input[$this->untilKey] : ($defaults['until'] ?? null);
            if (($from === '' || $from === null) && ($until === '' || $until === null) && $this->clearable) {
                return [$this->fromKey => null, $this->untilKey => null];
            }

            $start = $this->instant($from, $timezone, $this->fromKey, false);
            $end = $this->instant($until, $timezone, $this->untilKey, true);
            if ($start >= $end) {
                throw ValidationException::withMessages([$this->untilKey => 'The end must follow the start.']);
            }

            return [$this->fromKey => $start->toISOString(), $this->untilKey => $end->toISOString()];
        }

        $value = array_key_exists($this->key, $input) ? $input[$this->key] : $this->default;
        if ((in_array($value, ['', null, []], true)) && $this->clearable) {
            return [$this->key => $this->kind === 'multiselect' ? [] : null];
        }

        $values = $this->kind === 'multiselect' && is_array($value) ? $value : [$value];
        $allowed = array_column($this->options, 'value');
        foreach ($values as $item) {
            if (! is_string($item) || ! in_array($item, $allowed, true)) {
                throw ValidationException::withMessages([$this->key => 'Select an allowed value.']);
            }
        }

        return [$this->key => $this->kind === 'multiselect' ? array_values(array_unique($values)) : $value];
    }

    private function instant(mixed $value, string $timezone, string $field, bool $end): CarbonImmutable
    {
        if (! is_string($value) || ! preg_match('/^\\d{4}-\\d{2}-\\d{2}(?:T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?Z)?$/D', $value)) {
            throw ValidationException::withMessages([$field => 'Enter a valid date or UTC instant.']);
        }

        try {
            $date = CarbonImmutable::parse($value, $timezone);
            if ($date->format('Y-m-d') !== mb_substr($value, 0, 10)) {
                throw ValidationException::withMessages([$field => 'Enter a valid calendar date.']);
            }
        } catch (InvalidFormatException) {
            throw ValidationException::withMessages([$field => 'Enter a valid date.']);
        }

        return ($end && mb_strlen($value) === 10 ? $date->addDay() : $date)->utc();
    }
}
