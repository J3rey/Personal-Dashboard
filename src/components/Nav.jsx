import { useState } from 'react'

const TABS = ['calendar', 'finance', 'habits', 'content']

export default function Nav({ activeTab, setActiveTab, isDemo, onLogin, onLogout, user }) {
  const [showLogin, setShowLogin]   = useState(false)
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [error, setError]           = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await onLogin(email, password)
      setShowLogin(false)
      setEmail('')
      setPassword('')
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <nav>
      <div className="nav-brand">
        <img src="/logo.png" alt="logo" className="nav-brand-logo" />
        <span>dashboard</span>
      </div>

      {TABS.map(tab => (
        <button
          key={tab}
          className={'nav-tab' + (activeTab === tab ? ' active' : '')}
          onClick={() => setActiveTab(tab)}
        >
          {tab.charAt(0).toUpperCase() + tab.slice(1)}
        </button>
      ))}

      <div className="nav-auth">
        {isDemo ? (
          showLogin ? (
            <form onSubmit={handleLogin} className="nav-login-form">
              <input
                className="nav-login-input"
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoFocus
              />
              <input
                className="nav-login-input"
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              {error && <span className="nav-login-error">{error}</span>}
              <button className="nav-login-submit" type="submit" disabled={submitting}>
                {submitting ? '…' : 'Sign in'}
              </button>
              <button
                className="btn-ghost"
                type="button"
                style={{ fontSize: '12px', padding: '4px 8px' }}
                onClick={() => { setShowLogin(false); setError('') }}
              >
                Cancel
              </button>
            </form>
          ) : (
            <button className="btn-ghost nav-signin-btn" onClick={() => setShowLogin(true)}>
              Sign in
            </button>
          )
        ) : (
          <>
            <span className="nav-user-email">{user?.email}</span>
            <button className="btn-ghost" style={{ fontSize: '12px' }} onClick={onLogout}>
              Sign out
            </button>
          </>
        )}
      </div>
    </nav>
  )
}
