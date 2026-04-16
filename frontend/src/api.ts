export interface LyricsResult {
  title: string
  style_tags: string
  lyrics: string
}

export interface MusicStatus {
  status: 'pending' | 'done' | 'failed'
  title?: string
  audio_url?: string
  error?: string
}

async function handle<T>(resp: Response): Promise<T> {
  if (!resp.ok) {
    let detail = resp.statusText
    try {
      const body = await resp.json()
      if (body?.detail) detail = body.detail
    } catch {
      // ignore
    }
    throw new Error(detail)
  }
  return resp.json() as Promise<T>
}

export async function generateLyrics(prompt: string): Promise<LyricsResult> {
  const resp = await fetch('/api/lyrics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  })
  return handle<LyricsResult>(resp)
}

export async function startMusic(
  prompt: string,
  lyrics: string,
  title: string,
): Promise<{ task_id: string }> {
  const resp = await fetch('/api/music', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, lyrics, title }),
  })
  return handle<{ task_id: string }>(resp)
}

export async function pollMusic(taskId: string): Promise<MusicStatus> {
  const resp = await fetch(`/api/music/${taskId}`)
  return handle<MusicStatus>(resp)
}

export type CoverSource = { kind: 'file'; file: File } | { kind: 'url'; url: string }

export async function downloadTaggedMp3(
  taskId: string,
  opts: { title: string; lyrics: string; cover: Blob | null },
): Promise<Blob> {
  const form = new FormData()
  form.append('title', opts.title)
  form.append('lyrics', opts.lyrics)
  if (opts.cover) {
    form.append('cover', opts.cover, 'cover.jpg')
  }
  const resp = await fetch(`/api/music/${taskId}/download`, {
    method: 'POST',
    body: form,
  })
  if (!resp.ok) {
    let detail = resp.statusText
    try {
      const body = await resp.json()
      if (body?.detail) detail = body.detail
    } catch {
      // ignore
    }
    throw new Error(detail)
  }
  return resp.blob()
}

export async function startCover(
  source: CoverSource,
  prompt: string,
  lyrics: string,
  title: string,
): Promise<{ task_id: string }> {
  const form = new FormData()
  form.append('prompt', prompt)
  form.append('lyrics', lyrics)
  form.append('title', title)
  if (source.kind === 'file') {
    form.append('audio', source.file)
  } else {
    form.append('audio_url', source.url)
  }
  const resp = await fetch('/api/cover', {
    method: 'POST',
    body: form,
  })
  return handle<{ task_id: string }>(resp)
}
