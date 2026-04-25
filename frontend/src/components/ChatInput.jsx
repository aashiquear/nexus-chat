import React, { useRef, useEffect, useState } from 'react'
import {
  Send, Paperclip, X, BarChart2,
  Sparkles, Brain, MessageSquare, Wrench, CircleCheck, AlertCircle,
} from 'lucide-react'
import StatsPopup from './StatsPopup'

// Map an llmStatus.stage to the icon + label shown inside the pop-up.
// `stage: 'idle'` collapses the pop-up to a quiet "awaiting prompt" state.
const STATUS_VIEW = {
  initiated:      { Icon: Sparkles,     label: 'Initiated' },
  thinking:       { Icon: Brain,        label: 'Thinking' },
  responding:     { Icon: MessageSquare,label: 'Responding' },
  tool_calling:   { Icon: Wrench,       label: 'Calling tool' },
  tool_executing: { Icon: Wrench,       label: 'Executing tool' },
  idle:           { Icon: CircleCheck,  label: 'Awaiting chat prompt' },
  error:          { Icon: AlertCircle,  label: 'Error' },
}

function ConnectingDots() {
  // Five dots joined by a sliding gradient — provides an at-a-glance
  // "still working" cue independent of the in-message typing indicator,
  // which is easy to miss after scrolling.
  return (
    <span className="connecting-dots" aria-hidden="true">
      <span className="connecting-line" />
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className="connecting-dot" style={{ animationDelay: `${i * 0.12}s` }} />
      ))}
    </span>
  )
}

function LlmStatusPopup({ status, isStreaming }) {
  const stage = status?.stage || 'idle'
  const view = STATUS_VIEW[stage] || STATUS_VIEW.idle
  const { Icon, label } = view
  const active = isStreaming && stage !== 'idle' && stage !== 'error'
  return (
    <div className={`llm-status-popup stage-${stage} ${active ? 'is-active' : 'is-quiet'}`}>
      <Icon size={14} className="llm-status-icon" />
      <span className="llm-status-label">
        {label}
        {status?.detail ? <span className="llm-status-detail"> · {status.detail}</span> : null}
      </span>
      {active && <ConnectingDots />}
    </div>
  )
}

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
  llmStatus,
  isStreaming,
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
        {/* Floating LLM response status — visible just above the chat input
            so it stays in view even when the message list scrolls. */}
        <LlmStatusPopup status={llmStatus} isStreaming={isStreaming} />
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
