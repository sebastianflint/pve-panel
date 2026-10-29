#!/usr/bin/env bash
# Backup database SQLite (konsisten, online) dan folder uploads. Contoh cron: 15 2 * * * /opt/dic.id/deploy/backup.sh
# Variabel: APP_DIR (default /opt/dic.id), BACKUP_DIR (default /var/backups/dic), KEEP_DAYS (default 14)
# Untuk Docker: jalankan dengan MODE=docker CONTAINER=<nama container>
set -euo pipefail
APP_DIR="${APP_DIR:-/opt/dic.id}"; BACKUP_DIR="${BACKUP_DIR:-/var/backups/dic}"; KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"; DEST="$BACKUP_DIR/$STAMP"; mkdir -p "$DEST"
if [ "${MODE:-native}" = "docker" ]; then
  C="${CONTAINER:?isi CONTAINER}"
  docker exec "$C" node -e "const D=require('better-sqlite3');new D(process.env.DB_PATH).backup('/data/backup.db').then(()=>process.exit(0))"
  docker cp "$C:/data/backup.db" "$DEST/dic.db"; docker exec "$C" rm -f /data/backup.db
  docker cp "$C:/data/uploads" "$DEST/uploads"
else
  cd "$APP_DIR"
  node -e "const D=require('better-sqlite3');new D(process.env.DB_PATH||'./data/dic.db').backup('$DEST/dic.db').then(()=>process.exit(0))"
  cp -a "${UPLOAD_DIR:-$APP_DIR/uploads}" "$DEST/uploads"
fi
tar -C "$BACKUP_DIR" -czf "$BACKUP_DIR/dic-$STAMP.tar.gz" "$STAMP" && rm -rf "$DEST"
sha256sum "$BACKUP_DIR/dic-$STAMP.tar.gz" > "$BACKUP_DIR/dic-$STAMP.tar.gz.sha256"
find "$BACKUP_DIR" -name 'dic-*.tar.gz*' -mtime +"$KEEP_DAYS" -delete
echo "Backup selesai: $BACKUP_DIR/dic-$STAMP.tar.gz"
