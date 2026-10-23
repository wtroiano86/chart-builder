<?php

declare(strict_types=1);

namespace Wtroiano\ChartBuilder\Commands;

use Illuminate\Console\Attributes\Description;
use Illuminate\Console\GeneratorCommand;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Input\InputOption;

#[AsCommand(name: 'make:chart')]
#[Description('Create a reusable Chart Builder definition')]
final class MakeChartCommand extends GeneratorCommand
{
    protected $name = 'make:chart';

    protected $type = 'Chart';

    protected function getStub(): string
    {
        return dirname(__DIR__, 2).'/resources/stubs/chart.stub';
    }

    protected function getDefaultNamespace($rootNamespace): string
    {
        return $rootNamespace.'\\Charts';
    }

    protected function getOptions(): array
    {
        return [['force', 'f', InputOption::VALUE_NONE, 'Overwrite an existing chart definition']];
    }
}
