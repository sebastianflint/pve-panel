#!/usr/bin/env bash
# Restore dari arsip backup. HENTIKAN aplikasi terlebih dulu. Pemakaian: restore.sh /var/backups/dic/dic-YYYYMMDD-HHMMSS.tar.gz
# Skrip membuat salinan pengaman data saat ini sebelum menimpa (rollback dari restore).
set -euo pipefail
ARCHIVE="${1:?pakai: restore.sh <arsip.tar.gz>}"; APP_DIR="${APP_DIR:-/opt/dic.id}"
sha256sum -c "$ARCHIVE.sha256"
TMP="$(mktemp -d)"; tar -C "$TMP" -xzf "$ARCHIVE"; SRC="$(find "$TMP" -mindepth 1 -maxdepth 1 -type d | head -1)"
SAFE="$APP_DIR/data/pre-restore-$(date +%Y%m%d-%H%M%S)"; mkdir -p "$SAFE"
cp -a "$APP_DIR/data/dic.db"* "$SAFE/" 2>/dev/null || true; cp -a "$APP_DIR/uploads" "$SAFE/uploads" 2>/dev/null || true
rm -f "$APP_DIR/data/dic.db-wal" "$APP_DIR/data/dic.db-shm"
cp -a "$SRC/dic.db" "$APP_DIR/data/dic.db"; rm -rf "$APP_DIR/uploads" && cp -a "$SRC/uploads" "$APP_DIR/uploads"
rm -rf "$TMP"; echo "Restore selesai. Salinan pengaman: $SAFE. Start aplikasi lalu verifikasi."
