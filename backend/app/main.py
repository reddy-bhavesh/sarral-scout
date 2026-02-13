from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from prisma import Prisma
from app.api import auth, scans, system
import logging
import sys

# Remove manual basicConfig to allow Uvicorn to handle logging
logger = logging.getLogger(__name__)

db = Prisma()


async def ensure_db_connected():
    """Ensure the database connection is alive, reconnect if needed."""
    try:
        if not db.is_connected():
            logger.warning("Database not connected. Reconnecting...")
            await db.connect()
            logger.info("Database reconnected successfully.")
        else:
            # Test the connection is actually alive (not just "thinks" it's connected)
            await db.execute_raw("SELECT 1")
    except Exception as e:
        logger.error(f"Database connection test failed: {e}. Attempting reconnect...")
        try:
            # Force disconnect the stale connection, then reconnect
            try:
                await db.disconnect()
            except Exception:
                pass  # Ignore disconnect errors on stale connection
            await db.connect()
            logger.info("Database reconnected successfully after failure.")
        except Exception as reconnect_error:
            logger.critical(f"Database reconnect failed: {reconnect_error}")
            raise


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.connect()
    logger.info("Database connected on startup.")
    
    # Cleanup zombie scans (scans stuck in "Running" state from previous session)
    try:
        zombie_scans = await db.scan.update_many(
            where={"status": "Running"},
            data={"status": "Failed"}
        )
        if zombie_scans > 0:
            logger.info(f"Startup Cleanup: Marked {zombie_scans} zombie scans as Failed.")
    except Exception as e:
        logger.error(f"Startup Cleanup Error: {e}")
        
    yield
    await db.disconnect()
    logger.info("Database disconnected on shutdown.")

app = FastAPI(title="Pentest Web App API", version="1.0.0", lifespan=lifespan)


@app.middleware("http")
async def db_reconnect_middleware(request: Request, call_next):
    """Middleware to ensure database connection is alive before processing requests."""
    # Skip reconnect check for static files and root endpoint
    if request.url.path.startswith("/reports") or request.url.path == "/":
        return await call_next(request)
    
    try:
        await ensure_db_connected()
    except Exception as e:
        logger.critical(f"Cannot establish database connection: {e}")
        return JSONResponse(
            status_code=503,
            content={"detail": "Database unavailable. Please try again shortly."}
        )
    
    return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allows requests from any origin (frontend)
    allow_credentials=True, # Allows cookies/auth headers
    allow_methods=["*"], # Allows all HTTP methods (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"], # Allows all headers
)

from fastapi.staticfiles import StaticFiles
import os

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(scans.router, prefix="/scans", tags=["scans"])
app.include_router(system.router, prefix="/system", tags=["system"])
from app.api import users, admin
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(admin.router, prefix="/admin", tags=["admin"])
from app.api import events
app.include_router(events.router, prefix="/events", tags=["events"])
from app.api import breaches
app.include_router(breaches.router, prefix="/breaches", tags=["breaches"])
from app.api import webintel
app.include_router(webintel.router, prefix="/api/webintel", tags=["webintel"])

# Ensure reports directory exists
os.makedirs("reports", exist_ok=True) # Ensures reports directory exists
app.mount("/reports", StaticFiles(directory="reports"), name="reports")

@app.get("/")
def read_root():
    return {"message": "Welcome to Pentest Web App API"}

@app.get("/health")
async def health_check():
    """Health check endpoint for Azure Container Apps probes.
    Returns HTTP 503 when unhealthy so Azure knows to restart the container."""
    try:
        await db.execute_raw("SELECT 1")
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "error": str(e)}
        )
