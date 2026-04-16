import base64
import logging

import httpx

from .config import MINIMAX_API_KEY, MINIMAX_BASE_URL

logger = logging.getLogger("minimax-music")

LYRICS_TIMEOUT = httpx.Timeout(60.0)
MUSIC_TIMEOUT = httpx.Timeout(180.0)


def _headers() -> dict[str, str]:
    if not MINIMAX_API_KEY:
        raise RuntimeError(
            "MINIMAX_API_KEY is not set. Fill it in backend/.env and restart the server."
        )
    return {
        "Authorization": f"Bearer {MINIMAX_API_KEY}",
        "Content-Type": "application/json",
    }


async def generate_lyrics(prompt: str) -> dict:
    url = f"{MINIMAX_BASE_URL}/v1/lyrics_generation"
    payload = {"mode": "write_full_song", "prompt": prompt}

    async with httpx.AsyncClient(timeout=LYRICS_TIMEOUT) as client:
        resp = await client.post(url, headers=_headers(), json=payload)
        resp.raise_for_status()
        data = resp.json()

    return {
        "title": data.get("song_title", ""),
        "style_tags": data.get("style_tags", ""),
        "lyrics": data.get("lyrics", ""),
    }


async def generate_music(prompt: str, lyrics: str) -> bytes:
    url = f"{MINIMAX_BASE_URL}/v1/music_generation"
    payload = {
        "model": "music-2.6",
        "prompt": prompt,
        "lyrics": lyrics,
        "audio_setting": {
            "sample_rate": 44100,
            "bitrate": 256000,
            "format": "mp3",
        },
    }

    async with httpx.AsyncClient(timeout=MUSIC_TIMEOUT) as client:
        resp = await client.post(url, headers=_headers(), json=payload)
        resp.raise_for_status()
        data = resp.json()

    audio_hex = (data.get("data") or {}).get("audio")
    if not audio_hex:
        raise RuntimeError(f"MiniMax music response missing audio field: {data}")

    return bytes.fromhex(audio_hex)


async def generate_cover(
    prompt: str,
    *,
    audio_bytes: bytes | None = None,
    audio_url: str | None = None,
    lyrics: str = "",
) -> bytes:
    if (audio_bytes is None) == (audio_url is None):
        raise ValueError("generate_cover requires exactly one of audio_bytes or audio_url")

    url = f"{MINIMAX_BASE_URL}/v1/music_generation"
    payload: dict = {
        "model": "music-cover",
        "prompt": prompt,
        "audio_setting": {
            "sample_rate": 44100,
            "bitrate": 256000,
            "format": "mp3",
        },
    }
    if audio_bytes is not None:
        payload["audio_base64"] = base64.b64encode(audio_bytes).decode("ascii")
    else:
        payload["audio_url"] = audio_url
    if lyrics.strip():
        payload["lyrics"] = lyrics

    async with httpx.AsyncClient(timeout=MUSIC_TIMEOUT) as client:
        resp = await client.post(url, headers=_headers(), json=payload)
        resp.raise_for_status()
        data = resp.json()

    audio_hex = (data.get("data") or {}).get("audio")
    if not audio_hex:
        raise RuntimeError(f"MiniMax cover response missing audio field: {data}")

    return bytes.fromhex(audio_hex)
