from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "ER-MusicTagManager"
    APP_ENV: str = "development"
    LOG_LEVEL: str = "INFO"
    
    # Paths
    INPUT_DIR: Path = Path("/data/input")
    OUTPUT_DIR: Path = Path("/data/output")
    
    # MusicBrainz
    MUSICBRAINZ_USER_AGENT: str = "ER-MusicTagManager/0.1.0 ( contact@example.com )"
    
    # Cors
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()
