import { useState } from 'react'
import Nav from './components/Nav.jsx'
import Calendar from './tabs/Calendar.jsx'
import Finance from './tabs/Finance.jsx'
import Habits from './tabs/Habits.jsx'
import Content from './tabs/Content.jsx'
import { defaultState } from './state/defaultState.js'

export default function App() {
  const [activeTab, setActiveTab] = useState('calendar')
  const [state, setState] = useState(defaultState)

  return (
    <>
      <Nav activeTab={activeTab} setActiveTab={setActiveTab} />
      {activeTab === 'calendar' && <Calendar state={state} setState={setState} />}
      {activeTab === 'finance'  && <Finance  state={state} setState={setState} />}
      {activeTab === 'habits'   && <Habits   state={state} setState={setState} />}
      {activeTab === 'content'  && <Content  state={state} setState={setState} />}
    </>
  )
}
