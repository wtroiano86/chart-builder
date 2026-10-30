<?php

declare(strict_types=1);

// Only use a disposable Laravel app. This helper publishes and generates application files.
$root = isset($argv[1]) ? realpath($argv[1]) : false;
if ($root === false || $root === dirname(__DIR__, 2) || ! is_file($root.'/bootstrap/app.php')) {
    throw new RuntimeException('Pass a disposable Laravel application directory.');
}
require $root.'/vendor/autoload.php';
$app = require $root.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();
foreach (['chart-builder-config', 'chart-builder-react', 'chart-builder-react-page'] as $tag) {
    if ($kernel->call('vendor:publish', ['--tag' => $tag, '--force' => true]) !== 0) {
        throw new RuntimeException('Publishing failed: '.$tag);
    }
}
if (is_dir($root.'/resources/js/vendor/chart-builder/adapters/shadcn')) {
    throw new RuntimeException('Default publishing unexpectedly included shadcn.');
}
if ($kernel->call('vendor:publish', ['--tag' => 'chart-builder-shadcn', '--force' => true]) !== 0) {
    throw new RuntimeException('Publishing shadcn failed.');
}
if ($kernel->call('make:chart', ['name' => 'SmokeRevenueChart', '--force' => true]) !== 0) {
    throw new RuntimeException('Chart generation failed.');
}
Illuminate\Support\Facades\Route::get('/chart-builder-install-smoke', function (Illuminate\Http\Request $request): Inertia\Response {
    $chart = new App\Charts\SmokeRevenueChart;
    return Inertia\Inertia::render('Smoke', [
        'chart' => $chart->definition()->public()->build()->result($request),
        'shadcnChart' => $chart->definition()->adapter('shadcn')->public()->build()->result($request),
    ]);
});
$request = Illuminate\Http\Request::create('/chart-builder-install-smoke', server: ['HTTP_X_INERTIA' => 'true', 'HTTP_ACCEPT' => 'text/html, application/xhtml+xml']);
$http = $app->make(Illuminate\Contracts\Http\Kernel::class);
$response = $http->handle($request);
$page = json_decode($response->getContent(), true, flags: JSON_THROW_ON_ERROR);
if ($response->getStatusCode() !== 200 || ($page['props']['chart']['status'] ?? null) !== 'ready' || ($page['props']['shadcnChart']['status'] ?? null) !== 'ready') {
    throw new RuntimeException('Fresh Laravel/Inertia response failed: '.$response->getContent());
}
file_put_contents($root.'/resources/js/chart-result.json', json_encode($page['props']['chart'], JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR));
file_put_contents($root.'/resources/js/shadcn-result.json', json_encode($page['props']['shadcnChart'], JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR));
$http->terminate($request, $response);
echo "Fresh Laravel provider discovery, publishing, generation and Inertia HTTP result passed.\n";
