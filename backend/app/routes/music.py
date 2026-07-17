import io
import logging
from urllib.parse import quote

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, Request, Response, UploadFile
from mutagen.id3 import APIC, ID3, ID3NoHeaderError, TIT2, USLT
from mutagen.mp3 import MP3
from pydantic import BaseModel

from .. import minimax_client, tasks

MAX_COVER_BYTES = 50 * 1024 * 1024
MAX_DOWNLOAD_COVER_BYTES = 5 * 1024 * 1024

logger = logging.getLogger("minimax-music")

router = APIRouter(prefix="/api", tags=["music"])


class MusicRequest(BaseModel):
    prompt: str
    lyrics: str = ""
    title: str = ""
    is_instrumental: bool = False
    lyrics_optimizer: bool = False


class MusicStartResponse(BaseModel):
    task_id: str


class MusicStatusResponse(BaseModel):
    status: str
    title: str = ""
    audio_url: str = ""
    error: str = ""


class CoverPreprocessResponse(BaseModel):
    cover_feature_id: str
    formatted_lyrics: str
    audio_duration: float


async def _run_music_task(
    task_id: str,
    prompt: str,
    lyrics: str,
    is_instrumental: bool,
    lyrics_optimizer: bool,
) -> None:
    try:
        audio_bytes = await minimax_client.generate_music(
            prompt,
            lyrics,
            is_instrumental=is_instrumental,
            lyrics_optimizer=lyrics_optimizer,
        )
        tasks.set_done(task_id, audio_bytes)
    except Exception as exc:
        logger.exception("music generation failed")
        tasks.set_failed(task_id, str(exc))


async def _run_cover_task(
    task_id: str,
    prompt: str,
    lyrics: str,
    audio_bytes: bytes | None,
    audio_url: str | None,
    cover_feature_id: str | None,
) -> None:
    try:
        result = await minimax_client.generate_cover(
            prompt,
            audio_bytes=audio_bytes,
            audio_url=audio_url,
            cover_feature_id=cover_feature_id,
            lyrics=lyrics,
        )
        tasks.set_done(task_id, result)
    except Exception as exc:
        logger.exception("cover generation failed")
        tasks.set_failed(task_id, str(exc))


async def _read_cover_source(
    audio: UploadFile | None,
    audio_url: str,
) -> tuple[bytes | None, str | None]:
    """校验并读取翻唱参考音频（文件或 URL 二选一），返回 (audio_bytes, url)。"""
    has_file = audio is not None and audio.filename
    has_url = bool(audio_url.strip())
    if has_file == has_url:
        raise HTTPException(
            status_code=400,
            detail="provide exactly one of audio file or audio_url",
        )

    if has_file:
        assert audio is not None
        audio_bytes = await audio.read()
        if len(audio_bytes) == 0:
            raise HTTPException(status_code=400, detail="audio file is empty")
        if len(audio_bytes) > MAX_COVER_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"audio file exceeds 50 MB (got {len(audio_bytes) // (1024 * 1024)} MB)",
            )
        return audio_bytes, None

    url_value = audio_url.strip()
    if not url_value.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="audio_url must be http(s)")
    return None, url_value


@router.post("/cover/preprocess", response_model=CoverPreprocessResponse)
async def post_cover_preprocess(
    audio: UploadFile | None = File(None),
    audio_url: str = Form(""),
) -> CoverPreprocessResponse:
    audio_bytes, url_value = await _read_cover_source(audio, audio_url)

    try:
        result = await minimax_client.preprocess_cover(
            audio_bytes=audio_bytes,
            audio_url=url_value,
        )
    except Exception as exc:
        logger.exception("cover preprocess failed")
        raise HTTPException(status_code=502, detail=f"cover preprocess failed: {exc}")

    return CoverPreprocessResponse(**result)


@router.post("/cover", response_model=MusicStartResponse)
async def post_cover(
    background: BackgroundTasks,
    prompt: str = Form(...),
    lyrics: str = Form(""),
    title: str = Form(""),
    audio: UploadFile | None = File(None),
    audio_url: str = Form(""),
    cover_feature_id: str = Form(""),
) -> MusicStartResponse:
    if not prompt.strip():
        raise HTTPException(status_code=400, detail="prompt cannot be empty")

    audio_bytes: bytes | None = None
    url_value: str | None = None
    feature_id = cover_feature_id.strip() or None

    if feature_id:
        # 两步翻唱：使用前处理返回的特征 ID，歌词必填（10–1000 字符）
        has_file = audio is not None and audio.filename
        if has_file or audio_url.strip():
            raise HTTPException(
                status_code=400,
                detail="cover_feature_id is mutually exclusive with audio file / audio_url",
            )
        lyrics_len = len(lyrics.strip())
        if not (10 <= lyrics_len <= 1000):
            raise HTTPException(
                status_code=400,
                detail=f"lyrics must be 10–1000 characters when using cover_feature_id (got {lyrics_len})",
            )
    else:
        audio_bytes, url_value = await _read_cover_source(audio, audio_url)

    task = tasks.create_task(title=title or "翻唱歌曲")
    background.add_task(
        _run_cover_task, task.id, prompt, lyrics, audio_bytes, url_value, feature_id
    )
    return MusicStartResponse(task_id=task.id)


@router.post("/music", response_model=MusicStartResponse)
async def post_music(req: MusicRequest, background: BackgroundTasks) -> MusicStartResponse:
    if not req.prompt.strip():
        raise HTTPException(status_code=400, detail="prompt cannot be empty")
    if not req.is_instrumental and not req.lyrics_optimizer and not req.lyrics.strip():
        raise HTTPException(
            status_code=400,
            detail="lyrics cannot be empty (or enable is_instrumental / lyrics_optimizer)",
        )

    default_title = "纯音乐" if req.is_instrumental else "我的歌曲"
    task = tasks.create_task(title=req.title or default_title)
    background.add_task(
        _run_music_task,
        task.id,
        req.prompt,
        req.lyrics,
        req.is_instrumental,
        req.lyrics_optimizer,
    )
    return MusicStartResponse(task_id=task.id)


@router.get("/music/{task_id}", response_model=MusicStatusResponse)
async def get_music_status(task_id: str) -> MusicStatusResponse:
    task = tasks.get_task(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="task not found")

    if task.status == "done":
        return MusicStatusResponse(
            status="done",
            title=task.title,
            audio_url=f"/api/music/{task_id}/audio",
        )
    if task.status == "failed":
        return MusicStatusResponse(status="failed", error=task.error or "unknown error")

    return MusicStatusResponse(status="pending", title=task.title)


def _parse_range(header: str, total: int) -> tuple[int, int] | None:
    units, _, spec = header.partition("=")
    if units.strip().lower() != "bytes" or "," in spec:
        return None
    start_s, sep, end_s = spec.strip().partition("-")
    if not sep:
        return None
    try:
        if start_s == "":
            length = int(end_s)
            if length <= 0:
                return None
            start = max(total - length, 0)
            end = total - 1
        else:
            start = int(start_s)
            end = int(end_s) if end_s else total - 1
    except ValueError:
        return None
    if start < 0 or end >= total or start > end:
        return None
    return start, end


def _embed_id3(
    audio_bytes: bytes,
    *,
    title: str,
    lyrics: str,
    cover_bytes: bytes | None,
    cover_mime: str | None,
) -> bytes:
    buf = io.BytesIO(audio_bytes)
    try:
        audio = MP3(buf, ID3=ID3)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"failed to parse mp3: {exc}")

    if audio.tags is None:
        audio.add_tags()
    tags = audio.tags
    assert tags is not None

    if title:
        tags.delall("TIT2")
        tags.add(TIT2(encoding=3, text=title))

    if lyrics.strip():
        tags.delall("USLT")
        tags.add(USLT(encoding=3, lang="chi", desc="", text=lyrics))

    if cover_bytes is not None:
        tags.delall("APIC")
        tags.add(
            APIC(
                encoding=3,
                mime=cover_mime or "image/jpeg",
                type=3,
                desc="Cover",
                data=cover_bytes,
            )
        )

    try:
        audio.save(buf)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"failed to save mp3 tags: {exc}")
    return buf.getvalue()


@router.post("/music/{task_id}/download")
async def post_download(
    task_id: str,
    title: str = Form(""),
    lyrics: str = Form(""),
    cover: UploadFile | None = File(None),
) -> Response:
    task = tasks.get_task(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="task not found")
    if task.status != "done" or task.audio_bytes is None:
        raise HTTPException(status_code=409, detail=f"task not ready: {task.status}")

    cover_bytes: bytes | None = None
    cover_mime: str | None = None
    if cover is not None and cover.filename:
        cover_bytes = await cover.read()
        if len(cover_bytes) == 0:
            cover_bytes = None
        elif len(cover_bytes) > MAX_DOWNLOAD_COVER_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"cover image exceeds 5 MB",
            )
        else:
            cover_mime = cover.content_type or "image/jpeg"

    effective_title = title.strip() or task.title or "song"
    tagged = _embed_id3(
        task.audio_bytes,
        title=effective_title,
        lyrics=lyrics,
        cover_bytes=cover_bytes,
        cover_mime=cover_mime,
    )

    encoded = quote(f"{effective_title}.mp3")
    return Response(
        content=tagged,
        media_type="audio/mpeg",
        headers={
            "Content-Disposition": f"attachment; filename=\"song.mp3\"; filename*=UTF-8''{encoded}",
            "Content-Length": str(len(tagged)),
        },
    )


@router.get("/music/{task_id}/audio")
async def get_music_audio(task_id: str, request: Request) -> Response:
    task = tasks.get_task(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="task not found")
    if task.status != "done" or task.audio_bytes is None:
        raise HTTPException(status_code=409, detail=f"task not ready: {task.status}")

    audio = task.audio_bytes
    total = len(audio)

    raw_title = (task.title or "song").replace('"', "'")
    encoded = quote(f"{raw_title}.mp3")
    base_headers = {
        "Content-Disposition": f"inline; filename=\"song.mp3\"; filename*=UTF-8''{encoded}",
        "Accept-Ranges": "bytes",
    }

    range_header = request.headers.get("range")
    if range_header:
        parsed = _parse_range(range_header, total)
        if parsed is None:
            return Response(
                status_code=416,
                headers={**base_headers, "Content-Range": f"bytes */{total}"},
            )
        start, end = parsed
        chunk = audio[start : end + 1]
        headers = {
            **base_headers,
            "Content-Range": f"bytes {start}-{end}/{total}",
            "Content-Length": str(len(chunk)),
        }
        return Response(
            content=chunk,
            status_code=206,
            media_type="audio/mpeg",
            headers=headers,
        )

    return Response(
        content=audio,
        media_type="audio/mpeg",
        headers={**base_headers, "Content-Length": str(total)},
    )
