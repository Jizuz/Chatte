/**
 * T11 手测脚本（tasks.md：前端无测试基建，以最小手测脚本替代）。
 *
 * 验证 authFetch：令牌注入、401 单飞续期、重放携带新令牌、并发去重、
 * 续期失败抛 UnauthorizedError 并触发 onAuthFailure。
 *
 * 运行：./node_modules/.bin/tsc src/api/http.ts src/api/tokenStore.ts \
 *         --outDir .authfetch-build --module esnext --target es2022 \
 *         --moduleResolution bundler --skipLibCheck --ignoreConfig \
 *       && sed -i '' \"s|from './tokenStore'|from './tokenStore.js'|\" .authfetch-build/http.js \
 *       && node scripts/test-auth-fetch.mjs
 */

import assert from 'node:assert/strict'
import { authFetch, httpDeps, UnauthorizedError } from '../.authfetch-build/http.js'
import { setAccessToken, getAccessToken } from '../.authfetch-build/tokenStore.js'

function makeResponse(status, body = {}) {
  return {
    status,
    ok: status < 400,
    json: async () => body,
  }
}

const seen = { requests: [], refreshCalls: 0 }

function mockFetch() {
  return async (url, init) => {
    const auth = init.headers?.get?.('Authorization') ?? ''
    seen.requests.push({ url, auth })
    if (url === '/protected') {
      // 旧令牌 401，新令牌 200
      return auth === 'Bearer new-token'
        ? makeResponse(200, { value: 'ok' })
        : makeResponse(401, { code: 40102, msg: '令牌已过期' })
    }
    return makeResponse(200, {})
  }
}

// ---- 场景 1：令牌注入 + 401 续期 + 重放 ----
setAccessToken('old-token')
let refreshCount = 0
httpDeps.fetchImpl = mockFetch()
httpDeps.refreshTokenFn = async () => {
  refreshCount += 1
  setAccessToken('new-token')
  return true
}

const resp1 = await authFetch('/protected')
assert.equal(resp1.status, 200, '重放后应成功')
assert.equal(refreshCount, 1, '应触发一次续期')
assert.deepEqual(
  seen.requests.map((r) => r.auth),
  ['Bearer old-token', 'Bearer new-token'],
  '重放必须携带新令牌',
)

// ---- 场景 2：并发请求单飞续期 ----
seen.requests.length = 0
setAccessToken('old-token')
refreshCount = 0
const [a, b] = await Promise.all([authFetch('/protected'), authFetch('/protected')])
assert.equal(a.status, 200)
assert.equal(b.status, 200)
assert.equal(refreshCount, 1, '并发 401 仅触发一次续期（单飞）')

// ---- 场景 3：续期失败 → UnauthorizedError + onAuthFailure ----
let failureCalled = 0
httpDeps.onAuthFailure = () => {
  failureCalled += 1
}
httpDeps.refreshTokenFn = async () => false
setAccessToken('expired-token')
await assert.rejects(() => authFetch('/protected'), UnauthorizedError)
assert.equal(failureCalled, 1, '续期失败应触发 onAuthFailure')

assert.ok(getAccessToken() !== undefined)

console.log('✓ authFetch 手测 3 场景全部通过（注入/单飞续期重放/失败登出）')
