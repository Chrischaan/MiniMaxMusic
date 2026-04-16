import logging
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

MINIMAX_API_KEY = os.getenv("MINIMAX_API_KEY", "").strip()
MINIMAX_BASE_URL = os.getenv("MINIMAX_BASE_URL", "https://api.minimaxi.com").strip()

logger = logging.getLogger("minimax-music")

if not MINIMAX_API_KEY:
    logger.warning(
        "MINIMAX_API_KEY is empty. Fill it in backend/.env before calling MiniMax APIs."
    )
