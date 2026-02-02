#!/bin/bash
set -e

echo "=== Scout Backend Startup ==="

# Run database migrations (creates tables if they don't exist)
echo "Running Prisma migrations..."
prisma db push --skip-generate

echo "Database ready!"

# Start the FastAPI application
echo "Starting Scout API..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
