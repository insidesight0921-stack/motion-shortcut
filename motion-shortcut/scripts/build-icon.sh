#!/bin/sh
set -eu

mkdir -p build
sips -z 1024 1024 src/assets/hero.png --out build/icon.png >/dev/null
