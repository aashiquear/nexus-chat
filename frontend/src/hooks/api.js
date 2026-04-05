const BASE = ''

export async function fetchModels() {
  const res = await fetch(`${BASE}/api/models`)
  const data = await res.json()
  return data.models || []
}

export async function fetchTools() {
  const res = await fetch(`${BASE}/api/tools`)
  const data = await res.json()
  return data.tools || []
}

export async function fetchFiles() {
  const res = await fetch(`${BASE}/api/files`)
  const data = await res.json()
  return data.files || []
}

export async function uploadFile(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/api/upload`, { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || 'Upload failed')
  }
  return res.json()
}

export async function deleteFile(filename) {
  const res = await fetch(`${BASE}/api/files/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
  })
  return res.json()
}

export async function fetchMCPServers() {
  const res = await fetch(`${BASE}/api/mcp/servers`)
  const data = await res.json()
  return data.servers || []
}

export async function reconnectMCPServer(serverId) {
  const res = await fetch(`${BASE}/api/mcp/servers/${encodeURIComponent(serverId)}/reconnect`, {
    method: 'POST',
  })
  return res.json()
}

// ---- Conversations ----

export async function fetchConversations() {
  const res = await fetch(`${BASE}/api/conversations`)
  const data = await res.json()
  return data.conversations || []
}

export async function fetchConversation(id) {
  const res = await fetch(`${BASE}/api/conversations/${encodeURIComponent(id)}`)
  if (!res.ok) return null
  return res.json()
}

export async function saveConversation({ id, messages, model }) {
  const res = await fetch(`${BASE}/api/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, messages, model }),
  })
  return res.json()
}

export async function deleteConversation(id) {
  const res = await fetch(`${BASE}/api/conversations/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  return res.json()
}
