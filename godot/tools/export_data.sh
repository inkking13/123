#!/usr/bin/env bash
# Regenerates godot/data/*.json from the Expo game's app/src/data.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
app="$here/../../app"
tmp="$(mktemp -d)"
(cd "$app" && npx tsc --ignoreConfig --outDir "$tmp" --module commonjs --target es2020 --jsx react --skipLibCheck \
  --esModuleInterop --resolveJsonModule --noEmitOnError false --rootDir src src/data/*.ts >/dev/null || true)
node "$here/export_data.cjs" "$tmp" "$here/../data"
rm -rf "$tmp"
