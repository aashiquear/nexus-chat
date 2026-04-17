import React, { useState, useCallback } from 'react'
import {
  User, Bot, Wrench, CheckCircle2, ChevronDown, ChevronRight,
  BarChart3, Image as ImageIcon, Eye, Copy, Check as CheckIcon,
} from 'lucide-react'
import createPlotlyComponent from 'react-plotly.js/factory'
import Plotly from 'plotly.js-dist-min'

const Plot = createPlotlyComponent(Plotly)

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

// Apply inline markdown formatting: bold, italic, inline code, links, strikethrough, images
function formatInline(text) {
  return text
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="md-inline-img" />')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
}

// Render rich cell content: inline formatting + list support
function renderCellContent(cellText) {
  if (!cellText) return null

  // Handle HTML lists: <ul><li>...</li></ul> or <ol><li>...</li></ol>
  if (/<[uo]l>/i.test(cellText)) {
    const html = formatInline(cellText)
    return <span dangerouslySetInnerHTML={{ __html: html }} />
  }

  // Split on <br>, \n, or before • bullets glued together
  // Also split glued numbered lists: "1. text2. text" → separate lines
  const lines = cellText
    .replace(/([^•\n])•/g, '$1\n•')
    .replace(/(\S)(\d+\.\s)/g, '$1\n$2')
    .split(/<br\s*\/?>|\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  return renderLinesList(lines)
}

// Match unordered list markers: - or • followed by space, but NOT * (conflicts with bold **)
const BULLET_RE = /^[-•]\s+(.+)$/
// Match ordered list: "1. text", "2. text"
const ORDERED_RE = /^\d+\.\s+(.+)$/

// Shared helper: convert an array of text lines into React elements,
// recognizing list markers and applying inline formatting.
function renderLinesList(lines, keyPrefix = '') {
  const parts = []
  let bulletItems = []
  let orderedItems = []

  const flushBullets = () => {
    if (bulletItems.length === 0) return
    parts.push(
      <ul key={`${keyPrefix}ul-${parts.length}`} className="cell-list">
        {bulletItems.splice(0).map((item, j) => (
          <li key={j} dangerouslySetInnerHTML={{ __html: formatInline(item) }} />
        ))}
      </ul>
    )
  }

  const flushOrdered = () => {
    if (orderedItems.length === 0) return
    parts.push(
      <ol key={`${keyPrefix}ol-${parts.length}`} className="cell-list">
        {orderedItems.splice(0).map((item, j) => (
          <li key={j} dangerouslySetInnerHTML={{ __html: formatInline(item) }} />
        ))}
      </ol>
    )
  }

  for (const line of lines) {
    const bulletMatch = line.match(BULLET_RE)
    const orderedMatch = line.match(ORDERED_RE)
    if (bulletMatch) {
      flushOrdered()
      bulletItems.push(bulletMatch[1])
    } else if (orderedMatch) {
      flushBullets()
      orderedItems.push(orderedMatch[1])
    } else {
      flushBullets()
      flushOrdered()
      parts.push(
        <span key={`${keyPrefix}t-${parts.length}`} dangerouslySetInnerHTML={{ __html: formatInline(line) }} />
      )
    }
  }
  flushBullets()
  flushOrdered()

  if (parts.length === 0) {
    return <span dangerouslySetInnerHTML={{ __html: formatInline(lines.join(' ')) }} />
  }
  if (parts.length === 1) return parts[0]
  return <>{parts}</>
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
                      <th key={hi}>{renderCellContent(h)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row, ri) => (
                    <tr key={ri}>
                      {row.map((cell, ci) => (
                        <td key={ci}>{renderCellContent(cell)}</td>
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

      // Headings: # to ######
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
      if (headingMatch) {
        const level = headingMatch[1].length
        const Tag = `h${level}`
        elements.push(
          <Tag
            key={`${i}-${idx}`}
            className={`md-heading md-h${level}`}
            dangerouslySetInnerHTML={{ __html: formatInline(headingMatch[2]) }}
          />
        )
        continue
      }

      // Horizontal rule: ---, ***, ___
      if (/^[-*_]{3,}\s*$/.test(line.trim())) {
        elements.push(<hr key={`${i}-${idx}`} className="md-hr" />)
        continue
      }

      // Blockquote: > text (collect consecutive > lines)
      if (/^>\s?/.test(line.trim())) {
        const quoteLines = [line.replace(/^>\s?/, '')]
        while (idx < textLines.length && /^>\s?/.test(textLines[idx].trim())) {
          quoteLines.push(textLines[idx].replace(/^>\s?/, ''))
          idx++
        }
        elements.push(
          <blockquote
            key={`${i}-${idx}-bq`}
            className="md-blockquote"
            dangerouslySetInnerHTML={{ __html: quoteLines.map(formatInline).join('<br/>') }}
          />
        )
        continue
      }

      // Detect bullet lines: • or - at start (not * which conflicts with bold)
      // Also detect • glued mid-line, or numbered lists glued together
      if (/•/.test(line) || /^[-•]\s+/.test(line.trim()) || /^\d+\.\s+/.test(line.trim())) {
        // Split glued • bullets and glued numbered items into separate lines
        const splitLines = line
          .replace(/([^•\n])•/g, '$1\n•')
          .replace(/(\S)(\d+\.\s)/g, '$1\n$2')
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)

        // For single-line items (not glued), also collect consecutive list lines
        if (splitLines.length === 1) {
          const isBullet = BULLET_RE.test(splitLines[0])
          const isOrdered = ORDERED_RE.test(splitLines[0])
          if (isBullet || isOrdered) {
            const re = isBullet ? BULLET_RE : ORDERED_RE
            const collected = [splitLines[0]]
            while (idx < textLines.length && re.test(textLines[idx].trim())) {
              collected.push(textLines[idx].trim())
              idx++
            }
            const Tag = isBullet ? 'ul' : 'ol'
            elements.push(
              <Tag key={`${i}-${idx}-clist`} className="md-list">
                {collected.map((item, j) => {
                  const content = item.replace(isBullet ? /^[-•]\s+/ : /^\d+\.\s+/, '')
                  return (
                    <li key={j} dangerouslySetInnerHTML={{ __html: formatInline(content) }} />
                  )
                })}
              </Tag>
            )
            continue
          }
        }

        // Check if they're bullet items (- or •, NOT *)
        const allBullets = splitLines.length > 1 && splitLines.every((l) => BULLET_RE.test(l))
        if (allBullets) {
          elements.push(
            <ul key={`${i}-${idx}-list`} className="md-list">
              {splitLines.map((item, j) => {
                const content = item.replace(/^[-•]\s+/, '')
                return (
                  <li key={j} dangerouslySetInnerHTML={{ __html: formatInline(content) }} />
                )
              })}
            </ul>
          )
          continue
        }

        // Check if they're numbered list items
        const allOrdered = splitLines.length > 1 && splitLines.every((l) => ORDERED_RE.test(l))
        if (allOrdered) {
          elements.push(
            <ol key={`${i}-${idx}-olist`} className="md-list">
              {splitLines.map((item, j) => {
                const content = item.replace(/^\d+\.\s+/, '')
                return (
                  <li key={j} dangerouslySetInnerHTML={{ __html: formatInline(content) }} />
                )
              })}
            </ol>
          )
          continue
        }
      }

      elements.push(
        <p
          key={`${i}-${idx}`}
          dangerouslySetInnerHTML={{ __html: formatInline(line) }}
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
      return (p && p.svg && p.svg.includes('<svg')) || (p && p.plot_image) || (p && p.figure_json) || (p && p.analysis && tr.name === 'image_analyzer')
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

          // Plotly JSON — render interactive chart inline
          if (parsed.figure_json) {
            let figData = null
            let figureJsonError = null

            if (typeof parsed.figure_json === 'string') {
              try {
                figData = JSON.parse(parsed.figure_json)
              } catch (_e) {
                figureJsonError = 'Invalid plot JSON'
              }
            } else if (typeof parsed.figure_json === 'object' && parsed.figure_json !== null) {
              figData = parsed.figure_json
            } else {
              figureJsonError = 'Unsupported plot JSON format'
            }

            if (!figData || typeof figData !== 'object') {
              return (
                <div key={`plotly-${i}`} className="plot-result-card plotly-result-card">
                  <div className="plot-result-header">
                    <BarChart3 size={14} />
                    <span>{parsed.title || 'Interactive Plot'}</span>
                  </div>
                  <div className="plot-result-footer">
                    <span className="plot-result-meta">
                      {figureJsonError || 'Unable to render interactive plot'}
                    </span>
                  </div>
                  <pre className="message-pre">
                    {typeof parsed.figure_json === 'string'
                      ? parsed.figure_json
                      : JSON.stringify(parsed.figure_json, null, 2)}
                  </pre>
                </div>
              )
            }
            const layout = {
              ...(figData.layout || {}),
              autosize: true,
              margin: { l: 50, r: 30, t: 40, b: 40 },
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent',
              font: { color: '#c9d1d9' },
            }
            return (
              <div key={`plotly-${i}`} className="plot-result-card plotly-result-card">
                <div className="plot-result-header">
                  <BarChart3 size={14} />
                  <span>{parsed.title || figData.layout?.title?.text || 'Interactive Plot'}</span>
                </div>
                <div className="plotly-chart-container">
                  <Plot
                    data={figData.data || []}
                    layout={layout}
                    config={{ responsive: true, displayModeBar: false }}
                    useResizeHandler
                    style={{ width: '100%', height: '350px' }}
                  />
                </div>
                <div className="plot-result-footer">
                  <span className="plot-result-meta">
                    Interactive Plotly chart
                  </span>
                  <button
                    className="plot-result-expand"
                    onClick={() => onOpenCanvas && onOpenCanvas({
                      figureJson: figData,
                      title: parsed.title || figData.layout?.title?.text || 'Interactive Plot',
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
