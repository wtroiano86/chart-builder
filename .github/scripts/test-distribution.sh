#!/bin/sh
set -eu

directory=$(mktemp -d)
trap 'rm -rf "$directory"' EXIT HUP INT TERM
composer archive --format=zip --dir="$directory" --file=package --no-interaction
php -r '
$archive = new ZipArchive;
if ($archive->open($argv[1]) !== true) {
    fwrite(STDERR, "Unable to open distribution archive.\n");
    exit(1);
}
for ($index = 0; $index < $archive->numFiles; $index++) {
    echo $archive->getNameIndex($index), "\n";
}
$archive->close();
' "$directory/package.zip" > "$directory/files"
for required in composer.json LICENSE src/Chart.php src/ChartBuilder.php src/ChartRegistry.php src/Charts/ChartResolver.php src/Providers/ChartBuilderServiceProvider.php config/chart-builder.php resources/stubs/chart.stub resources/stubs/chart-builder-page.tsx.stub resources/react/index.ts resources/react/core/index.ts resources/react/core/Chart.tsx resources/react/core/ChartCanvas.tsx resources/react/core/chart.css resources/react/adapters/echarts/index.ts resources/react/adapters/echarts/rendering.tsx resources/manifests/echarts.json resources/react/adapters/shadcn/index.ts resources/react/adapters/shadcn/types.ts resources/react/adapters/shadcn/model.ts resources/react/adapters/shadcn/rendering.tsx resources/react/adapters/shadcn/export.ts resources/react/adapters/shadcn/shadcn.css resources/react/adapters/shadcn/manifest.json resources/manifests/shadcn.json resources/schemas/chart-result.v1.json; do
    if ! grep -Fxq "$required" "$directory/files"; then
        echo "Missing distribution file: $required" >&2
        exit 1
    fi
done
for required in README.md CHANGELOG.md docs/images/charts-light.png docs/images/charts-dark.png docs/images/revenue-filters.png docs/images/treemap.png CONTRIBUTING.md llms.txt docs/specification.md docs/README.md docs/architecture.md docs/boost.md docs/consumers/getting-started.md docs/consumers/charts.md docs/consumers/data.md docs/consumers/aggregation.md docs/consumers/react.md docs/consumers/state.md docs/consumers/adapters.md docs/consumers/shadcn.md docs/consumers/exports.md docs/consumers/security.md docs/consumers/troubleshooting.md docs/development/contributing.md docs/development/testing.md docs/development/releasing.md docs/development/agent-workflow.md resources/boost/guidelines/core.blade.php resources/boost/skills/chart-builder-development/SKILL.md resources/boost/skills/chart-builder-react/SKILL.md resources/boost/skills/chart-builder-adapters/SKILL.md resources/boost/skills/chart-builder-adapters/references/lifecycle.md; do
    if ! grep -Fxq "$required" "$directory/files"; then
        echo "Missing distribution documentation: $required" >&2
        exit 1
    fi
done
if grep -Eq '(^|/)(\._[^/]*|\.DS_Store)$|^(vendor/|node_modules/|packages/|scripts/|examples/|tests/|\.github/|\.idea/|\.ijfw/|ijfw/|\.planning/|tmp/|temp/|\.phpstan/|\.phpunit.cache/|AGENTS\.md$|DESIGN\.md$|composer\.lock$|composer\.local\.(json|lock)$|package(-lock)?\.json$|tsconfig\.json$|vitest\.config\.ts$|vite\.preview\.config\.ts$|playwright\.config\.ts$|playwright-report/|test-results/)' "$directory/files"; then
    echo 'Development files leaked into the distribution.' >&2
    exit 1
fi
echo 'Distribution contains runtime, documentation and Boost resources and excludes development files.'
