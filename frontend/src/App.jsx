import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Menu, MessageCircle, Wifi, WifiOff } from 'lucide-react'
import Sidebar from './components/Sidebar'
import ChatMessage, { TypingIndicator } from './components/ChatMessage'
import ChatInput from './components/ChatInput'
import { useChat } from './hooks/useChat'
import { fetchModels, fetchTools, fetchFiles, uploadFile, deleteFile, fetchMCPServers, reconnectMCPServer } from './hooks/api'

export default function App() {
  // State
  const [models, setModels] = useState([])
  const [tools, setTools] = useState([])
  const [files, setFiles] = useState([])
  const [mcpServers, setMcpServers] = useState([])
  const [selectedModel, setSelectedModel] = useState('')
  const [selectedTools, setSelectedTools] = useState([])
  const [selectedFiles, setSelectedFiles] = useState([])
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const chatEndRef = useRef(null)
  const streamBufferRef = useRef('')
  const { connect, sendMessage, isConnected, isStreaming } = useChat()

  // Initialize
  useEffect(() => {
    connect()
    loadData()
  }, [connect])

  const loadData = async () => {
    try {
      const [m, t, f, mcp] = await Promise.all([
        fetchModels(), fetchTools(), fetchFiles(), fetchMCPServers(),
      ])
      setModels(m)
      setTools(t)
      setFiles(f)
      setMcpServers(mcp)

      // Default to first available model
      const available = m.find((x) => x.available)
      if (available) setSelectedModel(available.id)
    } catch (err) {
      console.error('Failed to load data:', err)
    }
  }

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  // Toggle helpers
  const toggleTool = (id) => {
    setSelectedTools((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const toggleFile = (name) => {
    setSelectedFiles((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]
    )
  }

  const removeFile = (name) => {
    setSelectedFiles((prev) => prev.filter((x) => x !== name))
  }

  // Upload
  const handleUpload = async (file) => {
    try {
      await uploadFile(file)
      const updatedFiles = await fetchFiles()
      setFiles(updatedFiles)
      // Auto-select newly uploaded file
      if (!selectedFiles.includes(file.name)) {
        setSelectedFiles((prev) => [...prev, file.name])
      }
    } catch (err) {
      alert(`Upload failed: ${err.message}`)
    }
  }

  const handleReconnectMCP = async (serverId) => {
    try {
      await reconnectMCPServer(serverId)
      // Refresh tools and server list
      const [t, mcp] = await Promise.all([fetchTools(), fetchMCPServers()])
      setTools(t)
      setMcpServers(mcp)
    } catch (err) {
      console.error('MCP reconnect failed:', err)
    }
  }

  const handleDeleteFile = async (filename) => {
    try {
      await deleteFile(filename)
      setFiles((prev) => prev.filter((f) => f.name !== filename))
      setSelectedFiles((prev) => prev.filter((n) => n !== filename))
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  // Send message
  const handleSend = useCallback(() => {
    const text = inputValue.trim()
    if (!text || !selectedModel) return

    const userMsg = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInputValue('')
    setIsTyping(true)
    streamBufferRef.current = ''

    // Build message history for the API
    const apiMessages = newMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }))

    // Track tool events for the current response
    const toolCalls = []
    const toolResults = []

    sendMessage(
      {
        messages: apiMessages,
        model: selectedModel,
        tools: selectedTools,
        files: selectedFiles,
      },
      (event) => {
        switch (event.type) {
          case 'text':
            streamBufferRef.current += event.content
            setMessages((prev) => {
              const updated = [...prev]
              const lastIdx = updated.length - 1
              if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
                updated[lastIdx] = {
                  ...updated[lastIdx],
                  content: streamBufferRef.current,
                  toolCalls: [...toolCalls],
                  toolResults: [...toolResults],
                }
              } else {
                updated.push({
                  role: 'assistant',
                  content: streamBufferRef.current,
                  toolCalls: [...toolCalls],
                  toolResults: [...toolResults],
                })
              }
              return updated
            })
            setIsTyping(false)
            break

          case 'tool_call':
            toolCalls.push({
              name: event.name,
              arguments: event.arguments,
            })
            // Update the assistant message in-place
            setMessages((prev) => {
              const updated = [...prev]
              const lastIdx = updated.length - 1
              if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
                updated[lastIdx] = {
                  ...updated[lastIdx],
                  toolCalls: [...toolCalls],
                }
              } else {
                updated.push({
                  role: 'assistant',
                  content: '',
                  toolCalls: [...toolCalls],
                  toolResults: [],
                })
              }
              return updated
            })
            break

          case 'tool_result':
            toolResults.push({
              name: event.name,
              result: event.result,
            })
            setMessages((prev) => {
              const updated = [...prev]
              const lastIdx = updated.length - 1
              if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
                updated[lastIdx] = {
                  ...updated[lastIdx],
                  toolResults: [...toolResults],
                }
              }
              return updated
            })
            // Reset buffer for the follow-up response after tool use
            streamBufferRef.current = ''
            break

          case 'done':
            setIsTyping(false)
            break

          case 'error':
            setIsTyping(false)
            setMessages((prev) => [
              ...prev,
              {
                role: 'assistant',
                content: `⚠️ ${event.content}`,
              },
            ])
            break
        }
      }
    )
  }, [inputValue, messages, selectedModel, selectedTools, selectedFiles, sendMessage])

  // New chat
  const handleNewChat = () => {
    setMessages([])
    setInputValue('')
    setSidebarOpen(false)
  }

  return (
    <div className="app-layout">
      <Sidebar
        models={models}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        tools={tools}
        selectedTools={selectedTools}
        onToggleTool={toggleTool}
        mcpServers={mcpServers}
        onReconnectMCP={handleReconnectMCP}
        files={files}
        selectedFiles={selectedFiles}
        onToggleFile={toggleFile}
        onUpload={handleUpload}
        onDeleteFile={handleDeleteFile}
        onNewChat={handleNewChat}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="main-content">
        {/* Header */}
        <div className="header">
          <div className="header-left">
            <button
              className="sidebar-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu size={20} />
            </button>
            <span className="header-title">Conversation</span>
            {selectedModel && (
              <span className="header-model-badge">{selectedModel}</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: isConnected ? 'var(--success)' : 'var(--error)', fontSize: 12 }}>
            {isConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>

        {/* Chat Area */}
        <div className="chat-area">
          <div className="chat-container">
            {messages.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <MessageCircle size={24} />
                </div>
                <div className="empty-state-title">Start a conversation</div>
                <div className="empty-state-hint">
                  Select a model and tools from the sidebar, then type your message below.
                  Upload files for RAG-enhanced responses.
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, i) => (
                  <ChatMessage key={i} message={msg} />
                ))}
                {isTyping && <TypingIndicator />}
              </>
            )}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Input */}
        <ChatInput
          value={inputValue}
          onChange={setInputValue}
          onSend={handleSend}
          onUpload={handleUpload}
          disabled={isStreaming || !isConnected}
          selectedFiles={selectedFiles}
          onRemoveFile={removeFile}
        />
      </div>
    </div>
  )
}
