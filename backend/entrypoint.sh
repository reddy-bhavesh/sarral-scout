#!/bin/bash
set -e

echo "=== Scout Backend Startup ==="

# Wait for PostgreSQL to be ready (if using PostgreSQL)
if [[ "$DATABASE_URL" == postgresql* ]]; then
  echo "Waiting for PostgreSQL to be ready..."
  
  # Extract host from DATABASE_URL (format: postgresql://user:pass@host/db)
  DB_HOST=$(echo $DATABASE_URL | sed -E 's/.*@([^/:]+).*/\1/')
  
  # Wait up to 60 seconds for postgres
  for i in {1..30}; do
    if nc -z "$DB_HOST" 5432 2>/dev/null; then
      echo "PostgreSQL is ready!"
      sleep 2  # Give postgres a moment to fully initialize
      break
    fi
    echo "Waiting for PostgreSQL... ($i/30)"
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
