import { api } from '../config'

export interface ChatReply {
  reply: string
  need_emergency: boolean
  active_agent: string | null
}

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

export async function fetchChatReply(question: string, sessionId: string | null): Promise<ChatReply> {
  const url = new URL(api.chat.agent)
  url.searchParams.set('question', question)
  // 后端 FastAPI 定义的查询参数名为 snake_case 的 session_id（必填）
  url.searchParams.set('session_id', sessionId == null ? '' : sessionId)

  const response = await fetch(url.toString(), {
    method: 'GET',
  })

  if (!response.ok) {
    throw new Error(`聊天接口请求失败（${response.status}）`)
  }

  const raw = await response.text()

  let parsed: unknown = raw
  try {
    parsed = JSON.parse(raw)
  } catch {
    parsed = raw
  }

  if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>
    const needEmergency = record.need_emergency
    const activeAgent = record.active_agent
    return {
      reply: extractReply(parsed, '（空回复）'),
      need_emergency: typeof needEmergency === 'boolean' ? needEmergency : Boolean(needEmergency),
      active_agent: typeof activeAgent === 'string' ? activeAgent : null,
    }
  }

  return {
    reply: extractReply(raw, '（空回复）'),
    need_emergency: false,
    active_agent: null,
  }
}