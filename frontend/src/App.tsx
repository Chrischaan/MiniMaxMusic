import { useEffect, useRef, useState } from 'react'
import LyricsStep from './components/LyricsStep'
import StyleStep from './components/StyleStep'
import CoverStep, { type CoverInput } from './components/CoverStep'
import CoverCropModal from './components/CoverCropModal'
import Player from './components/Player'
import { downloadTaggedMp3, pollMusic, startCover, startMusic } from './api'

type GenStatus = 'idle' | 'pending' | 'done' | 'failed'
type Mode = 'create' | 'cover'

function buildPrompt(tags: string[], custom: string): string {
  const parts = [...tags]
  if (custom.trim()) {
    custom
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((s) => parts.push(s))
  }
  return parts.join(',')
}

export default function App() {
  const [mode, setMode] = useState<Mode>('create')

  const [lyrics, setLyrics] = useState('')
  const [title, setTitle] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [customStyle, setCustomStyle] = useState('')
  const [coverInput, setCoverInput] = useState<CoverInput | null>(null)

  const [genStatus, setGenStatus] = useState<GenStatus>('idle')
  const [genError, setGenError] = useState('')
  const [audioUrl, setAudioUrl] = useState('')
  const [finalTitle, setFinalTitle] = useState('')
  const [taskId, setTaskId] = useState('')

  const [coverBlob, setCoverBlob] = useState<Blob | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [coverModalOpen, setCoverModalOpen] = useState(false)

  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')

  const pollTimer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (pollTimer.current) window.clearInterval(pollTimer.current)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview)
    }
  }, [coverPreview])

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    )
  }

  function handleStyleTagsFromLyrics(tags: string) {
    setCustomStyle(tags)
  }

  function clearCover() {
    if (coverPreview) URL.revokeObjectURL(coverPreview)
    setCoverBlob(null)
    setCoverPreview(null)
  }

  function handleCoverConfirm(blob: Blob, previewUrl: string) {
    if (coverPreview) URL.revokeObjectURL(coverPreview)
    setCoverBlob(blob)
    setCoverPreview(previewUrl)
  }

  function startPolling(tid: string) {
    pollTimer.current = window.setInterval(async () => {
      try {
        const status = await pollMusic(tid)
        if (status.status === 'done') {
          if (pollTimer.current) window.clearInterval(pollTimer.current)
          setAudioUrl(status.audio_url || '')
          setFinalTitle(status.title || title || (mode === 'cover' ? '翻唱歌曲' : '我的歌曲'))
          setGenStatus('done')
        } else if (status.status === 'failed') {
          if (pollTimer.current) window.clearInterval(pollTimer.current)
          setGenError(status.error || '生成失败')
          setGenStatus('failed')
        }
      } catch (err) {
        if (pollTimer.current) window.clearInterval(pollTimer.current)
        setGenError(err instanceof Error ? err.message : '轮询失败')
        setGenStatus('failed')
      }
    }, 2000)
  }

  async function handleGenerate() {
    const prompt = buildPrompt(selectedTags, customStyle)
    if (!prompt.trim()) {
      setGenError('请至少选择或输入一个曲风')
      return
    }

    if (mode === 'create') {
      if (!lyrics.trim()) {
        setGenError('歌词不能为空')
        return
      }
    } else {
      if (!coverInput) {
        setGenError('请先提供参考音频（上传文件或粘贴链接）')
        return
      }
    }

    setGenError('')
    setDownloadError('')
    setAudioUrl('')
    setTaskId('')
    clearCover()
    setGenStatus('pending')

    try {
      const { task_id } =
        mode === 'create'
          ? await startMusic(prompt, lyrics, title)
          : await startCover(coverInput!, prompt, lyrics, title)

      setTaskId(task_id)
      startPolling(task_id)
    } catch (err) {
      setGenError(err instanceof Error ? err.message : '提交失败')
      setGenStatus('failed')
    }
  }

  async function handleDownload() {
    if (!taskId) return
    setDownloading(true)
    setDownloadError('')
    try {
      const blob = await downloadTaggedMp3(taskId, {
        title: finalTitle || title || '我的歌曲',
        lyrics,
        cover: coverBlob,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${finalTitle || title || 'song'}.mp3`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : '下载失败')
    } finally {
      setDownloading(false)
    }
  }

  const busy = genStatus === 'pending'
  const hasPlayer = Boolean(audioUrl)
  const isCover = mode === 'cover'
  const lyricsStepNum = isCover ? 2 : 1
  const styleStepNum = isCover ? 3 : 2
  const generateStepNum = isCover ? 4 : 3

  const lyricsPanel = (
    <Panel title={`Step ${lyricsStepNum} · 歌词${isCover ? '（可选）' : ''}`}>
      <LyricsStep
        lyrics={lyrics}
        onLyricsChange={setLyrics}
        onTitleChange={setTitle}
        onStyleTagsFromLyrics={handleStyleTagsFromLyrics}
        optional={isCover}
      />
    </Panel>
  )

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-4 lg:px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-xl font-semibold">🎵 AI 音乐生成器</h1>
          <ModeTabs mode={mode} onChange={setMode} />
        </div>
      </header>

      <main
        className={`max-w-6xl mx-auto px-4 lg:px-6 py-6 ${
          hasPlayer ? 'pb-32' : ''
        }`}
      >
        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[1.4fr_1fr] lg:gap-6 lg:items-start">
          <div className="flex flex-col gap-6 lg:sticky lg:top-6">
            {isCover && (
              <Panel title="Step 1 · 参考音频">
                <CoverStep value={coverInput} onChange={setCoverInput} />
              </Panel>
            )}
            {lyricsPanel}
          </div>

          <div className="flex flex-col gap-6">
            <Panel title={`Step ${styleStepNum} · 曲风`}>
              <StyleStep
                selectedTags={selectedTags}
                onToggleTag={toggleTag}
                customStyle={customStyle}
                onCustomStyleChange={setCustomStyle}
              />
            </Panel>

            <Panel title={`Step ${generateStepNum} · 生成`}>
              <button
                onClick={handleGenerate}
                disabled={busy}
                className="w-full bg-purple-600 text-white px-6 py-3 rounded-lg text-base font-medium hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy
                  ? '生成中，约需 30 秒...'
                  : isCover
                    ? '🎤 生成翻唱'
                    : '🎵 生成歌曲'}
              </button>
              {genError && <div className="mt-2 text-sm text-red-500">{genError}</div>}
            </Panel>
          </div>
        </div>
      </main>

      {hasPlayer && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-40">
          <div className="max-w-6xl mx-auto px-4 lg:px-6 py-3">
            <Player
              audioUrl={audioUrl}
              title={finalTitle}
              coverPreview={coverPreview}
              onOpenCover={() => setCoverModalOpen(true)}
              onDownload={handleDownload}
              downloading={downloading}
            />
            {downloadError && (
              <div className="mt-2 text-xs text-red-500">{downloadError}</div>
            )}
          </div>
        </div>
      )}

      <CoverCropModal
        open={coverModalOpen}
        onClose={() => setCoverModalOpen(false)}
        onConfirm={handleCoverConfirm}
      />
    </div>
  )
}

function ModeTabs({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const tab = (m: Mode, label: string) => (
    <button
      onClick={() => onChange(m)}
      className={`px-4 py-2 text-sm font-medium rounded-md transition ${
        mode === m
          ? 'bg-white text-purple-600 shadow'
          : 'text-gray-600 hover:text-gray-800'
      }`}
    >
      {label}
    </button>
  )
  return (
    <div className="inline-flex bg-gray-100 rounded-lg p-1">
      {tab('create', '🎵 创作')}
      {tab('cover', '🎤 翻唱')}
    </div>
  )
}

function Panel({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-lg border shadow-sm p-5">
      <div className="text-sm font-semibold text-gray-700 mb-3">{title}</div>
      {children}
    </div>
  )
}
