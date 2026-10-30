#!/usr/bin/env bash
# Packs only the files the extension needs into dist/ARS-Download-Manager-v.<version>.zip.
# Files sit at the zip root, so unzipping gives one folder with manifest.json
# directly inside (ready for "Load unpacked" and for the Chrome Web Store).
set -euo pipefail
cd "$(dirname "$0")/.."

version=$(node -p "require('./manifest.json').version")
name="ARS-Download-Manager-v.${version}.zip"

mkdir -p dist
rm -f "dist/${name}"
zip -q -r -X "dist/${name}" \
  manifest.json background.js popup.html popup.css popup.js \
  lib _locales icons/icon16.png icons/icon32.png icons/icon48.png icons/icon128.png

echo "dist/${name}"
