import React, { useState } from 'react'
import { X, Download, BarChart3 } from 'lucide-react'
import createPlotlyComponent from 'react-plotly.js/factory'
import Plotly from 'plotly.js-dist-min'

const Plot = createPlotlyComponent(Plotly)

export default function CanvasPanel({ image, figureJson, title, onClose, style }) {
  const [downloading, setDownloading] = useState(false)

  if (!image && !figureJson) return null

  const imageUrl = image ? `/api/plots/${encodeURIComponent(image)}` : null

  const handleDownload = async () => {
    if (image) {
      const a = document.createElement('a')
      a.href = imageUrl
      a.download = image
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      return
    }

    // Convert Plotly JSON to PNG via backend, then download
    setDownloading(true)
    try {
      const res = await fetch('/api/plots/from-json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ figure_json: figureJson }),
      })
      if (!res.ok) throw new Error('Export failed')
      const { filename } = await res.json()
      const a = document.createElement('a')
      a.href = `/api/plots/${encodeURIComponent(filename)}`
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (err) {
      console.error('Plotly PNG download failed:', err)
    } finally {
      setDownloading(false)
    }
  }

  const plotlyLayout = figureJson ? {
    ...(figureJson.layout || {}),
    autosize: true,
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { color: '#c9d1d9' },
  } : null

  return (
    <div className="canvas-panel" style={style}>
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
            disabled={downloading}
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
        {figureJson ? (
          <Plot
            data={figureJson.data || []}
            layout={plotlyLayout}
            config={{ responsive: true, displayModeBar: true, displaylogo: false }}
            useResizeHandler
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <img
            src={imageUrl}
            alt={title || 'Generated plot'}
            className="canvas-panel-image"
          />
        )}
      </div>
      <div className="canvas-panel-footer">
        {image ? `Saved as ${image}` : 'Interactive Plotly chart'}
      </div>
    </div>
  )
}
