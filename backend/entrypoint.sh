#!/bin/bash
set -e

echo "=== Scout Backend Startup ==="

# Wait for database to be ready (if using MySQL or PostgreSQL)
if [[ "$DATABASE_URL" == mysql* ]] || [[ "$DATABASE_URL" == postgresql* ]]; then
  echo "Waiting for database to be ready..."
  
  # Extract host from DATABASE_URL
  DB_HOST=$(echo $DATABASE_URL | sed -E 's/.*@([^/:]+).*/\1/')
  
  # Determine port based on database type
  if [[ "$DATABASE_URL" == mysql* ]]; then
    DB_PORT=3306
  else
    DB_PORT=5432
  fi
  
  # Wait up to 60 seconds for database
  for i in {1..30}; do
    if nc -z "$DB_HOST" $DB_PORT 2>/dev/null; then
      echo "Database is ready!"
      sleep 2  # Give database a moment to fully initialize
      break
    fi
    echo "Waiting for database... ($i/30)"
    sleep 2
  done
fi

# Run database migrations (creates tables if they don't exist)
echo "Running Prisma migrations..."
prisma db push --skip-generate

echo "Database ready!"

# Start the FastAPI application
echo "Starting Scout API..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
