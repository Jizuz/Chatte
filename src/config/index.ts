/** API 服务根地址，可通过 .env 中 VITE_API_BASE_URL 覆盖 */
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://118.178.184.46:8000'

function joinApi(path: string): string {
  const base = API_BASE_URL.replace(/\/$/, '')
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${base}${suffix}`
}

/** 接口地址 */
export const api = {
  user: {
    detailByMobile: joinApi('/user/detail/mobile'),
    add: joinApi('/user/add'),
  },
  chat: {
    agent: joinApi('/chat/agent'),
    llm: joinApi('/chat/llm'),
    sessionList: joinApi('/chat/session/list'),
    sessionHistory: joinApi('/chat/session/history'),
    sessionClose: joinApi('/chat/session/close'),
    messageSave: joinApi('/chat/message/save'),
  },
  rag: {
    saveFile: joinApi('/rag/save/file'),
    saveUrl: joinApi('/rag/save/web'),
  },
} as const

/** 应用级配置 */
export const app = {
  authStorageKey: 'chatte-auth',
  minPasswordLength: 4,
  mobileRegex: /^1\d{10}$/,
  sessionListPageSize: 10,
} as const
