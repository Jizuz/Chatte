import { api } from '../config'
import type { User } from '../types'

type ApiUser = Record<string, unknown>

/** 查询结果含密码，仅用于登录校验，不会写入本地登录态 */
type QueriedUser = User & { password?: string }

function pickString(record: ApiUser, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number') return String(value)
  }
  return undefined
}

function unwrapPayload(payload: unknown): ApiUser | null {
  if (payload == null) return null
  if (typeof payload !== 'object') return null

  const record = payload as ApiUser
  if (record.data && typeof record.data === 'object') {
    return record.data as ApiUser
  }
  if (record.user && typeof record.user === 'object') {
    return record.user as ApiUser
  }
  if (record.result && typeof record.result === 'object') {
    return record.result as ApiUser
  }
  return record
}

function isEmptyUser(record: ApiUser | null): boolean {
  if (!record) return true
  const id = pickString(record, ['id', 'user_id', 'userId', 'uid'])
  const mobile = pickString(record, ['mobile', 'phone', 'tel'])
  return !id && !mobile
}

function stripPassword(user: QueriedUser): User {
  const { password: _password, ...safe } = user
  return safe
}

export function normalizeUser(
  payload: unknown,
  fallbackMobile?: string,
): QueriedUser {
  const record = unwrapPayload(payload)
  if (!record || isEmptyUser(record)) {
    throw new Error('用户信息为空')
  }

  const id =
    pickString(record, ['id', 'user_id', 'userId', 'uid']) ??
    `u-${Date.now()}`
  const mobile =
    pickString(record, ['mobile', 'phone', 'tel']) ?? fallbackMobile ?? ''
  const name =
    pickString(record, ['name', 'username', 'nickname', 'nick_name']) ??
    (mobile ? `用户${mobile.slice(-4)}` : '用户')
  const avatar =
    pickString(record, ['avatar', 'avatar_url', 'avatarUrl']) ??
    name.slice(0, 1)
  const password = pickString(record, [
    'password',
    'pwd',
    'passwd',
    'papassword',
  ])

  return {
    id,
    name,
    mobile,
    avatar,
    status: 'online',
    ...(password !== undefined ? { password } : {}),
  }
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text.trim()) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

/** GET /user/detail/mobile?mobile=xxx */
export async function queryUserByMobile(
  mobile: string,
): Promise<QueriedUser | null> {
  const url = new URL(api.user.detailByMobile)
  url.searchParams.set('mobile', mobile.trim())

  const response = await fetch(url.toString(), { method: 'GET' })

  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(`查询用户失败（${response.status}）`)
  }

  const payload = await readJson(response)
  const record = unwrapPayload(payload)
  if (isEmptyUser(record)) return null

  try {
    return normalizeUser(payload, mobile)
  } catch {
    return null
  }
}

/** POST /user/add  body: { mobile, password } */
export async function createUser(mobile: string, password: string): Promise<User> {
  const response = await fetch(api.user.add, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({
      mobile: mobile.trim(),
      password,
    }),
  })

  if (!response.ok) {
    throw new Error(`创建用户失败（${response.status}）`)
  }

  const payload = await readJson(response)
  return stripPassword(normalizeUser(payload, mobile))
}

/**
 * 登录：先按手机号查询；
 * 已存在则校验密码，不匹配抛出「密码错误」；
 * 不存在则创建新用户。
 */
export async function loginOrRegister(
  mobile: string,
  password: string,
): Promise<User> {
  const existing = await queryUserByMobile(mobile)
  if (existing) {
    if (existing.password !== password) {
      throw new Error('密码错误')
    }
    return stripPassword(existing)
  }
  return createUser(mobile, password)
}
