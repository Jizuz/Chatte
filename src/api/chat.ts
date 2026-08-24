import { api } from '../config'

function extractReply(payload: unknown, fallback: string): string {
  if (typeof payload === 'string') {
    const trimmed = payload.trim()
    if (!trimmed) return fallback
    try {
      return extractReply(JSON.parse(trimmed), trimmed)
    } catch {
      return trimmed
    }
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    for (const key of ['reply', 'message', 'content', 'answer', 'chats', 'data', 'result']) {
      const value = record[key]
      if (typeof value === 'string' && value.trim()) return value.trim()
    }
    return JSON.stringify(payload)
  }

  return fallback
}

export async function fetchChatReply(question: string): Promise<string> {
  const url = new URL(api.chat.agent)
  url.searchParams.set('question', question)

  const response = await fetch(url.toString(), {
    method: 'GET',
  })

  if (!response.ok) {
    throw new Error(`聊天接口请求失败（${response.status}）`)
  }

  const raw = await response.text()
  return extractReply(raw, '（空回复）')
}