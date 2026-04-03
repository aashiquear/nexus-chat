import React from 'react'
import { User, Bot, Wrench, CheckCircle2 } from 'lucide-react'

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

export default function ChatMessage({ message }) {
  const isUser = message.role === 'user'

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

        {/* Tool calls */}
        {message.toolCalls?.map((tc, i) => (
          <div key={i} className="tool-card">
            <div className="tool-card-header">
              <Wrench size={13} />
              {tc.name}
            </div>
            {tc.arguments && (
              <div className="tool-card-body">
                {typeof tc.arguments === 'string'
                  ? tc.arguments
                  : JSON.stringify(tc.arguments, null, 2)}
              </div>
            )}
          </div>
        ))}

        {/* Tool results */}
        {message.toolResults?.map((tr, i) => (
          <div key={i} className="tool-card">
            <div className="tool-card-header" style={{ color: 'var(--success)' }}>
              <CheckCircle2 size={13} />
              {tr.name} — result
            </div>
            <div className="tool-card-body">
              {(() => {
                try {
                  const parsed = JSON.parse(tr.result)
                  return JSON.stringify(parsed, null, 2)
                } catch {
                  return tr.result
                }
              })()}
            </div>
          </div>
        ))}
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
