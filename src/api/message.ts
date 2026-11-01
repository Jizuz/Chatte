import { api } from '../config'
import { authFetch } from './http'

interface ApiResponse<T = unknown> {
  code: number
  msg: string
  data: T
}

export type MessageSaveType = 0 | 1

export interface SaveMessageParams {
  sessionId: string | null
  type: MessageSaveType
  content: string
}

/** POST /chat/message/save（身份取自令牌） */
export async function saveChatMessage(params: SaveMessageParams): Promise<{ session_id: string }> {
  const response = await authFetch(api.chat.messageSave, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({
      session_id: params.sessionId,
      type: params.type,
      content: params.content,
    }),
  })

  if (!response.ok) {
    throw new Error(`消息保存失败（${response.status}）`)
  }

  const payload = (await response.json()) as ApiResponse<{ session_id: string }>
  if (payload.code !== 0) {
    throw new Error(payload.msg || '消息保存失败')
  }

  return payload.data
}
