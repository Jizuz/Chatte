import { api } from '../config'

export interface ChatReply {
  reply: string
  need_emergency: boolean
  active_agent: string | null
}

/** SSE 流式回调 */
export interface StreamChatCallbacks {
  /** 收到一段增量文本时触发 */
  onDelta?: (delta: string) => void
  /** 收到附加信息（紧急介入 / 生效智能体）时触发 */
  onMeta?: (meta: { need_emergency: boolean; active_agent: string | null }) => void
  /** 取消信号（如用户退出登录时中断流） */
  signal?: AbortSignal
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

/** 将一次性响应文本解析为 ChatReply（兼容 JSON / 纯文本 / 双重 JSON） */
function parseChatReplyText(raw: string): ChatReply {
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

/** 非流式版本：等待完整响应后一次性返回 */
export async function fetchChatReply(
  question: string,
  sessionId: string | null,
  userId: string,
): Promise<ChatReply> {
  const url = new URL(api.chat.agent)
  url.searchParams.set('question', question)
  // 后端 FastAPI 定义的查询参数名为 snake_case 的 session_id（必填）
  url.searchParams.set('session_id', sessionId == null ? '' : sessionId)
  url.searchParams.set('user_id', userId)

  const response = await fetch(url.toString(), {
    method: 'GET',
  })

  if (!response.ok) {
    throw new Error(`聊天接口请求失败（${response.status}）`)
  }

  return parseChatReplyText(await response.text())
}

/* ------------------------- SSE 流式实现 ------------------------- */

/** 结束标记 */
function isDoneMarker(data: string): boolean {
  const normalized = data.trim().replace(/^"+|"+$/g, '')
  return normalized === '[DONE]' || normalized === 'DONE'
}

/**
 * 从单条 SSE data 中提取增量文本与附加信息，兼容两种常见格式：
 * - OpenAI 风格：{"choices":[{"delta":{"content":"你"}}]}
 * - 自定义风格：{"content":"你","need_emergency":false,"active_agent":null}
 */
function extractSSEPayload(
  data: string,
): {
  delta: string
  meta?: { need_emergency: boolean; active_agent: string | null }
} {
  let parsed: unknown
  try {
    parsed = JSON.parse(data)
  } catch {
    // 非 JSON：按纯文本增量处理
    return { delta: data }
  }

  if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>
    let delta = ''

    // OpenAI 风格
    const choices = record.choices
    if (Array.isArray(choices) && choices.length > 0) {
      const choice = choices[0]
      if (choice && typeof choice === 'object') {
        const choiceRecord = choice as Record<string, unknown>
        const deltaField = choiceRecord.delta
        if (deltaField && typeof deltaField === 'object') {
          const content = (deltaField as Record<string, unknown>).content
          if (typeof content === 'string') delta = content
        }
        const messageField = choiceRecord.message
        if (!delta && messageField && typeof messageField === 'object') {
          const content = (messageField as Record<string, unknown>).content
          if (typeof content === 'string') delta = content
        }
      }
    }

    // 自定义风格
    if (!delta) {
      for (const key of ['content', 'delta', 'text', 'token', 'reply', 'message', 'answer']) {
        const value = record[key]
        if (typeof value === 'string' && value) {
          delta = value
          break
        }
      }
    }

    // 附加信息（可能单独成帧，也可能与文本同帧）
    let meta: { need_emergency: boolean; active_agent: string | null } | undefined
    if ('need_emergency' in record || 'active_agent' in record) {
      const needEmergency = record.need_emergency
      const activeAgent = record.active_agent
      meta = {
        need_emergency: typeof needEmergency === 'boolean' ? needEmergency : Boolean(needEmergency),
        active_agent: typeof activeAgent === 'string' ? activeAgent : null,
      }
    }

    return { delta, meta }
  }

  if (typeof parsed === 'string') return { delta: parsed }
  return { delta: '' }
}

/** 消费 text/event-stream 响应体，逐事件回调 data 内容 */
async function consumeSSEStream(
  body: ReadableStream<Uint8Array>,
  onData: (data: string) => void,
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  /** 发出一个完整事件（取多行中 data: 前缀行拼接） */
  const emitEvent = (raw: string) => {
    const data = raw
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice('data:'.length).replace(/^ /, ''))
      .join('\n')
    if (data) onData(data)
  }

  /** 按空行（\n\n）切分出完整事件，剩余不完整部分留在 buffer */
  const drainBuffer = (final: boolean) => {
    // 归一化换行符（SSE 允许 \r\n / \r / \n），\r 被分块截断也能正确拼接
    buffer = buffer.replace(/\r\n?/g, '\n')
    let sep = buffer.indexOf('\n\n')
    while (sep !== -1) {
      emitEvent(buffer.slice(0, sep))
      buffer = buffer.slice(sep + 2)
      sep = buffer.indexOf('\n\n')
    }
    // 流结束时若还剩一段没有结尾空行的事件，也视为完整事件
    if (final && buffer.trim()) {
      emitEvent(buffer)
      buffer = ''
    }
  }

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      drainBuffer(false)
    }
    buffer += decoder.decode()
    drainBuffer(true)
  } finally {
    reader.releaseLock()
  }
}

/**
 * 流式版本：以 SSE 方式请求 /chat/agent，逐段回调增量文本，
 * 最终返回完整结果（与 fetchChatReply 返回结构一致）。
 * 若后端尚未升级、仍返回普通 JSON，则自动回退为一次性解析。
 */
export async function streamChatReply(
  question: string,
  sessionId: string | null,
  userId: string,
  callbacks: StreamChatCallbacks = {},
): Promise<ChatReply> {
  const url = new URL(api.chat.agent)
  url.searchParams.set('question', question)
  // 后端 FastAPI 定义的查询参数名为 snake_case 的 session_id（必填）
  url.searchParams.set('session_id', sessionId == null ? '' : sessionId)
  url.searchParams.set('user_id', userId)

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: { Accept: 'text/event-stream' },
    signal: callbacks.signal,
  })

  if (!response.ok) {
    throw new Error(`聊天接口请求失败（${response.status}）`)
  }

  const contentType = response.headers.get('content-type') ?? ''

  // 后端未以 SSE 返回（或浏览器不支持流式读取）时，回退整体解析
  if (!contentType.includes('text/event-stream') || !response.body) {
    const result = parseChatReplyText(await response.text())
    callbacks.onDelta?.(result.reply)
    if (result.need_emergency || result.active_agent) {
      callbacks.onMeta?.({ need_emergency: result.need_emergency, active_agent: result.active_agent })
    }
    return result
  }

  let reply = ''
  let needEmergency = false
  let activeAgent: string | null = null

  await consumeSSEStream(response.body, (data) => {
    if (isDoneMarker(data)) return
    const { delta, meta } = extractSSEPayload(data)
    if (meta) {
      needEmergency = needEmergency || meta.need_emergency
      activeAgent = activeAgent ?? meta.active_agent
      callbacks.onMeta?.({ need_emergency: needEmergency, active_agent: activeAgent })
    }
    if (delta) {
      reply += delta
      callbacks.onDelta?.(delta)
    }
  })

  return {
    reply: reply || '（空回复）',
    need_emergency: needEmergency,
    active_agent: activeAgent,
  }
}