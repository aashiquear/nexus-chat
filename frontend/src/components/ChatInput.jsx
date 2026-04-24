import React, { useRef, useEffect, useState } from 'react'
import { Send, Paperclip, X, BarChart2 } from 'lucide-react'
import StatsPopup from './StatsPopup'

function CircularProgress({ progress, size = 32, strokeWidth = 3 }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (progress / 100) * circumference

  return (
    <svg width={size} height={size} className="circular-progress">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--border)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.2s ease' }}
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--text-secondary)"
        fontSize="9"
        fontWeight="600"
        fontFamily="var(--font-body)"
      >
        {progress}%
      </text>
    </svg>
  )
}

export default function ChatInput({
  value,
  onChange,
  onSend,
  onUpload,
  disabled,
  selectedFiles,
  onRemoveFile,
  uploadProgress,
  conversationStats,
  lastResponseStats,
}) {
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)
  const [showStats, setShowStats] = useState(false)

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 180) + 'px'
    }
  }, [value])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (value.trim() && !disabled) onSend()
    }
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (file) {
      await onUpload(file)
      e.target.value = ''
    }
  }

  return (
    <div className="input-area">
      <div className="input-container">
        {/* Upload progress chip: shows current stage (uploading vs embedding) and % */}
        {uploadProgress && (
          <div className={`upload-progress-chip stage-${uploadProgress.stage || 'uploading'}`}>
            <CircularProgress progress={uploadProgress.percent || 0} />
            <div className="upload-progress-chip-text">
              <span className="upload-progress-chip-name">{uploadProgress.filename}</span>
              <span className="upload-progress-chip-stage">
                {uploadProgress.stage === 'embedding'
                  ? 'Embedding into vector store…'
                  : uploadProgress.stage === 'error'
                  ? 'Failed'
                  : 'Uploading…'}
              </span>
            </div>
          </div>
        )}
        {selectedFiles.length > 0 && (
          <div className="file-chips">
            {selectedFiles.map((name) => (
              <div key={name} className="file-chip">
                {name}
                <span className="file-chip-remove" onClick={() => onRemoveFile(name)}>
                  <X size={12} />
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="input-wrapper">
          <button
            className="upload-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Upload file"
          >
            <Paperclip size={17} />
          </button>
          <div className="stats-btn-wrapper">
            <button
              className={`stats-btn ${showStats ? 'active' : ''}`}
              onClick={() => setShowStats(!showStats)}
              title="Conversation statistics"
            >
              <BarChart2 size={17} />
            </button>
            {showStats && conversationStats && (
              <StatsPopup
                stats={conversationStats}
                lastResponse={lastResponseStats}
                onClose={() => setShowStats(false)}
              />
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            hidden
            onChange={handleFileChange}
          />
          <textarea
            ref={textareaRef}
            className="chat-input"
            placeholder="Type your message... (Shift+Enter for new line)"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={disabled}
          />
          <button
            className="send-btn"
            onClick={onSend}
            disabled={!value.trim() || disabled}
            title="Send message"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
