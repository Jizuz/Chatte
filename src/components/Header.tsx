import { LogIn, LogOut } from 'lucide-react'
import type { User } from '../types'

interface HeaderProps {
  user: User | null
  onLoginClick: () => void
  onLogout: () => void
}

export function Header({ user, onLoginClick, onLogout }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="brand">
        <span className="brand-name">灵医智能</span>
      </div>
      
      <div className="header-auth">
        <a href="/knowledge-base" className="btn btn-secondary">
          知识库管理
        </a>

        {user ? (
          <>
            <div className="user-chip">
              <span className="avatar avatar-sm">{user.avatar}</span>
              <div className="user-meta">
                <span className="user-name">{user.name}</span>
                <span className="user-mobile">{user.mobile}</span>
              </div>
            </div>
            <button type="button" className="btn btn-ghost" onClick={onLogout}>
              <LogOut size={16} />
              登出
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-primary" onClick={onLoginClick}>
            <LogIn size={16} />
            登录
          </button>
        )}
      </div>
    </header>
  )
}
