#!/bin/sh
set -e
cd "$(dirname "$0")"

PREVIEW=1 SCALE="${SCALE:-1}" WIDTH="${WIDTH:-480}" HUD="${HUD:-1}" ./build.sh
