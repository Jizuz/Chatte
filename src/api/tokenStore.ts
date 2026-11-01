/**
 * 令牌存储（T11，design: access 内存 + refresh 持久化）。
 *
 * - access 仅驻内存（页面刷新丢失，由 useAuth 启动静默续期恢复）；
 * - refresh 持久化于 localStorage 键 `chatte-refresh`；
 * - clearTokens 同步清理历史遗留键 `chatte-auth`（旧伪登录态可能含明文密码，
 *   spec: access-auth 兼容与灰度规则）。
 */

const REFRESH_KEY = 'chatte-refresh'
const LEGACY_AUTH_KEY = 'chatte-auth'

let accessToken: string | null = null

type StorageLike = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function storage(): StorageLike {
  const candidate = (globalThis as { localStorage?: StorageLike }).localStorage
  if (candidate) return candidate
  // 非浏览器环境（测试）回退内存实现
  const map = new Map<string, string>()
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
  }
}

export function getAccessToken(): string | null {
  return accessToken
}

export function setAccessToken(token: string | null): void {
  accessToken = token
}

export function saveRefreshToken(token: string): void {
  storage().setItem(REFRESH_KEY, token)
}

export function loadRefreshToken(): string | null {
  return storage().getItem(REFRESH_KEY)
}

export function clearTokens(): void {
  accessToken = null
  const store = storage()
  store.removeItem(REFRESH_KEY)
  store.removeItem(LEGACY_AUTH_KEY)
}
