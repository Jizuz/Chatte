import { useCallback, useState } from 'react'
import { app } from '../config'
import type { User } from '../types'
import { loginOrRegister } from '../api/user'

export type LoginResult =
  | { ok: true }
  | { ok: false; error: string }

function loadUser(): User | null {
  try {
    const raw = localStorage.getItem(app.authStorageKey)
    if (!raw) return null
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

function isValidMobile(mobile: string) {
  return app.mobileRegex.test(mobile.trim())
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => loadUser())

  const login = useCallback(async (mobile: string, password: string): Promise<LoginResult> => {
    const trimmed = mobile.trim()
    if (!isValidMobile(trimmed)) {
      return { ok: false, error: '请输入 11 位手机号' }
    }
    if (password.length < app.minPasswordLength) {
      return { ok: false, error: `密码至少 ${app.minPasswordLength} 位` }
    }

    try {
      const next = await loginOrRegister(trimmed, password)
      localStorage.setItem(app.authStorageKey, JSON.stringify(next))
      setUser(next)
      return { ok: true }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '登录失败，请稍后重试'
      return { ok: false, error: message }
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(app.authStorageKey)
    setUser(null)
  }, [])

  return { user, isAuthenticated: Boolean(user), login, logout }
}
