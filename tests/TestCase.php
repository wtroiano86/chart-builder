<?php

declare(strict_types=1);

namespace Wtroiano\ChartBuilder\Tests;

use Illuminate\Auth\GenericUser;
use Illuminate\Contracts\Config\Repository;
use Orchestra\Testbench\TestCase as Orchestra;
use Wtroiano\ChartBuilder\Providers\ChartBuilderServiceProvider;

abstract class TestCase extends Orchestra
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->actingAs(new GenericUser(['id' => 1]));
        request()->setUserResolver(static fn () => auth()->user());
    }

    protected function getPackageProviders(mixed $app): array
    {
        return [ChartBuilderServiceProvider::class];
    }

    protected function defineEnvironment(mixed $app): void
    {
        $driver = env('CHART_TEST_DB_DRIVER', 'sqlite');
        $app->make(Repository::class)->set('app.key', 'base64:'.base64_encode(str_repeat('a', 32)));
        $app->make(Repository::class)->set('database.default', 'testing');
        $app->make(Repository::class)->set('database.connections.testing', [
            'driver' => $driver,
            'host' => env('CHART_TEST_DB_HOST', '127.0.0.1'),
            'port' => env('CHART_TEST_DB_PORT', $driver === 'pgsql' ? 5432 : 3306),
            'database' => env('CHART_TEST_DB_DATABASE', $driver === 'sqlite' ? ':memory:' : 'chart_builder_test'),
            'username' => env('CHART_TEST_DB_USERNAME', 'root'),
            'password' => env('CHART_TEST_DB_PASSWORD', ''),
            'charset' => $driver === 'mysql' || $driver === 'mariadb' ? 'utf8mb4' : 'utf8',
            'collation' => 'utf8mb4_unicode_ci',
        ]);
    }
}
