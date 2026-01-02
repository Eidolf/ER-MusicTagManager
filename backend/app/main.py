import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.endpoints import router as api_router
from app.core.logging import configure_logging
from app.core.settings import settings


@asynccontextmanager
async def lifespan(_app: FastAPI):
    configure_logging()
    yield

app = FastAPI(
    title=settings.APP_NAME,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")



# Static Files Mounting (For Portable/Production without Nginx)
# Check if 'static' folder exists (where we will put the React build)
# OR if we are running in a PyInstaller bundle (sys._MEIPASS)
if getattr(sys, 'frozen', False):
    # PyInstaller creates a temp folder and stores path in _MEIPASS
    base_dir = Path(sys._MEIPASS)
    static_dir = base_dir / "static"
else:
    static_dir = Path("static")
    if not static_dir.exists():
        # Fallback to local frontend/dist if we are developing differently or building
        static_dir = Path("../frontend/dist")

if static_dir.exists() and static_dir.is_dir():
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

