import React from 'react'
import { X, Download, BarChart3 } from 'lucide-react'

export default function CanvasPanel({ image, title, onClose }) {
  if (!image) return null

  const imageUrl = `/api/plots/${encodeURIComponent(image)}`

  const handleDownload = () => {
    const a = document.createElement('a')
    a.href = imageUrl
    a.download = image
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="canvas-panel">
      <div className="canvas-panel-header">
        <div className="canvas-panel-title">
          <BarChart3 size={15} />
          <span>{title || 'Graph'}</span>
        </div>
        <div className="canvas-panel-actions">
          <button
            className="canvas-panel-btn"
            onClick={handleDownload}
            title="Download image"
          >
            <Download size={14} />
          </button>
          <button
            className="canvas-panel-btn canvas-panel-close"
            onClick={onClose}
            title="Close panel"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="canvas-panel-body">
        <img
          src={imageUrl}
          alt={title || 'Generated plot'}
          className="canvas-panel-image"
        />
      </div>
      <div className="canvas-panel-footer">
        Saved as {image}
      </div>
    </div>
  )
}
