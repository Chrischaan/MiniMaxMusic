import { useEffect, useRef, useState } from 'react'

export type CoverInput = { kind: 'file'; file: File } | { kind: 'url'; url: string }

interface Props {
  value: CoverInput | null
  onChange: (value: CoverInput | null) => void
}

const MAX_BYTES = 50 * 1024 * 1024
const ACCEPT = 'audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/flac,.mp3,.wav,.flac'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

type Tab = 'file' | 'url'

export default function CoverStep({ value, onChange }: Props) {
  const [tab, setTab] = useState<Tab>(value?.kind === 'url' ? 'url' : 'file')
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [urlText, setUrlText] = useState(value?.kind === 'url' ? value.url : '')

  const file = value?.kind === 'file' ? value.file : null

  useEffect(() => {
    if (!file) {
      setPreviewUrl('')
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function switchTab(next: Tab) {
    if (next === tab) return
    setTab(next)
    setError('')
    onChange(null)
    if (next === 'url') {
      setUrlText('')
    }
  }

  function validateAndSetFile(f: File | null) {
    if (!f) {
      onChange(null)
      setError('')
      return
    }
    if (f.size > MAX_BYTES) {
      setError(`文件超过 50 MB 限制（${formatSize(f.size)}）`)
      return
    }
    if (!/\.(mp3|wav|flac)$/i.test(f.name) && !f.type.startsWith('audio/')) {
      setError('只支持 mp3 / wav / flac 格式')
      return
    }
    setError('')
    onChange({ kind: 'file', file: f })
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0] ?? null
    validateAndSetFile(f)
  }

  function handleUrlChange(v: string) {
    setUrlText(v)
    const trimmed = v.trim()
    if (!trimmed) {
      onChange(null)
      setError('')
      return
    }
    if (!/^https?:\/\//i.test(trimmed)) {
      setError('请输入 http(s):// 开头的直链')
      onChange(null)
      return
    }
    setError('')
    onChange({ kind: 'url', url: trimmed })
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
        <button className={tabClass(tab === 'file')} onClick={() => switchTab('file')}>
          上传文件
        </button>
        <button className={tabClass(tab === 'url')} onClick={() => switchTab('url')}>
          粘贴链接
        </button>
      </div>

      {tab === 'file' ? (
        <div className="space-y-3">
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition ${
              dragOver
                ? 'border-purple-600 bg-purple-50'
                : 'border-gray-300 hover:border-purple-400 hover:bg-gray-50'
            }`}
          >
            <div className="text-2xl mb-2">🎵</div>
            <div className="text-sm text-gray-700">
              {file ? (
                <span className="font-medium">{file.name}</span>
              ) : (
                <>
                  <span className="text-purple-600 font-medium">点击上传</span> 或拖放音频到此处
                </>
              )}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              mp3 / wav / flac · 6 秒–6 分钟 · 最大 50 MB
            </div>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => validateAndSetFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {file && previewUrl && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>参考音频 · {formatSize(file.size)}</span>
                <button
                  onClick={() => {
                    validateAndSetFile(null)
                    if (inputRef.current) inputRef.current.value = ''
                  }}
                  className="text-red-500 hover:underline"
                >
                  移除
                </button>
              </div>
              <audio controls src={previewUrl} className="w-full" />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <input
            type="url"
            value={urlText}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://example.com/song.mp3"
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <div className="text-xs text-gray-400">
            必须是 MiniMax 服务端能访问的公网直链（mp3 / wav / flac）
          </div>
        </div>
      )}

      {error && <div className="text-red-500 text-sm mt-2">{error}</div>}
    </div>
  )
}
