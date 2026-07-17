import { useEffect, useRef, useState } from 'react'
import LyricsStep from './components/LyricsStep'
import StyleStep from './components/StyleStep'
import CoverStep, { type CoverInput } from './components/CoverStep'
import CoverCropModal from './components/CoverCropModal'
import Player from './components/Player'
import {
  downloadTaggedMp3,
  pollMusic,
  preprocessCover,
  startCover,
  startMusic,
  type CoverSource,
} from './api'

type GenStatus = 'idle' | 'pending' | 'done' | 'failed'
type Mode = 'create' | 'cover'
type VocalMode = 'lyrics' | 'auto' | 'instrumental'

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
  const [vocalMode, setVocalMode] = useState<VocalMode>('lyrics')

  const [lyrics, setLyrics] = useState('')
  const [title, setTitle] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [customStyle, setCustomStyle] = useState('')
  const [coverInput, setCoverInput] = useState<CoverInput | null>(null)

  const [coverFeature, setCoverFeature] = useState<{ id: string; duration: number } | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState('')

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

  function handleCoverInputChange(value: CoverInput | null) {
    setCoverInput(value)
    // 参考音频变化后，之前提取的特征已过期，退回一步翻唱
    setCoverFeature(null)
    setExtractError('')
  }

  async function handleExtractLyrics() {
    if (!coverInput) {
      setExtractError('请先提供参考音频（上传文件或粘贴链接）')
      return
    }
    setExtractError('')
    setExtracting(true)
    try {
      const result = await preprocessCover(coverInput)
      setCoverFeature({ id: result.cover_feature_id, duration: result.audio_duration })
      setLyrics(result.formatted_lyrics)
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : '提取失败')
    } finally {
      setExtracting(false)
    }
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
      if (vocalMode === 'lyrics' && !lyrics.trim()) {
        setGenError('歌词不能为空')
        return
      }
    } else if (coverFeature) {
      const len = lyrics.trim().length
      if (len < 10 || len > 1000) {
        setGenError(`两步翻唱模式下歌词需 10–1000 字（当前 ${len} 字）`)
        return
      }
    } else if (!coverInput) {
      setGenError('请先提供参考音频（上传文件或粘贴链接）')
      return
    }

    setGenError('')
    setDownloadError('')
    setAudioUrl('')
    setTaskId('')
    clearCover()
    setGenStatus('pending')

    try {
      let task_id: string
      if (mode === 'create') {
        const res = await startMusic(prompt, vocalMode === 'lyrics' ? lyrics : '', title, {
          isInstrumental: vocalMode === 'instrumental',
          lyricsOptimizer: vocalMode === 'auto',
        })
        task_id = res.task_id
      } else {
        const source: CoverSource = coverFeature
          ? { kind: 'feature', featureId: coverFeature.id }
          : coverInput!
        const res = await startCover(source, prompt, lyrics, title)
        task_id = res.task_id
      }

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

  const showLyricsEditor = isCover || vocalMode === 'lyrics'
  const lyricsPanelTitle = isCover
    ? `Step ${lyricsStepNum} · 歌词${coverFeature ? '（已提取，可编辑）' : '（可选）'}`
    : `Step ${lyricsStepNum} · 歌词`

  const lyricsPanel = (
    <Panel title={lyricsPanelTitle}>
      {!isCover && <VocalModeSelector value={vocalMode} onChange={setVocalMode} />}
      {showLyricsEditor ? (
        <LyricsStep
          lyrics={lyrics}
          onLyricsChange={setLyrics}
          onTitleChange={setTitle}
          onStyleTagsFromLyrics={handleStyleTagsFromLyrics}
          optional={isCover && !coverFeature}
        />
      ) : (
        <div className="rounded-lg bg-purple-50 border border-purple-100 px-4 py-3 text-sm text-purple-800">
          {vocalMode === 'auto'
            ? '✨ AI 智能填词已开启：无需输入歌词，模型将根据曲风描述自动创作歌词并演唱。'
            : '🎹 纯音乐模式：生成不含人声的器乐作品，请在曲风中描述乐器、情绪与场景。'}
        </div>
      )}
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
                <CoverStep value={coverInput} onChange={handleCoverInputChange} />
                <div className="mt-4 pt-4 border-t">
                  {coverFeature ? (
                    <div className="flex items-center justify-between gap-3 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm">
                      <span className="text-green-800">
                        ✅ 已提取歌词（{Math.round(coverFeature.duration)} 秒）· 可在下方编辑后生成翻唱
                      </span>
                      <button
                        onClick={() => setCoverFeature(null)}
                        className="text-xs text-gray-500 hover:text-gray-700 underline shrink-0"
                      >
                        放弃编辑
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <button
                        onClick={handleExtractLyrics}
                        disabled={!coverInput || extracting}
                        className="w-full border border-purple-300 text-purple-700 text-sm font-medium px-4 py-2 rounded-lg hover:bg-purple-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {extracting ? '提取中，约需 30 秒...' : '🔍 提取歌词（免费 · 可编辑后翻唱）'}
                      </button>
                      <div className="text-xs text-gray-400">
                        不提取则直接翻唱，歌词将从参考音频自动识别
                      </div>
                    </div>
                  )}
                  {extractError && (
                    <div className="mt-2 text-sm text-red-500">{extractError}</div>
                  )}
                </div>
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
                    : vocalMode === 'instrumental'
                      ? '🎹 生成纯音乐'
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
              onTitleChange={setFinalTitle}
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

function VocalModeSelector({
  value,
  onChange,
}: {
  value: VocalMode
  onChange: (v: VocalMode) => void
}) {
  const options: Array<[VocalMode, string]> = [
    ['lyrics', '📝 歌词演唱'],
    ['auto', '✨ AI 填词'],
    ['instrumental', '🎹 纯音乐'],
  ]
  return (
    <div className="inline-flex bg-gray-100 rounded-lg p-1 mb-4">
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
            value === v
              ? 'bg-white text-purple-600 shadow'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          {label}
        </button>
      ))}
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
