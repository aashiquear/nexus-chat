import React, { useState, useCallback } from 'react'
import {
  User, Bot, Wrench, CheckCircle2, ChevronDown, ChevronRight,
  BarChart3, Image as ImageIcon, Eye, Copy, Check as CheckIcon,
} from 'lucide-react'

// Copy-to-clipboard code block wrapper
function CodeBlock({ code, lang }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [code])

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        {lang && <span className="code-block-lang">{lang}</span>}
        <button
          className={`code-block-copy ${copied ? 'copied' : ''}`}
          onClick={handleCopy}
          title="Copy code"
        >
          {copied ? <CheckIcon size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="code-block-pre">
        <code>{code}</code>
      </pre>
    </div>
  )
}

// Parse markdown table lines into a structured table
function parseMarkdownTable(lines) {
  if (lines.length < 2) return null

  const parseRow = (line) =>
    line.split('|').map((c) => c.trim()).filter((c, i, arr) =>
      // filter out leading/trailing empty cells from || borders
      !(c === '' && (i === 0 || i === arr.length - 1))
    )

  const headers = parseRow(lines[0])
  // Check separator row (e.g. |---|---|)
  const sep = lines[1]
  if (!/^[\s|:-]+$/.test(sep)) return null

  const rows = lines.slice(2).map(parseRow)

  return { headers, rows }
}

// Markdown-like renderer with tables & rich code blocks
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
      return <CodeBlock key={i} code={code} lang={lang} />
    }

    // Regular text: handle tables, inline code, bold, links
    const textLines = part.split('\n')
    const elements = []
    let idx = 0

    while (idx < textLines.length) {
      // Detect markdown table: line starts with | and next line is separator
      if (
        textLines[idx].trim().startsWith('|') &&
        idx + 1 < textLines.length &&
        /^[\s|:-]+$/.test(textLines[idx + 1])
      ) {
        // Collect all contiguous table lines
        const tableLines = []
        while (idx < textLines.length && textLines[idx].trim().startsWith('|')) {
          tableLines.push(textLines[idx])
          idx++
        }
        const table = parseMarkdownTable(tableLines)
        if (table) {
          elements.push(
            <div key={`${i}-table-${idx}`} className="md-table-wrapper">
              <table className="md-table">
                <thead>
                  <tr>
                    {table.headers.map((h, hi) => (
                      <th key={hi}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row, ri) => (
                    <tr key={ri}>
                      {row.map((cell, ci) => (
                        <td key={ci}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
          continue
        }
      }

      const line = textLines[idx]
      idx++

      if (!line.trim()) {
        elements.push(<br key={`${i}-${idx}`} />)
        continue
      }

      // Process inline formatting
      let processed = line
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')

      elements.push(
        <p
          key={`${i}-${idx}`}
          dangerouslySetInnerHTML={{ __html: processed }}
        />
      )
    }

    return elements
  })
}

function ToolCallDropdown({ toolCall, toolResult }) {
  const [isOpen, setIsOpen] = useState(false)

  // Parse result to check for special types
  let parsed = null
  if (toolResult) {
    try { parsed = JSON.parse(toolResult.result) } catch (_e) { /* not JSON */ }
  }

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
      return (p && p.svg && p.svg.includes('<svg')) || (p && p.plot_image) || (p && p.analysis && tr.name === 'image_analyzer')
    } catch (_e) { return false }
  })

  return (
    <div className={`message ${isUser ? 'message-user' : ''}`}>
      <div className="message-header">
        <div className={`message-avatar ${message.role}`}>
          {isUser ? <User size={14} /> : <Bot size={14} />}
        </div>
        <span className="message-role">
          {isUser ? 'You' : 'Assistant'}
        </span>
      </div>
      <div className="message-body">
        {isUser ? <p>{message.content}</p> : renderContent(message.content)}

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
          try { parsed = JSON.parse(tr.result) } catch (_e) { return null }

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
                    src={`/api/plots/${encodeURIComponent(parsed.plot_image)}`}
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
