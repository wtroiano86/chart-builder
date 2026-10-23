<?php

declare(strict_types=1);

namespace Wtroiano\ChartBuilder\Payloads;

use Illuminate\Contracts\Support\Arrayable;
use JsonSerializable;

/** @implements Arrayable<string, mixed> */
final readonly class ChartPayload implements Arrayable, JsonSerializable
{
    /** @param array<string, mixed> $data */
    public function __construct(private array $data) {}

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return $this->data;
    }

    /** @return array<string, mixed> */
    public function jsonSerialize(): array
    {
        return $this->data;
    }
}
