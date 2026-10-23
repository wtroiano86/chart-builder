#!/bin/sh
set -eu
package_root=$(pwd)
mkdir -p "$package_root/tmp"
consumer=$(mktemp -d "$package_root/tmp/laravel-install.XXXXXX")
trap 'rm -rf "$consumer"' EXIT HUP INT TERM
composer create-project laravel/laravel "$consumer" '^13.0' --prefer-dist --no-interaction
composer config --working-dir="$consumer" repositories.chart-builder path "$package_root"
composer require --working-dir="$consumer" 'wtroiano/chart-builder:@dev' 'inertiajs/inertia-laravel:^3' --no-interaction
php .github/scripts/test-install.php "$consumer"
npm run build:sdk
npm pack --workspace=@wtroiano/chart-builder-sdk --pack-destination="$consumer" --json > "$consumer/sdk-pack.json"
node scripts/prepare-consumer.mjs "$consumer"
npm install --prefix "$consumer" --no-audit --no-fund
npm exec --prefix "$consumer" -- tsc -p "$consumer/tsconfig.json"
npm run build --prefix "$consumer"
