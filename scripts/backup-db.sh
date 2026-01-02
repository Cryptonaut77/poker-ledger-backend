#!/bin/bash
# Database backup script
# Creates a timestamped backup of the SQLite database

BACKUP_DIR="/home/user/workspace/backend/prisma/backups"
DB_FILE="/home/user/workspace/backend/prisma/dev.db"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/dev_backup_$TIMESTAMP.db"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Check if database exists
if [ -f "$DB_FILE" ]; then
    # Force WAL checkpoint before backup to ensure all data is in main db file
    cd /home/user/workspace/backend
    bunx prisma db execute --schema=prisma/schema.prisma --stdin <<< "PRAGMA wal_checkpoint(TRUNCATE);" 2>/dev/null || true

    # Copy database file
    cp "$DB_FILE" "$BACKUP_FILE"

    # Keep only last 10 backups
    ls -t "$BACKUP_DIR"/dev_backup_*.db 2>/dev/null | tail -n +11 | xargs -r rm

    echo "Backup created: $BACKUP_FILE"
else
    echo "Database file not found: $DB_FILE"
    exit 1
fi
