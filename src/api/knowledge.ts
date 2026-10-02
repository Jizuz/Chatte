import { api, app } from '../config'
import type { KbDoc, KbDocListData, KbDocStatus } from '../types'

/** 文档分组枚举 */
export const KB_DOC_GROUPS = [
  { code: 'cardio_health', name: '心血管' },
  { code: 'resp_health', name: '呼吸' },
  { code: 'ped_health', name: '儿童健康' },
  { code: 'endo_health', name: '内分泌' },
  { code: 'women_health', name: '女性健康' },
  { code: 'common_living', name: '通用居家健康' },
] as const

/** 上传单文件大小上限：20MB */
export const KB_DOC_MAX_FILE_SIZE = 20 * 1024 * 1024

/** 允许上传的文件扩展名 */
export const KB_DOC_ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.txt', '.md']

/** 按分组代码取分组名称，未知分组原样返回 */
export function kbDocGroupName(code: string): string {
  return KB_DOC_GROUPS.find((group) => group.code === code)?.name ?? code
}

/** 文件上传接口 */
export async function uploadFile(formData: FormData): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(api.rag.saveFile, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`文件上传失败（${response.status}）`)
    }

    const result = await response.json()
    return result
  } catch (error) {
    console.error('文件上传错误:', error)
    throw error
  }
}

export interface UploadUrlOptions {
  /** 文档分组代码 */
  docGroup?: string
  /** 文档标题 */
  title?: string
}

/** 网页链接上传接口（后端以表单参数接收 url / docGroup / title） */
export async function uploadUrl(
  url: string,
  options: UploadUrlOptions = {},
): Promise<{ success: boolean; message: string }> {
  try {
    const params: Record<string, string> = { url }
    if (options.docGroup) params.docGroup = options.docGroup
    if (options.title) params.title = options.title

    const response = await fetch(api.rag.saveUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: new URLSearchParams(params).toString(),
    })

    if (!response.ok) {
      throw new Error(`URL上传失败（${response.status}）`)
    }

    const result = (await response.json()) as {
      success?: boolean
      message?: string
    }
    if (result && result.success === false) {
      throw new Error(result.message || '上传失败')
    }
    return result as { success: boolean; message: string }
  } catch (error) {
    console.error('URL上传错误:', error)
    throw error
  }
}

/* ==================== 权威源文档管理（后台） ==================== */

/**
 * 将后端时间字段格式化为展示文本（YYYY-MM-DD HH:mm:ss）
 * 兼容毫秒/秒时间戳、ISO 字符串（如 2026-10-01T23:12:53）与已有格式化文本
 */
function formatGmtTime(value: unknown): string {
  if (value == null || value === '') return ''
  const n = Number(value)
  const date =
    Number.isFinite(n) && n > 0 && String(value).trim() === String(n)
      ? new Date(n < 1e12 ? n * 1000 : n)
      : new Date(String(value))
  if (!Number.isNaN(date.getTime())) {
    const pad = (part: number) => String(part).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  }
  return String(value)
}

function normalizeKbDoc(record: Record<string, unknown>): KbDoc {
  const status = Number(record.status ?? 1)
  return {
    docId: String(record.docId ?? record.doc_id ?? ''),
    docGroup: String(record.docGroup ?? record.doc_group ?? ''),
    title: String(record.title ?? ''),
    // 列表接口字段为 chunks（兼容 chunk_count / chunkCount）
    chunkCount: Number(record.chunks ?? record.chunk_count ?? record.chunkCount ?? 0),
    status: (status === 0 ? 0 : 1) as KbDocStatus,
    content: record.content != null ? String(record.content) : undefined,
    gmtCreate: formatGmtTime(record.gmtCreate ?? record.gmt_create),
    gmtUpdate: formatGmtTime(record.gmtUpdate ?? record.gmt_update),
  }
}

export interface FetchKbDocListParams {
  page?: number
  pageSize?: number
  /** 标题 / 内容关键字 */
  keyword?: string
  /** 分组代码，空串表示全部分组 */
  docGroup?: string
  /** 1 有效 / 0 已删除，空表示全部 */
  status?: KbDocStatus | ''
}

/** GET /rag/admin/doc/page —— 权威源文档分页列表（后端为 Spring，参数驼峰命名） */
export async function fetchKbDocList(
  params: FetchKbDocListParams = {},
): Promise<KbDocListData> {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? app.kbDocListPageSize

  // 兼容相对路径（dev 走 Vite 代理）与完整 URL（prod 直连）两种形态
  const url = new URL(api.rag.docList, window.location.origin)
  // 后端分页参数为 page / size
  url.searchParams.set('page', String(page))
  url.searchParams.set('size', String(pageSize))
  if (params.keyword) {
    url.searchParams.set('keyword', params.keyword)
  }
  if (params.docGroup) {
    url.searchParams.set('docGroup', params.docGroup)
  }
  if (params.status !== '' && params.status != null) {
    url.searchParams.set('status', String(params.status))
  }

  const response = await fetch(url.toString(), { method: 'GET' })

  if (!response.ok) {
    throw new Error(`文档列表请求失败（${response.status}）`)
  }

  // 响应结构：{ success, total, list: [...] }
  const payload = (await response.json()) as {
    success?: boolean
    code?: number
    msg?: string
    total?: number
    list?: unknown[]
  }

  if (payload.success === false) {
    throw new Error(payload.msg || '文档列表请求失败')
  }
  if (typeof payload.code === 'number' && payload.code !== 0) {
    throw new Error(payload.msg || '文档列表请求失败')
  }

  const rawList = Array.isArray(payload.list) ? payload.list : []
  const list = rawList.map((item) =>
    normalizeKbDoc(item as Record<string, unknown>),
  )

  return {
    total: Number(payload.total ?? list.length),
    list,
  }
}

/** GET /rag/admin/doc/detail —— 文档详情（含正文） */
export async function fetchKbDocDetail(docId: string): Promise<KbDoc> {
  const url = new URL(api.rag.docDetail, window.location.origin)
  url.searchParams.set('docId', docId)

  const response = await fetch(url.toString(), { method: 'GET' })

  if (!response.ok) {
    throw new Error(`文档详情请求失败（${response.status}）`)
  }

  const payload = (await response.json()) as {
    success?: boolean
    code?: number
    msg?: string
    data?: unknown
  } & Record<string, unknown>

  if (payload.success === false) {
    throw new Error(payload.msg || '文档详情请求失败')
  }
  if (typeof payload.code === 'number' && payload.code !== 0) {
    throw new Error(payload.msg || '文档详情请求失败')
  }

  // 兼容 { data: {...} } 包装与直接返回文档对象两种形态
  const data = (payload.data ?? payload) as Record<string, unknown>
  return normalizeKbDoc(data)
}

export interface UpdateKbDocParams {
  docId: string
  title: string
  docGroup: string
  content: string
}

/**
 * 以表单参数（application/x-www-form-urlencoded）发起 POST，
 * 匹配后端 @RequestParam 参数式接收风格。
 */
async function postForm(
  url: string,
  params: Record<string, string>,
  fallback: string,
): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body: new URLSearchParams(params).toString(),
  })

  if (!response.ok) {
    throw new Error(`${fallback}（${response.status}）`)
  }

  const payload = (await response.json().catch(() => ({}))) as {
    success?: boolean
    code?: number
    msg?: string
  }
  if (payload.success === false) {
    throw new Error(payload.msg || fallback)
  }
  if (typeof payload.code === 'number' && payload.code !== 0) {
    throw new Error(payload.msg || fallback)
  }
}

/** POST /rag/admin/doc/update —— 编辑文档（服务端重算 content_md5，内容变化时发送 UPDATE 消息） */
export async function updateKbDoc(params: UpdateKbDocParams): Promise<void> {
  await postForm(
    api.rag.docUpdate,
    {
      docId: params.docId,
      title: params.title,
      docGroup: params.docGroup,
      content: params.content,
    },
    '文档更新失败',
  )
}

/** POST /rag/admin/doc/delete —— 软删除文档（status=0，发送 DELETE 消息） */
export async function deleteKbDoc(docId: string): Promise<void> {
  await postForm(api.rag.docDelete, { docId }, '文档删除失败')
}

/** POST /rag/admin/doc/restore —— 恢复软删文档（重置为有效并发送 ADD 消息） */
export async function restoreKbDoc(docId: string): Promise<void> {
  await postForm(api.rag.docRestore, { docId }, '文档恢复失败')
}