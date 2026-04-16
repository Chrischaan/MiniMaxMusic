interface Props {
  audioUrl: string
  title: string
  coverPreview: string | null
  onOpenCover: () => void
  onDownload: () => void
  downloading: boolean
}

export default function Player({
  audioUrl,
  title,
  coverPreview,
  onOpenCover,
  onDownload,
  downloading,
}: Props) {
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
        <div className="font-medium text-gray-800 truncate lg:w-40 lg:shrink-0">
          🎵 {title || '我的歌曲'}
        </div>
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
