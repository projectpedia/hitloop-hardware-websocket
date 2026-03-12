#!/usr/bin/env bash
# Build GroupLoop firmware and publish binaries to the client-hub static site.
# Usage: ./build-firmware.sh [seeed|devkit|all]  (default: all)

set -euo pipefail

FIRMWARE_DIR="$(cd "$(dirname "$0")/grouploop-firmware/ble-scanner" && pwd)"
OUTPUT_DIR="$(cd "$(dirname "$0")/client-hub/app/static/firmware" && pwd 2>/dev/null || { mkdir -p "$(dirname "$0")/client-hub/app/static/firmware" && cd "$(dirname "$0")/client-hub/app/static/firmware" && pwd; })"
TARGET="${1:-all}"

ENV_SEEED="seeed_xiao_esp32c3"
ENV_DEVKIT="esp32-c3-devkitm-1"

echo "==> Firmware source: $FIRMWARE_DIR"
echo "==> Output dir:      $OUTPUT_DIR"

mkdir -p "$OUTPUT_DIR"

build_env() {
    local env="$1"
    local label="$2"
    echo ""
    echo "--- Building: $env ---"
    (cd "$FIRMWARE_DIR" && pio run -e "$env")
    local src="$FIRMWARE_DIR/.pio/build/$env/firmware.bin"
    local dst="$OUTPUT_DIR/${label}.bin"
    cp "$src" "$dst"
    echo "    Copied: $dst"
}

case "$TARGET" in
    seeed)  build_env "$ENV_SEEED"  "firmware-seeed" ;;
    devkit) build_env "$ENV_DEVKIT" "firmware-devkit" ;;
    all)
        build_env "$ENV_SEEED"  "firmware-seeed"
        build_env "$ENV_DEVKIT" "firmware-devkit"
        ;;
    *)
        echo "Usage: $0 [seeed|devkit|all]"
        exit 1
        ;;
esac

# Write manifest.json
VERSION="$(cd "$FIRMWARE_DIR" && git describe --tags --always --dirty 2>/dev/null || echo "unknown")"
BUILD_DATE="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

cat > "$OUTPUT_DIR/manifest.json" <<EOF
{
  "version": "$VERSION",
  "build_date": "$BUILD_DATE",
  "boards": {
    "seeed_xiao_esp32c3": "firmware/firmware-seeed.bin",
    "esp32-c3-devkitm-1": "firmware/firmware-devkit.bin"
  }
}
EOF

echo ""
echo "==> manifest.json written:"
cat "$OUTPUT_DIR/manifest.json"
echo ""
echo "==> Done. Publish client-hub/app/static/firmware/ to deploy."
