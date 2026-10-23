<?php

declare(strict_types=1);

namespace Wtroiano\ChartBuilder\Exceptions;

use RuntimeException;

final class ChartException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly string $errorCode = 'configuration',
        public readonly bool $retryable = false,
    ) {
        parent::__construct($message);
    }
}
