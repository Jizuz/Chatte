import { useCallback, useEffect, useState } from 'react'
import { app } from '../config'
import type { User } from '../types'
import { login as apiLogin, logout as apiLogout, registerAuthFailureHandler } from '../api/auth'
import { loadRefreshToken, clearTokens } from '../api/tokenStore'
import { refreshTokens } from '../api/auth'

export type LoginResult =
  | { ok: true }
  | { ok: false; error: string }

const USER_CACHE_KEY = 'chatte-user'

function isValidMobile(mobile: string) {
  return app.mobileRegex.test(mobile.trim())
}

function toUser(authUser: { uid: string | number; name: string; mobile: string }): User {
  const name = authUser.name || `用户${authUser.mobile.slice(-4)}`
  return {
    id: String(authUser.uid),
    name,
    mobile: authUser.mobile,
    avatar: name.slice(0, 1),
    status: 'online',
  }
}

function loadCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => loadCachedUser())

  // 全局鉴权失败（续期失败）→ 清理 UI 登录态
  useEffect(() => {
    registerAuthFailureHandler(() => {
      localStorage.removeItem(USER_CACHE_KEY)
      setUser(null)
    })
  }, [])

  // 启动静默恢复：access 驻内存已丢失，凭持久化 refresh 续期恢复会话
  useEffect(() => {
    let cancelled = false
    if (!loadRefreshToken()) {
      // 无 refresh 但残留旧伪登录键：清理（含明文密码残留，spec 兼容与灰度规则）
      clearTokens()
      localStorage.removeItem(USER_CACHE_KEY)
      return
    }
    void refreshTokens().then((ok) => {
      if (cancelled) return
      if (!ok) {
        localStorage.removeItem(USER_CACHE_KEY)
        setUser(null)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (mobile: string, password: string): Promise<LoginResult> => {
    const trimmed = mobile.trim()
    if (!isValidMobile(trimmed)) {
      return { ok: false, error: '请输入 11 位手机号' }
    }
    if (password.length < app.minPasswordLength) {
      return { ok: false, error: `密码至少 ${app.minPasswordLength} 位` }
    }

    try {
      const pair = await apiLogin(trimmed, password)
      const next = toUser(pair.user)
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(next))
      setUser(next)
      return { ok: true }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '登录失败，请稍后重试'
      return { ok: false, error: message }
    }
  }, [])

  const logout = useCallback(() => {
    void apiLogout().finally(() => {
      localStorage.removeItem(USER_CACHE_KEY)
      setUser(null)
    })
  }, [])

  return { user, isAuthenticated: Boolean(user), login, logout }
}

