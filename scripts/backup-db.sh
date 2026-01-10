#!/bin/bash
# Database backup script for WLED Control Interface
# Add this to crontab for automated backups: 0 2 * * * /var/www/ledcontrol/scripts/backup-db.sh

set -e

BACKUP_DIR="/var/backups/wled-db"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Load database connection from .env file (if available)
if [ -f "/var/www/ledcontrol/backend/.env" ]; then
    source <(grep DATABASE_URL /var/www/ledcontrol/backend/.env | sed 's/^/export /' | sed 's/DATABASE_URL=/DATABASE_URL="/' | sed 's/$/"/')
fi

# Extract connection details from DATABASE_URL if set
if [ -z "$DATABASE_URL" ]; then
    # Default connection details
    DB_USER="wled_user"
    DB_NAME="wled_control"
    DB_HOST="localhost"
else
    # Parse DATABASE_URL: postgresql://user:pass@host:port/db
    DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
fi

BACKUP_FILE="$BACKUP_DIR/wled_control_$DATE.sql"

echo "🔄 Starting database backup..."
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"
echo "   Host: $DB_HOST"
echo "   Backup file: $BACKUP_FILE"

# Perform backup
if pg_dump -U "$DB_USER" -h "$DB_HOST" "$DB_NAME" > "$BACKUP_FILE"; then
    echo "✅ Backup completed successfully: $BACKUP_FILE"
    
    # Compress the backup
    if command -v gzip &> /dev/null; then
        gzip "$BACKUP_FILE"
        echo "✅ Backup compressed: ${BACKUP_FILE}.gz"
    fi
    
    # Remove old backups
    echo "🧹 Cleaning up backups older than $RETENTION_DAYS days..."
    find "$BACKUP_DIR" -name "wled_control_*.sql*" -type f -mtime +$RETENTION_DAYS -delete
    
    echo "✅ Backup process complete"
else
    echo "❌ Backup failed!"
    exit 1
fi
