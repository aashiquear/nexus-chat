import React, { useState } from 'react'
import {
  User, Bot, Wrench, CheckCircle2, ChevronDown, ChevronRight,
  BarChart3, Image as ImageIcon, Eye,
} from 'lucide-react'

// Simple markdown-like renderer (no dependency needed for basics)
function renderContent(text) {
  if (!text) return null

  // Split into code blocks and text
  const parts = text.split(/(```[\s\S]*?```)/g)

  return parts.map((part, i) => {
    // Code block
    if (part.startsWith('```')) {
      const lines = part.slice(3, -3)
      const firstNewline = lines.indexOf('\n')
      const lang = firstNewline > 0 ? lines.slice(0, firstNewline).trim() : ''
      const code = firstNewline > 0 ? lines.slice(firstNewline + 1) : lines
      return (
        <pre key={i}>
          <code>{code}</code>
        </pre>
      )
    }

    // Regular text: handle inline code, bold, links
    return part.split('\n').map((line, j) => {
      if (!line.trim()) return <br key={`${i}-${j}`} />

      // Process inline formatting
      let processed = line
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')

      return (
        <p
          key={`${i}-${j}`}
          dangerouslySetInnerHTML={{ __html: processed }}
        />
      )
    })
  })
}

function ToolCallDropdown({ toolCall, toolResult }) {
  const [isOpen, setIsOpen] = useState(false)

  // Parse result to check for special types
  let parsed = null
  if (toolResult) {
    try { parsed = JSON.parse(toolResult.result) } catch {}
  }

  const isSvg = parsed && parsed.svg && parsed.svg.includes('<svg')
  const isPlot = parsed && parsed.plot_image
  const isImageAnalysis = parsed && parsed.analysis && toolCall.name === 'image_analyzer'
  const hasError = parsed && parsed.error

  // Determine status icon and label
  let statusIcon, statusText, statusColor
  if (!toolResult) {
    statusIcon = <Wrench size={12} className="tool-status-spin" />
    statusText = `Running ${toolCall.name}...`
    statusColor = 'var(--accent)'
  } else if (hasError) {
    statusIcon = <CheckCircle2 size={12} />
    statusText = `${toolCall.name} — error`
    statusColor = 'var(--error)'
  } else {
    statusIcon = <CheckCircle2 size={12} />
    statusText = `${toolCall.name} — done`
    statusColor = 'var(--success)'
  }

  return (
    <div className="tool-dropdown">
      <button
        className="tool-dropdown-header"
        onClick={() => setIsOpen(!isOpen)}
        style={{ color: statusColor }}
      >
        <span className="tool-dropdown-chevron">
          {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
        {statusIcon}
        <span className="tool-dropdown-label">{statusText}</span>
      </button>
      {isOpen && (
        <div className="tool-dropdown-body">
          {/* Tool call arguments */}
          <div className="tool-dropdown-section">
            <div className="tool-dropdown-section-label">
              <Wrench size={11} /> Arguments
            </div>
            <div className="tool-dropdown-code">
              {toolCall.arguments
                ? (typeof toolCall.arguments === 'string'
                    ? toolCall.arguments
                    : JSON.stringify(toolCall.arguments, null, 2))
                : '(none)'}
            </div>
          </div>
          {/* Tool result */}
          {toolResult && (
            <div className="tool-dropdown-section">
              <div className="tool-dropdown-section-label" style={{ color: hasError ? 'var(--error)' : 'var(--success)' }}>
                <CheckCircle2 size={11} /> Result
              </div>
              <div className="tool-dropdown-code">
                {parsed ? JSON.stringify(parsed, null, 2) : toolResult.result}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ChatMessage({ message, onOpenCanvas }) {
  const isUser = message.role === 'user'

  // Match tool calls with their results
  const toolCalls = message.toolCalls || []
  const toolResults = message.toolResults || []

  // Build paired list of tool calls + results
  const toolPairs = toolCalls.map((tc, i) => {
    const tr = toolResults.find((r) => r.name === tc.name) || toolResults[i]
    return { call: tc, result: tr }
  })

  // Find any plot or SVG results for inline display
  const specialResults = toolResults.filter((tr) => {
    try {
      const p = JSON.parse(tr.result)
      return (p.svg && p.svg.includes('<svg')) || p.plot_image || (p.analysis && tr.name === 'image_analyzer')
    } catch { return false }
  })

  return (
    <div className="message">
      <div className="message-header">
        <div className={`message-avatar ${message.role}`}>
          {isUser ? <User size={14} /> : <Bot size={14} />}
        </div>
        <span className="message-role">
          {isUser ? 'You' : 'Assistant'}
        </span>
      </div>
      <div className="message-body">
        {renderContent(message.content)}

        {/* Collapsible tool reasoning */}
        {toolPairs.length > 0 && (
          <div className="tool-reasoning-group">
            {toolPairs.map((pair, i) => (
              <ToolCallDropdown
                key={i}
                toolCall={pair.call}
                toolResult={pair.result}
              />
            ))}
          </div>
        )}

        {/* Special inline results: SVG diagrams */}
        {specialResults.map((tr, i) => {
          let parsed
          try { parsed = JSON.parse(tr.result) } catch { return null }

          // SVG diagram
          if (parsed.svg && parsed.svg.includes('<svg')) {
            return (
              <div key={`svg-${i}`} className="svg-diagram-card">
                {parsed.title && (
                  <div className="svg-diagram-title">{parsed.title}</div>
                )}
                <div
                  className="svg-diagram-render"
                  dangerouslySetInnerHTML={{ __html: parsed.svg }}
                />
                {parsed.filename && (
                  <div className="svg-diagram-footer">
                    Saved as {parsed.filename}
                  </div>
                )}
              </div>
            )
          }

          // Graph plot — show thumbnail + open in canvas
          if (parsed.plot_image) {
            return (
              <div key={`plot-${i}`} className="plot-result-card">
                <div className="plot-result-header">
                  <BarChart3 size={14} />
                  <span>{parsed.title || 'Generated Plot'}</span>
                </div>
                <div className="plot-result-preview">
                  <img
                    src={`/api/files/plot/${encodeURIComponent(parsed.plot_image)}`}
                    alt={parsed.title || 'Plot'}
                    className="plot-result-img"
                  />
                </div>
                <div className="plot-result-footer">
                  <span className="plot-result-meta">
                    {parsed.chart_type} chart — {parsed.filename}
                  </span>
                  <button
                    className="plot-result-expand"
                    onClick={() => onOpenCanvas && onOpenCanvas({
                      image: parsed.plot_image,
                      title: parsed.title,
                    })}
                    title="Open in canvas panel"
                  >
                    <Eye size={13} />
                    Open
                  </button>
                </div>
              </div>
            )
          }

          // Image analysis result
          if (parsed.analysis && tr.name === 'image_analyzer') {
            return (
              <div key={`img-${i}`} className="image-analysis-card">
                <div className="image-analysis-header">
                  <ImageIcon size={14} />
                  <span>Image Analysis: {parsed.filename}</span>
                </div>
                <div className="image-analysis-body">
                  {renderContent(parsed.analysis)}
                </div>
                {parsed.question && parsed.question !== 'Analyze this image in detail. Describe what you see, any text, objects, patterns, or notable features.' && (
                  <div className="image-analysis-footer">
                    Question: {parsed.question}
                  </div>
                )}
              </div>
            )
          }

          return null
        })}
      </div>
    </div>
  )
}

export function TypingIndicator() {
  return (
    <div className="message">
      <div className="message-header">
        <div className="message-avatar assistant">
          <Bot size={14} />
        </div>
        <span className="message-role">Assistant</span>
      </div>
      <div className="typing-indicator">
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>
    </div>
  )
}
