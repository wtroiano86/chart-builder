<?php

declare(strict_types=1);

// Run against a disposable Composer app, never against a working application.
$fixture = isset($argv[1]) ? realpath($argv[1]) : false;
$packageRoot = dirname(__DIR__, 2);
if ($fixture === false || $fixture === $packageRoot || ! is_file($fixture.'/vendor/autoload.php')) {
    fwrite(STDERR, "Usage: php .github/scripts/test-boost.php /path/to/disposable-boost-app\n");
    exit(1);
}
chdir($fixture);
require $fixture.'/vendor/autoload.php';

try {
    foreach (['bootstrap/cache', 'storage/framework/views', 'storage/framework/cache', 'storage/framework/sessions', 'storage/logs'] as $directory) {
        if (! is_dir($fixture.'/'.$directory)) {
            mkdir($fixture.'/'.$directory, 0755, true);
        }
    }

    $app = Illuminate\Foundation\Application::configure(basePath: $fixture)
        ->withProviders([Laravel\Boost\BoostServiceProvider::class])
        ->create();
    $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
    config(['cache.default' => 'array', 'view.compiled' => $fixture.'/storage/framework/views']);

    $package = 'wtroiano/chart-builder';
    $project = $app->make(Laravel\Roster\ProjectManager::class);
    $project->fresh();
    $discovered = Laravel\Boost\Install\ThirdPartyPackage::discover($project)->get($package);
    if ($discovered === null || ! $discovered->hasGuidelines || ! $discovered->hasSkills) {
        throw new RuntimeException('Boost did not discover package guidelines and skills from the direct dependency.');
    }
    $configuration = new Laravel\Boost\Install\GuidelineConfig;
    $configuration->aiGuidelines = [$package];
    $configuration->hasSkills = true;
    $guidelines = $app->make(Laravel\Boost\Install\GuidelineComposer::class)
        ->config($configuration)->guidelines()->filter(fn (array $value, string $key): bool => str_starts_with($key, $package.'/'));
    if ($guidelines->count() !== 1 || mb_trim($guidelines->first()['content']) === '') {
        throw new RuntimeException('Expected one nonempty rendered package guideline.');
    }
    if (! $app->make(Laravel\Boost\Support\RenderFailures::class)->isEmpty()) {
        throw new RuntimeException('Boost reported guideline rendering failures.');
    }
    $skills = $app->make(Laravel\Boost\Install\SkillComposer::class)->config($configuration)
        ->skills()->filter(fn (Laravel\Boost\Install\Skill $skill): bool => $skill->package === $package);
    $names = $skills->pluck('name')->sort()->values()->all();
    $expected = ['chart-builder-adapters', 'chart-builder-development', 'chart-builder-react'];
    if ($names !== $expected) {
        throw new RuntimeException('Unexpected package skills: '.json_encode($names));
    }
    $agent = new class implements Laravel\Boost\Contracts\SupportsSkills
    {
        public function skillsPath(): string
        {
            return '.test-agent/skills';
        }
    };
    $writer = new Laravel\Boost\Install\SkillWriter($agent);
    foreach ($skills as $skill) {
        if ($skill->description === '' || $writer->write($skill) === Laravel\Boost\Install\SkillWriter::FAILED) {
            throw new RuntimeException('Skill parsing/copying failed: '.$skill->name);
        }
        if (! is_file($fixture.'/.test-agent/skills/'.$skill->name.'/SKILL.md')) {
            throw new RuntimeException('Missing installed skill: '.$skill->name);
        }
    }
    $reference = $fixture.'/.test-agent/skills/chart-builder-adapters/references/lifecycle.md';
    if (! is_file($reference) || mb_trim(file_get_contents($reference)) === '') {
        throw new RuntimeException('Nested skill reference was not copied.');
    }
    echo json_encode([
        'boost' => Composer\InstalledVersions::getPrettyVersion('laravel/boost'),
        'package' => $package,
        'guidelines' => $guidelines->keys()->all(),
        'skills' => $names,
        'reference_copied' => true,
        'destination' => $fixture.'/.test-agent/skills',
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)."\n";
} catch (Throwable $exception) {
    fwrite(STDERR, $exception->getMessage()."\n");
    exit(1);
}
