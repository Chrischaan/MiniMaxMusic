import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .. import minimax_client

logger = logging.getLogger("minimax-music")

router = APIRouter(prefix="/api", tags=["lyrics"])


class LyricsRequest(BaseModel):
    prompt: str


class LyricsResponse(BaseModel):
    title: str
    style_tags: str
    lyrics: str


@router.post("/lyrics", response_model=LyricsResponse)
async def post_lyrics(req: LyricsRequest) -> LyricsResponse:
    if not req.prompt.strip():
        raise HTTPException(status_code=400, detail="prompt cannot be empty")

    try:
        result = await minimax_client.generate_lyrics(req.prompt)
    except Exception as exc:
        logger.exception("lyrics generation failed")
        raise HTTPException(status_code=502, detail=f"lyrics generation failed: {exc}")

    return LyricsResponse(**result)
