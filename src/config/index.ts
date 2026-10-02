/** API 服务根地址，可通过 .env 中 VITE_API_BASE_URL 覆盖 */
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://118.178.184.46:8000'

/**
 * RAG 知识管理后台服务根地址。
 * 开发环境默认空串 → 请求为相对路径，由 Vite 代理（/rag → http://127.0.0.1:8090）转发，
 * 规避浏览器跨域限制；生产环境直连完整地址。两种环境均可用 VITE_RAG_API_BASE_URL 显式覆盖。
 */
export const RAG_API_BASE_URL =
  import.meta.env.VITE_RAG_API_BASE_URL ??
  (import.meta.env.DEV ? '' : 'http://127.0.0.1:8090')

function joinApi(path: string): string {
  const base = API_BASE_URL.replace(/\/$/, '')
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${base}${suffix}`
}

function joinRagApi(path: string): string {
  const base = RAG_API_BASE_URL.replace(/\/$/, '')
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
    saveFile: joinRagApi('/rag/admin/doc/upload'),
    saveUrl: joinRagApi('/rag/admin/doc/crawl'),
    docList: joinRagApi('/rag/admin/doc/page'),
    docDetail: joinRagApi('/rag/admin/doc/detail'),
    // docAdd: joinRagApi('/rag/admin/doc/add'),
    docUpdate: joinRagApi('/rag/admin/doc/update'),
    docDelete: joinRagApi('/rag/admin/doc/delete'),
    docRestore: joinRagApi('/rag/admin/doc/restore'),
  },
} as const

/** 应用级配置 */
export const app = {
  authStorageKey: 'chatte-auth',
  minPasswordLength: 4,
  mobileRegex: /^1\d{10}$/,
  sessionListPageSize: 10,
  kbDocListPageSize: 10,
} as const
