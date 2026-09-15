import { useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import type { LoginResult } from '../hooks/useAuth'

interface LoginModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (mobile: string, password: string) => Promise<LoginResult>
}

export function LoginModal({ open, onClose, onSubmit }: LoginModalProps) {
  const [mobile, setMobile] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (!open) return null

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (loading) return

    setLoading(true)
    setError('')
    try {
      const result = await onSubmit(mobile, password)
      if (!result.ok) {
        setError(result.error)
        return
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2 id="login-title">登录 灵医智能</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </div>

        <p className="modal-hint">
          输入手机号登录。若账号不存在，将自动注册新用户。
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            手机号
            <input
              type="tel"
              inputMode="numeric"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="请输入手机号"
              autoComplete="tel"
              maxLength={11}
              required
              disabled={loading}
            />
          </label>
          <label>
            密码
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              autoComplete="current-password"
              required
              disabled={loading}
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={loading}
          >
            {loading ? '登录中…' : '进入会话'}
          </button>
        </form>
      </div>
    </div>
  )
}
