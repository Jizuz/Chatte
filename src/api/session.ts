import { api, app } from '../config'
import type { Session, SessionListData, SessionHistoryData } from '../types'

interface ApiResponse<T> {
  code: number
  msg: string
  data: T
}

export interface FetchSessionListParams {
  userId: string
  page?: number
  pageSize?: number
}

function normalizeSession(record: Record<string, unknown>): Session {
  const sessionId = String(record.sessionId ?? record.session_id ?? '')
  return {
    sessionId,
    status: String(record.status ?? ''),
    createTime: String(record.createTime ?? record.create_time ?? ''),
    lastActiveTime: String(
      record.lastActiveTime ?? record.last_active_time ?? '',
    ),
    closeTime:
      record.closeTime != null || record.close_time != null
        ? String(record.closeTime ?? record.close_time)
        : null,
    abstract: String(record.abstract ?? ''),
  }
}

export async function fetchSessionList(
  params: FetchSessionListParams,
): Promise<SessionListData> {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? app.sessionListPageSize

  const url = new URL(api.chat.sessionList)
  url.searchParams.set('user_id', params.userId)
  url.searchParams.set('page', String(page))
  url.searchParams.set('pageSize', String(pageSize))

  const response = await fetch(url.toString(), { method: 'GET' })

  if (!response.ok) {
    throw new Error(`会话列表请求失败（${response.status}）`)
  }

  const payload = (await response.json()) as ApiResponse<SessionListData>
  if (payload.code !== 0) {
    throw new Error(payload.msg || '会话列表请求失败')
  }

  const data = payload.data
  const records = Array.isArray(data?.records)
    ? data.records.map((item) =>
        normalizeSession(item as unknown as Record<string, unknown>),
      )
    : []

  return {
    total: Number(data?.total ?? records.length),
    page: Number(data?.page ?? page),
    pageSize: Number(data?.pageSize ?? pageSize),
    records,
  }
}

export interface CloseSessionParams {
  userId: string
  sessionId: string
}

/** POST /chat/session/close */
export async function closeSession(params: CloseSessionParams): Promise<void> {
  const response = await fetch(api.chat.sessionClose, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({
      user_id: params.userId,
      session_id: params.sessionId,
    }),
  })

  if (!response.ok) {
    throw new Error(`关闭会话失败（${response.status}）`)
  }

  const payload = (await response.json()) as ApiResponse<unknown>
  if (payload.code !== 0) {
    throw new Error(payload.msg || '关闭会话失败')
  }
}

export interface FetchSessionHistoryParams {
  userId: string
  sessionId: string
}

/** GET /chat/session/history */
export async function fetchSessionHistory(
  params: FetchSessionHistoryParams,
): Promise<SessionHistoryData> {
  const url = new URL(api.chat.sessionHistory)
  url.searchParams.set('user_id', params.userId)
  url.searchParams.set('session_id', params.sessionId)

  const response = await fetch(url.toString(), { method: 'GET' })

  if (!response.ok) {
    throw new Error(`会话历史请求失败（${response.status}）`)
  }

  const payload = (await response.json()) as ApiResponse<SessionHistoryData>
  if (payload.code !== 0) {
    throw new Error(payload.msg || '会话历史请求失败')
  }

  return payload.data
}
