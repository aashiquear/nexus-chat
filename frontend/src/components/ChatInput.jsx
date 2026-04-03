import React, { useRef, useEffect } from 'react'
import { Send, Paperclip, X } from 'lucide-react'

export default function ChatInput({
  value,
  onChange,
  onSend,
  onUpload,
  disabled,
  selectedFiles,
  onRemoveFile,
}) {
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)

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
