import React from 'react'
import {
  Check, Calculator, Search, Code2, Clock, FileText,
  Wrench, Plus, Trash2, Paperclip, MessageSquarePlus,
} from 'lucide-react'

const ICON_MAP = {
  calculator: Calculator,
  search: Search,
  code: Code2,
  clock: Clock,
  'file-text': FileText,
}

export default function Sidebar({
  models,
  selectedModel,
  onModelChange,
  tools,
  selectedTools,
  onToggleTool,
  files,
  selectedFiles,
  onToggleFile,
  onUpload,
  onDeleteFile,
  onNewChat,
  isOpen,
  onClose,
}) {
  const fileInputRef = React.useRef(null)

  const handleUploadClick = () => fileInputRef.current?.click()

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (file) {
      await onUpload(file)
      e.target.value = ''
    }
  }

  // Group models by provider
  const grouped = {}
  models.forEach((m) => {
    const p = m.provider || 'unknown'
    if (!grouped[p]) grouped[p] = []
    grouped[p].push(m)
  })

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">N</div>
          <span className="sidebar-title">Nexus Chat</span>
        </div>

        <button className="new-chat-btn" onClick={onNewChat}>
          <MessageSquarePlus size={15} />
          New Conversation
        </button>

        {/* Model selector */}
        <div className="sidebar-section">
          <div className="sidebar-section-label">Model</div>
        </div>
        <div className="model-selector">
          <select
            className="model-select"
            value={selectedModel}
            onChange={(e) => onModelChange(e.target.value)}
          >
            {Object.entries(grouped).map(([provider, provModels]) => (
              <optgroup key={provider} label={provider.charAt(0).toUpperCase() + provider.slice(1)}>
                {provModels.map((m) => (
                  <option key={m.id} value={m.id} disabled={!m.available}>
                    {m.name}{m.available ? '' : ' (not configured)'}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="sidebar-body">
          {/* Tools */}
          <div className="sidebar-section">
            <div className="sidebar-section-label">Tools</div>
          </div>
          {tools.map((tool) => {
            const active = selectedTools.includes(tool.id)
            const Icon = ICON_MAP[tool.icon] || Wrench
            return (
              <div
                key={tool.id}
                className="toggle-item"
                onClick={() => onToggleTool(tool.id)}
              >
                <div className={`toggle-check ${active ? 'active' : ''}`}>
                  {active && <Check size={11} color="#fff" strokeWidth={3} />}
                </div>
                <Icon size={15} className="toggle-icon" />
                <div>
                  <div className="toggle-label">{tool.name}</div>
                  <div className="toggle-desc">{tool.description}</div>
                </div>
              </div>
            )
          })}

          {/* Files */}
          <div className="sidebar-section" style={{ marginTop: 8 }}>
            <div className="sidebar-section-label">Files (RAG)</div>
          </div>
          {files.length === 0 && (
            <div style={{ padding: '4px 16px', fontSize: 12.5, color: 'var(--text-tertiary)' }}>
              No files uploaded yet
            </div>
          )}
          {files.map((file) => {
            const active = selectedFiles.includes(file.name)
            return (
              <div
                key={file.name}
                className="toggle-item"
                onClick={() => onToggleFile(file.name)}
              >
                <div className={`toggle-check ${active ? 'active' : ''}`}>
                  {active && <Check size={11} color="#fff" strokeWidth={3} />}
                </div>
                <FileText size={15} className="toggle-icon" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="toggle-label" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.name}
                  </div>
                  <div className="toggle-desc">
                    {(file.size / 1024).toFixed(1)} KB
                  </div>
                </div>
                <button
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-tertiary)', padding: 2,
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteFile(file.name)
                  }}
                  title="Delete file"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )
          })}

          <button
            className="new-chat-btn"
            style={{ margin: '8px 16px' }}
            onClick={handleUploadClick}
          >
            <Paperclip size={14} />
            Upload File
          </button>
          <input
            ref={fileInputRef}
            type="file"
            hidden
            onChange={handleFileChange}
          />
        </div>
      </aside>
    </>
  )
}
