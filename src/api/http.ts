/**
 * 统一请求层（T11，spec: access-auth 前端场景）。
 *
 * - 注入 `Authorization: Bearer`；
 * - 401 → 单飞续期（并发请求仅触发一次 refresh）→ 重放原请求一次；
 * - 续期失败抛 UnauthorizedError 并回调 onAuthFailure（清理态/跳登录）；
 * - 依赖经 httpDeps 注入（生产由 auth.ts 装配，测试注入 mock，避免环境耦合）。
 */

import { getAccessToken } from './tokenStore'

export class UnauthorizedError extends Error {
  constructor(message = '登录已过期，请重新登录') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

export interface HttpDeps {
  fetchImpl: typeof fetch
  refreshTokenFn: () => Promise<boolean>
  onAuthFailure?: () => void
}

export const httpDeps: HttpDeps = {
  fetchImpl: (...args) => fetch(...args),
  refreshTokenFn: async () => false,
  onAuthFailure: undefined,
}

let refreshInFlight: Promise<boolean> | null = null

async function singleFlightRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = httpDeps
      .refreshTokenFn()
      .then((ok) => {
        if (!ok) httpDeps.onAuthFailure?.()
        return ok
      })
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null
      })
  }
  return refreshInFlight
}

export async function authFetch(
  url: string,
  init: RequestInit = {},
  retried = false,
): Promise<Response> {
  const headers = new Headers(init.headers)
  const token = getAccessToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await httpDeps.fetchImpl(url, { ...init, headers })

  if (response.status === 401 && !retried) {
    const refreshed = await singleFlightRefresh()
    if (refreshed) return authFetch(url, init, true)
    throw new UnauthorizedError()
  }
  return response
}
