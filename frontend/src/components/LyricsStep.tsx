import { useState } from 'react'
import { generateLyrics } from '../api'

interface Props {
  lyrics: string
  onLyricsChange: (value: string) => void
  onTitleChange: (value: string) => void
  onStyleTagsFromLyrics: (tags: string) => void
  optional?: boolean
}

type Tab = 'manual' | 'ai'

export default function LyricsStep({
  lyrics,
  onLyricsChange,
  onTitleChange,
  onStyleTagsFromLyrics,
  optional = false,
}: Props) {
  const [tab, setTab] = useState<Tab>('manual')
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [meta, setMeta] = useState<{ title: string; styleTags: string } | null>(null)

  async function handleGenerate() {
    if (!prompt.trim()) {
      setError('请先描述歌曲主题')
      return
    }
    setError('')
    setGenerating(true)
    try {
      const result = await generateLyrics(prompt)
      onLyricsChange(result.lyrics)
      onTitleChange(result.title)
      onStyleTagsFromLyrics(result.style_tags)
      setMeta({ title: result.title, styleTags: result.style_tags })
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败')
    } finally {
      setGenerating(false)
    }
  }

  const tabClass = (active: boolean) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition ${
      active
        ? 'border-purple-600 text-purple-600'
        : 'border-transparent text-gray-500 hover:text-gray-700'
    }`

  return (
    <div>
      <div className="flex border-b mb-4">
        <button className={tabClass(tab === 'manual')} onClick={() => setTab('manual')}>
          手动输入
        </button>
        <button className={tabClass(tab === 'ai')} onClick={() => setTab('ai')}>
          AI 生成
        </button>
      </div>

      {tab === 'ai' && (
        <div className="mb-4 space-y-2">
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="描述歌曲主题，例如：一首关于离别的伤感慢歌"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={generating}
          />
          <button
            className="bg-purple-600 text-white text-sm px-4 py-2 rounded disabled:opacity-50"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? '生成中...' : '生成歌词'}
          </button>
          {error && <div className="text-red-500 text-sm">{error}</div>}
          {meta && (
            <div className="text-xs text-gray-500 space-y-1 pt-2">
              <div>
                标题：<span className="text-gray-800">{meta.title}</span>
              </div>
              <div>
                曲风：<span className="text-gray-800">{meta.styleTags}</span>
              </div>
            </div>
          )}
        </div>
      )}

      <textarea
        className="w-full border rounded px-3 py-2 text-sm font-mono h-64 lg:h-[28rem] resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        placeholder={'[verse]\n在这里输入主歌歌词...\n\n[chorus]\n在这里输入副歌歌词...'}
        value={lyrics}
        onChange={(e) => onLyricsChange(e.target.value)}
      />
      <div className="text-xs text-gray-400 mt-1">
        {optional
          ? '可选 · 留空将自动从参考音频识别歌词'
          : '使用 [verse] / [chorus] 等结构标签标记段落'}
      </div>
    </div>
  )
}
