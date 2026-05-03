import { useState } from 'react'
import Nav from './components/Nav.jsx'
import Calendar from './tabs/Calendar.jsx'
import Finance from './tabs/Finance.jsx'
import Habits from './tabs/Habits.jsx'
import Content from './tabs/Content.jsx'
import { useAuth } from './hooks/useAuth.js'
import { useAppData } from './hooks/useAppData.js'

export default function App() {
  const { user, login, logout } = useAuth()
  const [activeTab, setActiveTab] = useState('calendar')
  const { state, setState, loading, isDemo } = useAppData(user)

  if (user === undefined || (user && loading)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text2)', fontSize: '14px' }}>
        Loading…
      </div>
    )
  }

  return (
    <>
      <Nav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isDemo={isDemo}
        onLogin={login}
        onLogout={logout}
        user={user}
      />
      {activeTab === 'calendar' && <Calendar state={state} setState={setState} />}
      {activeTab === 'finance'  && <Finance  state={state} setState={setState} user={user} isDemo={isDemo} />}
      {activeTab === 'habits'   && <Habits   state={state} setState={setState} user={user} isDemo={isDemo} />}
      {activeTab === 'content'  && <Content  state={state} setState={setState} user={user} isDemo={isDemo} />}
    </>
  )
}
