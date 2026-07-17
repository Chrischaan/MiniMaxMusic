import base64
import logging

import httpx

from .config import MINIMAX_API_KEY, MINIMAX_BASE_URL

logger = logging.getLogger("minimax-music")

LYRICS_TIMEOUT = httpx.Timeout(60.0)
MUSIC_TIMEOUT = httpx.Timeout(180.0)

MUSIC_MODEL = "music-3.0"
COVER_MODEL = "music-cover"

AUDIO_SETTING = {
    "sample_rate": 44100,
    "bitrate": 256000,
    "format": "mp3",
}


def _headers() -> dict[str, str]:
    if not MINIMAX_API_KEY:
        raise RuntimeError(
            "MINIMAX_API_KEY is not set. Fill it in backend/.env and restart the server."
        )
    return {
        "Authorization": f"Bearer {MINIMAX_API_KEY}",
        "Content-Type": "application/json",
    }


def _check_base_resp(data: dict, context: str) -> None:
    base_resp = data.get("base_resp") or {}
    status_code = base_resp.get("status_code", 0)
    if status_code != 0:
        msg = base_resp.get("status_msg", "unknown error")
        raise RuntimeError(f"MiniMax {context} failed ({status_code}): {msg}")


async def generate_lyrics(prompt: str) -> dict:
    url = f"{MINIMAX_BASE_URL}/v1/lyrics_generation"
    payload = {"mode": "write_full_song", "prompt": prompt}

    async with httpx.AsyncClient(timeout=LYRICS_TIMEOUT) as client:
        resp = await client.post(url, headers=_headers(), json=payload)
        resp.raise_for_status()
        data = resp.json()

    _check_base_resp(data, "lyrics generation")
    return {
        "title": data.get("song_title", ""),
        "style_tags": data.get("style_tags", ""),
        "lyrics": data.get("lyrics", ""),
    }


def _extract_audio(data: dict, context: str) -> bytes:
    _check_base_resp(data, context)
    audio_hex = (data.get("data") or {}).get("audio")
    if not audio_hex:
        raise RuntimeError(f"MiniMax {context} response missing audio field: {data}")
    return bytes.fromhex(audio_hex)


async def generate_music(
    prompt: str,
    lyrics: str,
    *,
    is_instrumental: bool = False,
    lyrics_optimizer: bool = False,
) -> bytes:
    url = f"{MINIMAX_BASE_URL}/v1/music_generation"
    payload: dict = {
        "model": MUSIC_MODEL,
        "prompt": prompt,
        "audio_setting": AUDIO_SETTING,
    }
    if is_instrumental:
        payload["is_instrumental"] = True
    else:
        if lyrics.strip():
            payload["lyrics"] = lyrics
        if lyrics_optimizer:
            payload["lyrics_optimizer"] = True

    async with httpx.AsyncClient(timeout=MUSIC_TIMEOUT) as client:
        resp = await client.post(url, headers=_headers(), json=payload)
        resp.raise_for_status()
        data = resp.json()

    return _extract_audio(data, "music generation")


async def preprocess_cover(
    *,
    audio_bytes: bytes | None = None,
    audio_url: str | None = None,
) -> dict:
    """调用翻唱前处理接口，提取音频特征和结构化歌词（免费，feature id 有效期 24 小时）。"""
    if (audio_bytes is None) == (audio_url is None):
        raise ValueError("preprocess_cover requires exactly one of audio_bytes or audio_url")

    url = f"{MINIMAX_BASE_URL}/v1/music_cover_preprocess"
    payload: dict = {"model": COVER_MODEL}
    if audio_bytes is not None:
        payload["audio_base64"] = base64.b64encode(audio_bytes).decode("ascii")
    else:
        payload["audio_url"] = audio_url

    async with httpx.AsyncClient(timeout=MUSIC_TIMEOUT) as client:
        resp = await client.post(url, headers=_headers(), json=payload)
        resp.raise_for_status()
        data = resp.json()

    _check_base_resp(data, "cover preprocess")
    cover_feature_id = data.get("cover_feature_id", "")
    if not cover_feature_id:
        raise RuntimeError(f"MiniMax cover preprocess response missing cover_feature_id: {data}")

    return {
        "cover_feature_id": cover_feature_id,
        "formatted_lyrics": data.get("formatted_lyrics", ""),
        "audio_duration": data.get("audio_duration", 0),
    }


async def generate_cover(
    prompt: str,
    *,
    audio_bytes: bytes | None = None,
    audio_url: str | None = None,
    cover_feature_id: str | None = None,
    lyrics: str = "",
) -> bytes:
    sources = [audio_bytes, audio_url, cover_feature_id]
    if sum(s is not None for s in sources) != 1:
        raise ValueError(
            "generate_cover requires exactly one of audio_bytes, audio_url or cover_feature_id"
        )

    url = f"{MINIMAX_BASE_URL}/v1/music_generation"
    payload: dict = {
        "model": COVER_MODEL,
        "prompt": prompt,
        "audio_setting": AUDIO_SETTING,
    }
    if audio_bytes is not None:
        payload["audio_base64"] = base64.b64encode(audio_bytes).decode("ascii")
    elif audio_url is not None:
        payload["audio_url"] = audio_url
    else:
        payload["cover_feature_id"] = cover_feature_id
    if lyrics.strip():
        payload["lyrics"] = lyrics

    async with httpx.AsyncClient(timeout=MUSIC_TIMEOUT) as client:
        resp = await client.post(url, headers=_headers(), json=payload)
        resp.raise_for_status()
        data = resp.json()

    return _extract_audio(data, "cover generation")
