import { useState } from 'react'

let _nextId = 400
const uid = () => _nextId++

function getWeekDates(offset) {
  const now = new Date(), day = now.getDay(), mon = new Date(now)
  mon.setDate(now.getDate() - ((day + 6) % 7) + offset * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon)
    d.setDate(mon.getDate() + i)
    return d.toISOString().split('T')[0]
  })
}

const CheckIcon = () => (
  <svg className="checkmark" viewBox="0 0 12 12">
    <polyline points="2,6 5,9 10,3" />
  </svg>
)

export default function Habits({ state, setState }) {
  const [habitType, setHabitType] = useState('weekly')
  const [nameInput, setNameInput] = useState('')
  const [goalInput, setGoalInput] = useState(3)

  const dates = getWeekDates(state.habitWeekOffset)

  const startLabel = new Date(dates[0] + 'T12:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
  const endLabel   = new Date(dates[6] + 'T12:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })

  function habitNav(dir) {
    setState(prev => ({ ...prev, habitWeekOffset: prev.habitWeekOffset + dir }))
  }

  function toggleHabit(habitId, date) {
    const key = `${habitId}_${date}`
    setState(prev => ({
      ...prev,
      habitChecks: { ...prev.habitChecks, [key]: !prev.habitChecks[key] },
    }))
  }

  function deleteHabit(id) {
    setState(prev => ({ ...prev, habits: prev.habits.filter(h => h.id !== id) }))
  }

  function addHabit() {
    if (!nameInput.trim()) return
    const isDai = habitType === 'daily'
    setState(prev => ({
      ...prev,
      habits: [...prev.habits, { id: uid(), name: nameInput.trim(), type: habitType, goal: isDai ? 7 : goalInput, daily: isDai }],
    }))
    setNameInput('')
  }

  function renderHabitRow(h) {
    const count = dates.filter(d => state.habitChecks[`${h.id}_${d}`]).length
    let completion
    if (!h.daily) {
      if (count >= h.goal)      completion = <span className="completion-badge completion-done">Complete</span>
      else if (count > 0)       completion = <span className="completion-badge completion-partial">{count}/{h.goal}</span>
      else                      completion = <span className="completion-badge completion-empty">0/{h.goal}</span>
    } else {
      completion = <span style={{ fontSize: '11px', color: 'var(--text3)' }}>{count}/7</span>
    }

    return (
      <div key={h.id} className="habit-row">
        <div className="habit-name">
          {h.name}
          <button className="del-btn" onClick={() => deleteHabit(h.id)} style={{ marginLeft: '6px', fontSize: '11px' }}>×</button>
        </div>
        {dates.map(d => {
          const key = `${h.id}_${d}`
          const checked = state.habitChecks[key]
          const cls = checked ? (h.daily ? 'cb daily-checked' : 'cb checked') : 'cb'
          return (
            <div key={d} className="habit-check">
              <div className={cls} onClick={() => toggleHabit(h.id, d)}>
                {checked && <CheckIcon />}
              </div>
            </div>
          )
        })}
        <div className="habit-completion">{completion}</div>
      </div>
    )
  }

  const weekly = state.habits.filter(h => !h.daily)
  const daily  = state.habits.filter(h => h.daily)

  return (
    <div className="panel">
      <div className="habit-layout">
        <div>
          <div className="habit-table-wrap">
            <div className="habit-hdr-row">
              <h2>Habit Tracker</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text2)' }}>
                <button className="btn-ghost" onClick={() => habitNav(-1)}>←</button>
                <span>{startLabel} — {endLabel}</span>
                <button className="btn-ghost" onClick={() => habitNav(1)}>→</button>
              </div>
            </div>

            {/* Header row */}
            <div className="habit-row" style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
              <div className="habit-name" style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', padding: '8px 16px' }}>Habit</div>
              {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
                <div key={d} className="habit-day-hdr">{d}</div>
              ))}
              <div className="habit-day-hdr">Progress</div>
            </div>

            {/* Weekly goals section */}
            {weekly.length > 0 && (
              <>
                <div className="habit-row" style={{ background: 'var(--surface2)' }}>
                  <div className="habit-section-label">Weekly Goals</div>
                </div>
                {weekly.map(h => renderHabitRow(h))}
              </>
            )}

            {/* Daily tracking section */}
            {daily.length > 0 && (
              <>
                <div className="habit-row" style={{ background: 'var(--surface2)' }}>
                  <div className="habit-section-label">Daily Tracking</div>
                </div>
                {daily.map(h => renderHabitRow(h))}
              </>
            )}
          </div>
        </div>

        <div>
          {/* Weekly Overview */}
          <div className="side-card">
            <h3>Weekly Overview</h3>
            {state.habits.map(h => {
              const count = dates.filter(d => state.habitChecks[`${h.id}_${d}`]).length
              const pct = Math.round((count / h.goal) * 100)
              const color = h.daily ? 'var(--blue)' : count >= h.goal ? 'var(--green)' : 'var(--accent)'
              return (
                <div key={h.id} className="progress-item">
                  <div className="progress-label">
                    <span style={{ fontSize: '12px' }}>{h.name}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text3)' }}>{count}/{h.goal}</span>
                  </div>
                  <div className="progress-bar-wrap">
                    <div className="progress-bar" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Add Habit */}
          <div className="side-card">
            <h3>Add Habit</h3>
            <div className="form-row" style={{ marginBottom: '8px' }}>
              <label>Name</label>
              <input
                className="form-input"
                placeholder="e.g. Read 30 min"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addHabit()}
                style={{ fontSize: '12px', padding: '5px 8px' }}
              />
            </div>
            <div style={{ marginBottom: '8px' }}>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text3)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Type</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button className={'goal-type-btn' + (habitType === 'weekly' ? ' active' : '')} onClick={() => setHabitType('weekly')}>Weekly goal</button>
                <button className={'goal-type-btn' + (habitType === 'daily'  ? ' active' : '')} onClick={() => setHabitType('daily')}>Daily track</button>
              </div>
            </div>
            {habitType === 'weekly' && (
              <div style={{ marginBottom: '8px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text3)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Times per week</label>
                <input
                  className="form-input"
                  type="number"
                  value={goalInput}
                  min={1} max={7}
                  onChange={e => setGoalInput(parseInt(e.target.value) || 1)}
                  style={{ fontSize: '12px', padding: '5px 8px', width: '60px' }}
                />
              </div>
            )}
            <button className="btn-primary" onClick={addHabit} style={{ fontSize: '12px', padding: '6px 16px', width: 'auto' }}>Add Habit</button>
          </div>
        </div>
      </div>
    </div>
  )
}
