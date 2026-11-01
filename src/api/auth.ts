/**
 * 鉴权接口层（T11）：login / refresh / logout / quota。
 *
 * 统一响应结构 {@code {code, msg, data, trace_id}}；业务码非 0 抛错。
 */

import { api } from '../config'
import type { User } from '../types'
import { authFetch, httpDeps } from './http'
import { getAccessToken, saveRefreshToken, setAccessToken } from './tokenStore'

export interface AuthUser extends Pick<User, 'name' | 'mobile'> {
  uid: string | number
  role?: string
}

export interface TokenPair {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  refresh_granted: boolean
  user: AuthUser
}

interface ApiEnvelope<T> {
  code: number
  msg: string
  data: T
  trace_id?: string
}

function toError(payload: ApiEnvelope<unknown> | null, fallback: string): Error {
  return new Error(payload?.msg || fallback)
}

async function postJson<T>(url: string, body: unknown): Promise<ApiEnvelope<T>> {
  const response = await authFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    let payload: ApiEnvelope<unknown> | null = null
    try {
      payload = (await response.json()) as ApiEnvelope<unknown>
    } catch {
      payload = null
    }
    throw toError(payload, `请求失败（${response.status}）`)
  }
  return (await response.json()) as ApiEnvelope<T>
}

function applyPair(pair: TokenPair): TokenPair {
  setAccessToken(pair.access_token)
  if (pair.refresh_granted && pair.refresh_token) {
    saveRefreshToken(pair.refresh_token)
  }
  return pair
}

/** POST /user/login：登录即注册，颁发双令牌（响应不含任何密码字段） */
export async function login(mobile: string, password: string): Promise<TokenPair> {
  const payload = await postJson<TokenPair>(api.user.login, { mobile, password })
  if (payload.code !== 0) throw toError(payload, '登录失败')
  return applyPair(payload.data)
}

/** POST /user/token/refresh：续期令牌轮换（由 http.ts 单飞调用） */
export async function refreshTokens(): Promise<boolean> {
  const { loadRefreshToken, clearTokens } = await import('./tokenStore')
  const refreshToken = loadRefreshToken()
  if (!refreshToken) return false
  try {
    const payload = await postJson<TokenPair>(api.user.refresh, {
      refresh_token: refreshToken,
    })
    if (payload.code !== 0 || !payload.data?.access_token) return false
    applyPair(payload.data)
    return true
  } catch {
    clearTokens()
    return false
  }
}

/** POST /user/logout：服务端吊销双令牌并清理本地态 */
export async function logout(): Promise<void> {
  const { loadRefreshToken, clearTokens } = await import('./tokenStore')
  const refreshToken = loadRefreshToken() ?? ''
  try {
    await postJson<null>(api.user.logout, { refresh_token: refreshToken })
  } finally {
    clearTokens()
  }
}

/** GET /user/quota：当日用量查询 */
export async function fetchQuota(): Promise<{
  date: string
  used: number
  quota: number
  remaining: number
}> {
  const response = await authFetch(api.user.quota, { method: 'GET' })
  if (!response.ok) throw new Error(`配额查询失败（${response.status}）`)
  const payload = (await response.json()) as ApiEnvelope<{
    date: string
    used: number
    quota: number
    remaining: number
  }>
  if (payload.code !== 0) throw toError(payload, '配额查询失败')
  return payload.data
}

// 生产装配：请求层的续期与失败回调指向本模块实现
httpDeps.refreshTokenFn = refreshTokens

/** 供组件在挂载时注册"鉴权失败 → 登出"回调 */
export function registerAuthFailureHandler(handler: () => void): void {
  httpDeps.onAuthFailure = handler
}

export { getAccessToken }
