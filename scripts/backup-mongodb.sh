#!/usr/bin/env sh
set -eu
backup_dir="${BACKUP_DIR:-./backups}"
timestamp="\$(date +%Y%m%d-%H%M%S)"
mkdir -p "\$backup_dir"
docker compose exec -T mongo mongodump --db "${MONGO_DB_NAME:-sujala_water_solutions}" --archive --gzip > "\$backup_dir/sws-mongodb-\$timestamp.archive.gz"
find "\$backup_dir" -name 'sws-mongodb-*.archive.gz' -mtime +"${BACKUP_RETENTION_DAYS:-14}" -delete
echo "Backup written to \$backup_dir/sws-mongodb-\$timestamp.archive.gz"
