import { useState } from 'react'

interface Props {
  audioUrl: string
  title: string
  coverPreview: string | null
  onOpenCover: () => void
  onTitleChange: (title: string) => void
  onDownload: () => void
  downloading: boolean
}

export default function Player({
  audioUrl,
  title,
  coverPreview,
  onOpenCover,
  onTitleChange,
  onDownload,
  downloading,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  function startEdit() {
    setDraft(title || '我的歌曲')
    setEditing(true)
  }

  function commit() {
    const next = draft.trim()
    if (next) onTitleChange(next)
    setEditing(false)
  }

  return (
    <div className="flex items-center gap-3 lg:gap-4">
      <button
        onClick={onOpenCover}
        className="shrink-0 w-14 h-14 rounded-md bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center hover:ring-2 hover:ring-purple-400 transition"
        title="设置封面"
      >
        {coverPreview ? (
          <img src={coverPreview} alt="cover" className="w-full h-full object-cover" />
        ) : (
          <span className="text-xl text-gray-400">🖼</span>
        )}
      </button>

      <div className="flex-1 min-w-0 flex flex-col gap-1 lg:flex-row lg:items-center lg:gap-4">
        {editing ? (
          <input
            autoFocus
            value={draft}
            maxLength={80}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') setEditing(false)
            }}
            className="lg:w-40 lg:shrink-0 border border-purple-300 rounded px-2 py-1 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        ) : (
          <button
            onClick={startEdit}
            title="点击重命名，下载将使用新名字"
            className="group flex items-center gap-1 min-w-0 lg:w-40 lg:shrink-0 text-left font-medium text-gray-800 hover:text-purple-600 transition"
          >
            <span className="truncate">🎵 {title || '我的歌曲'}</span>
            <span className="shrink-0 text-xs text-gray-400 group-hover:text-purple-500">✏️</span>
          </button>
        )}
        <audio controls src={audioUrl} className="w-full lg:flex-1" />
      </div>

      <button
        onClick={onDownload}
        disabled={downloading}
        className="shrink-0 inline-flex items-center justify-center gap-1 px-4 py-2 text-sm font-medium text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50 transition disabled:opacity-50"
      >
        {downloading ? '打包中...' : '⬇ 下载'}
      </button>
    </div>
  )
}
