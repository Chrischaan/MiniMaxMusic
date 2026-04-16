import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .routes import lyrics, music

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s - %(message)s",
)

logger = logging.getLogger("minimax-music")

app = FastAPI(title="MiniMax Music Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(lyrics.router)
app.include_router(music.router)


@app.get("/health")
async def health() -> dict:
    return {"ok": True}


STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
if STATIC_DIR.is_dir():
    logger.info("Serving frontend static files from %s", STATIC_DIR)
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
else:
    logger.info("No static directory at %s — API-only mode", STATIC_DIR)
