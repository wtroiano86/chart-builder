<?php

declare(strict_types=1);

use Carbon\CarbonImmutable;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Orchestra\Testbench\Foundation\Application;
use Wtroiano\ChartBuilder\Providers\ChartBuilderServiceProvider;

require dirname(__DIR__).'/vendor/autoload.php';

$app = Application::create(options: ['load_environment_variables' => false]);
$app->register(ChartBuilderServiceProvider::class);
$app->make(Kernel::class)->bootstrap();
config([
    'app.key' => 'chart-builder-local-demo',
    'database.default' => 'chart_demo',
    'database.connections.chart_demo' => ['driver' => 'sqlite', 'database' => ':memory:'],
    'cache.default' => 'array',
]);

$request = Request::create('/demo'.($argv[1] ?? ''));
$request->headers->set('X-Chart-Request', $argv[2] ?? '');
$app->instance('request', $request);

// Every invocation gets an isolated, deterministic sample database.
Schema::create('demo_orders', function (Blueprint $table): void {
    $table->id();
    $table->dateTime('paid_at');
    $table->string('region');
    $table->string('product');
    $table->decimal('total', 12, 2);
});
$regions = ['North', 'South', 'East', 'West'];
$products = ['Starter', 'Team', 'Business', 'Enterprise'];
$orders = [];
for ($month = 1; $month <= 12; $month++) {
    for ($order = 0; $order < 32; $order++) {
        $product = ($order + $month) % 4;
        $orders[] = [
            'paid_at' => CarbonImmutable::create(2026, $month, 1, 12)->addDays($order % 28)->toDateTimeString(),
            'region' => $regions[($order * 3 + intdiv($order, 4)) % 4],
            'product' => $products[$product],
            'total' => round([89, 149, 249, 399][$product] * (1 + $order % 5) * (1 + $month / 20), 2),
        ];
    }
}
DB::table('demo_orders')->insert($orders);

$definitions = require __DIR__.'/charts.php';
$only = array_filter(explode(',', $argv[3] ?? ''));
$props = [];
foreach ($definitions as $prop => $builder) {
    if ($only === [] || in_array($prop, $only, true)) {
        $props[$prop] = $builder->public()->theme('light')->renderingMode('svg')->height(320)->animation(false)->build()->result($request);
    }
}
if ($only === []) {
    $props['summary'] = ['orders' => count($orders), 'revenue' => (float) DB::table('demo_orders')->sum('total'), 'charts' => count($definitions)];
    $props['phpSource'] = file_get_contents(__DIR__.'/charts.php');
}
echo json_encode($props, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
