import { useCallback, useEffect, useRef, useState } from 'react'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import { cropImageToBlob } from '../utils/cropImage'

interface Props {
  open: boolean
  onClose: () => void
  onConfirm: (blob: Blob, previewUrl: string) => void
}

export default function CoverCropModal({ open, onClose, onConfirm }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [imageSrc, setImageSrc] = useState<string>('')
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedArea, setCroppedArea] = useState<Area | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) {
      setImageSrc('')
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setCroppedArea(null)
      setBusy(false)
      setError('')
    }
  }, [open])

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedArea(areaPixels)
  }, [])

  function handleFile(file: File | null) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('请选择图片文件')
      return
    }
    setError('')
    const reader = new FileReader()
    reader.onload = () => {
      setImageSrc(reader.result as string)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
    }
    reader.readAsDataURL(file)
  }

  async function handleConfirm() {
    if (!imageSrc || !croppedArea) return
    setBusy(true)
    setError('')
    try {
      const blob = await cropImageToBlob(imageSrc, croppedArea, 800, 0.85)
      const url = URL.createObjectURL(blob)
      onConfirm(blob, url)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '裁剪失败')
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="font-semibold">设置封面</div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-xl leading-none">
            ×
          </button>
        </div>

        <div className="p-4 space-y-3">
          {!imageSrc ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-10 text-center cursor-pointer hover:border-purple-400 hover:bg-gray-50 transition"
            >
              <div className="text-3xl mb-2">🖼</div>
              <div className="text-sm text-gray-700">
                <span className="text-purple-600 font-medium">点击选择图片</span>
              </div>
              <div className="text-xs text-gray-400 mt-1">
                JPEG / PNG · 建议使用方形或正方形构图的图片
              </div>
            </div>
          ) : (
            <>
              <div className="relative w-full h-80 bg-gray-100 rounded-md overflow-hidden">
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-10">缩放</span>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="flex-1"
                />
              </div>
              <div className="flex justify-between text-xs">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-purple-600 hover:underline"
                >
                  换一张
                </button>
                <span className="text-gray-400">输出 800 × 800 JPEG</span>
              </div>
            </>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />

          {error && <div className="text-red-500 text-sm">{error}</div>}
        </div>

        <div className="p-4 border-t flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={!imageSrc || !croppedArea || busy}
            className="px-4 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 transition disabled:opacity-50"
          >
            {busy ? '处理中...' : '确认'}
          </button>
        </div>
      </div>
    </div>
  )
}
