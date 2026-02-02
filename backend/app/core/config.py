import os
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    DATABASE_URL: str = "file:./dev.db"
    JWT_SECRET: str = "supersecretkey"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # Kali Linux SSH Configuration (only used when EXECUTION_MODE=ssh)
    KALI_HOST: str = "10.77.145.71"
    KALI_PORT: int = 22
    KALI_USER: str = "kali"
    KALI_PASSWORD: Optional[str] = "kali"
    KALI_KEY_PATH: Optional[str] = None

    # Execution Mode: "local" (container) or "ssh" (remote Kali)
    EXECUTION_MODE: str = "local"

    # Google Gemini API (Fallback)
    GEMINI_API_KEY: Optional[str] = "API_KEY"

    # Databricks API (Primary)
    DATABRICKS_API_KEY: Optional[str] = None
    DATABRICKS_API_BASE: Optional[str] = None
    DATABRICKS_MODEL: str = "databricks-gemini-3-pro"

    class Config:
        env_file = ".env"
        extra = "ignore" # Allow extra fields in .env

settings = Settings()
