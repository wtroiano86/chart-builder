#!/bin/sh
set -eu
package_root=$(pwd)
mkdir -p "$package_root/tmp"
consumer=$(mktemp -d "$package_root/tmp/laravel-install.XXXXXX")
trap 'rm -rf "$consumer"' EXIT HUP INT TERM
composer create-project laravel/laravel "$consumer" '^13.0' --prefer-dist --no-interaction
if [ "$#" -gt 0 ]; then
    mkdir "$consumer/package"
    php -r '
    $archive = new ZipArchive;
    if ($archive->open($argv[1]) !== true || ! $archive->extractTo($argv[2])) {
        throw new RuntimeException("Cannot extract candidate archive.");
    }
    $archive->close();
    ' "$1" "$consumer/package"
    composer config --working-dir="$consumer" repositories.chart-builder path "$consumer/package"
else
    composer config --working-dir="$consumer" repositories.chart-builder path "$package_root"
fi
composer require --working-dir="$consumer" 'wtroiano/chart-builder:@dev' 'inertiajs/inertia-laravel:^3' --no-interaction
php .github/scripts/test-install.php "$consumer"
if [ "$#" -gt 1 ]; then
    cp "$2" "$consumer/sdk.tgz"
    printf '[{"filename":"sdk.tgz"}]\n' > "$consumer/sdk-pack.json"
else
    npm run build:sdk
    npm pack --workspace=@wtroiano/chart-builder-sdk --pack-destination="$consumer" --json > "$consumer/sdk-pack.json"
fi
node scripts/prepare-consumer.mjs "$consumer"
npm install --prefix "$consumer" --no-audit --no-fund
npm exec --prefix "$consumer" -- tsc -p "$consumer/tsconfig.json"
npm run build --prefix "$consumer"
