#!/bin/bash
# Backup script for PostgreSQL

BACKUP_DIR="/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/ride_db_$TIMESTAMP.sql"

echo "Starting database backup at $TIMESTAMP"

# Create backup
PGPASSWORD=$POSTGRES_PASSWORD pg_dump -h postgres -U postgres ride_db > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Keep only last 7 days of backups
find $BACKUP_DIR -name "ride_db_*.sql.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE.gz"