import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Menu, MessageCircle, Wifi, WifiOff } from 'lucide-react'
import Sidebar from './components/Sidebar'
import ChatMessage, { TypingIndicator } from './components/ChatMessage'
import ChatInput from './components/ChatInput'
import CanvasPanel from './components/CanvasPanel'
import { useChat } from './hooks/useChat'
import {
  fetchModels, fetchTools, fetchFiles, uploadFile, deleteFile,
  fetchMCPServers, reconnectMCPServer,
  fetchConversations, fetchConversation, saveConversation, deleteConversation,
} from './hooks/api'

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

  // Conversation state
  const [conversations, setConversations] = useState([])
  const [activeConversationId, setActiveConversationId] = useState(null)

  // Canvas panel state (right-side panel for graphs)
  const [canvasData, setCanvasData] = useState(null)

  const chatEndRef = useRef(null)
  const chatAreaRef = useRef(null)
  const streamBufferRef = useRef('')
  const userScrolledRef = useRef(false)
  const { connect, sendMessage, isConnected, isStreaming } = useChat()

  // Initialize
  useEffect(() => {
    connect()
    loadData()
  }, [connect])

  const loadData = async () => {
    try {
      const [m, t, f, mcp, convos] = await Promise.all([
        fetchModels(), fetchTools(), fetchFiles(), fetchMCPServers(),
        fetchConversations(),
      ])
      setModels(m)
      setTools(t)
      setFiles(f)
      setMcpServers(mcp)
      setConversations(convos)

      // Default to first available model
      const available = m.find((x) => x.available)
      if (available) setSelectedModel(available.id)
    } catch (err) {
      console.error('Failed to load data:', err)
    }
  }

  // Smart auto-scroll: only auto-scroll if user is near the bottom
  const handleScroll = useCallback(() => {
    const el = chatAreaRef.current
    if (!el) return
    const threshold = 100
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold
    userScrolledRef.current = !atBottom
  }, [])

  useEffect(() => {
    const el = chatAreaRef.current
    if (!el) return
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  // Auto-scroll when new content arrives (only if user hasn't scrolled up)
  useEffect(() => {
    if (!userScrolledRef.current) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
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

  // ---- Conversation persistence ----

  const persistConversation = useCallback(async (msgs, convId) => {
    if (!msgs || msgs.length === 0) return null
    try {
      const result = await saveConversation({
        id: convId || undefined,
        messages: msgs,
        model: selectedModel,
      })
      // Refresh the sidebar list
      const convos = await fetchConversations()
      setConversations(convos)
      return result.id
    } catch (err) {
      console.error('Save conversation failed:', err)
      return convId
    }
  }, [selectedModel])

  const handleSelectConversation = async (id) => {
    try {
      const data = await fetchConversation(id)
      if (data) {
        setMessages(data.messages || [])
        setActiveConversationId(data.id)
        if (data.model) setSelectedModel(data.model)
        setSidebarOpen(false)
      }
    } catch (err) {
      console.error('Failed to load conversation:', err)
    }
  }

  const handleDeleteConversation = async (id) => {
    try {
      await deleteConversation(id)
      setConversations((prev) => prev.filter((c) => c.id !== id))
      if (activeConversationId === id) {
        setMessages([])
        setActiveConversationId(null)
      }
    } catch (err) {
      console.error('Delete conversation failed:', err)
    }
  }

  // Open canvas panel for a graph
  const handleOpenCanvas = useCallback((data) => {
    setCanvasData(data)
  }, [])

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
    userScrolledRef.current = false  // Reset scroll on new message

    // Build message history for the API
    const apiMessages = newMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }))

    // Track tool events for the current response
    const toolCalls = []
    const toolResults = []

    // Save reference to current conversation id
    let currentConvId = activeConversationId

    sendMessage(
      {
        messages: apiMessages,
        model: selectedModel,
        tools: selectedTools,
        files: selectedFiles,
      },
      async (event) => {
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
            streamBufferRef.current = ''

            // Auto-open canvas panel for graph plots
            try {
              const parsed = JSON.parse(event.result)
              if (parsed && parsed.plot_image) {
                setCanvasData({
                  image: parsed.plot_image,
                  title: parsed.title || 'Generated Plot',
                })
              }
            } catch (_e) { /* not JSON */ }
            break

          case 'done':
            setIsTyping(false)
            // Auto-save conversation when response is complete
            setMessages((prev) => {
              // Use a timeout to ensure state is settled
              setTimeout(async () => {
                const savedId = await persistConversation(prev, currentConvId)
                if (savedId && !currentConvId) {
                  setActiveConversationId(savedId)
                  currentConvId = savedId
                }
              }, 100)
              return prev
            })
            break

          case 'error':
            setIsTyping(false)
            setMessages((prev) => [
              ...prev,
              {
                role: 'assistant',
                content: `\u26a0\ufe0f ${event.content}`,
              },
            ])
            break
        }
      }
    )
  }, [inputValue, messages, selectedModel, selectedTools, selectedFiles, sendMessage, activeConversationId, persistConversation])

  // New chat
  const handleNewChat = () => {
    setMessages([])
    setActiveConversationId(null)
    setInputValue('')
    setSidebarOpen(false)
    setCanvasData(null)
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
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
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
        <div className="chat-area" ref={chatAreaRef}>
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
                  <ChatMessage
                    key={i}
                    message={msg}
                    onOpenCanvas={handleOpenCanvas}
                  />
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

      {/* Right-side Canvas Panel for graphs */}
      {canvasData && (
        <CanvasPanel
          image={canvasData.image}
          title={canvasData.title}
          onClose={() => setCanvasData(null)}
        />
      )}
    </div>
  )
}
