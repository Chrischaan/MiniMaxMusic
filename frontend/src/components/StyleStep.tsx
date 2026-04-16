interface Props {
  selectedTags: string[]
  onToggleTag: (tag: string) => void
  customStyle: string
  onCustomStyleChange: (value: string) => void
}

const PRESET_GROUPS: { label: string; tags: string[] }[] = [
  { label: '情绪', tags: ['忧郁', '欢快', '浪漫', '治愈', '燃情'] },
  { label: '风格', tags: ['民谣', '流行', 'R&B', '古风', '摇滚'] },
  { label: '场景', tags: ['咖啡馆', '夏日', '雨天', '夜晚', '旅途'] },
]

export default function StyleStep({
  selectedTags,
  onToggleTag,
  customStyle,
  onCustomStyleChange,
}: Props) {
  return (
    <div className="space-y-4">
      {PRESET_GROUPS.map((group) => (
        <div key={group.label}>
          <div className="text-xs text-gray-500 mb-2">{group.label}</div>
          <div className="flex flex-wrap gap-2">
            {group.tags.map((tag) => {
              const active = selectedTags.includes(tag)
              return (
                <button
                  key={tag}
                  onClick={() => onToggleTag(tag)}
                  className={`px-3 py-1 text-sm rounded-full border transition ${
                    active
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-purple-400'
                  }`}
                >
                  {tag}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <div>
        <div className="text-xs text-gray-500 mb-2">自定义（逗号分隔）</div>
        <input
          className="w-full border rounded px-3 py-2 text-sm"
          placeholder="例如：电子, 梦幻, 90 BPM"
          value={customStyle}
          onChange={(e) => onCustomStyleChange(e.target.value)}
        />
      </div>
    </div>
  )
}
