from contextlib import asynccontextmanager
from fastapi import FastAPI

from app.core.logging import setup_logging
from app.v1.router import router as v1_router

from app.services.notifications import start_scheduler, shutdown_scheduler

setup_logging()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    start_scheduler()
    yield
    # Shutdown
    shutdown_scheduler()

app = FastAPI(title="Fuchsia API", lifespan=lifespan)

app.include_router(v1_router, prefix="/api/v1")
