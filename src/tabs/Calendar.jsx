import { useState } from 'react'

let _nextId = 100
const uid = () => _nextId++

const CAT_DOT = { google: 'var(--blue)', personal: 'var(--green)', work: 'var(--purple)' }

function toDs(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function MonthView({ calViewDate, events, onSelectDay }) {
  const today = new Date()
  const todayStr = toDs(today)
  const y = calViewDate.getFullYear(), m = calViewDate.getMonth()
  const firstDay = (new Date(y, m, 1).getDay() + 6) % 7
  const daysInMonth = new Date(y, m + 1, 0).getDate()

  const cells = []
  for (let i = 0; i < firstDay; i++) {
    cells.push({ d: new Date(y, m, 1 - firstDay + i), other: true })
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ d: new Date(y, m, day), other: false })
  }
  const rem = (7 - ((firstDay + daysInMonth) % 7)) % 7
  for (let i = 1; i <= rem; i++) {
    cells.push({ d: new Date(y, m + 1, i), other: true })
  }

  return (
    <div className="cal-grid">
      {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
        <div key={d} className="cal-day-hdr">{d}</div>
      ))}
      {cells.map((cell, i) => {
        const ds = toDs(cell.d)
        const isToday = ds === todayStr
        const evs = events.filter(e => e.date === ds)
        return (
          <div
            key={i}
            className={`cal-cell${cell.other ? ' other-month' : ''}${isToday ? ' today' : ''}`}
            onClick={() => onSelectDay(ds)}
          >
            <div className="cal-date">{cell.d.getDate()}</div>
            {evs.slice(0, 3).map(e => (
              <div key={e.id} className={`cal-event ${e.cat}`}>
                {e.start ? e.start + ' ' : ''}{e.title}
              </div>
            ))}
            {evs.length > 3 && (
              <div style={{ fontSize: '9px', color: 'var(--text3)' }}>+{evs.length - 3} more</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function WeekView({ calViewDate, events, onSelectDay }) {
  const today = new Date()
  const todayStr = toDs(today)
  const d = calViewDate, day = (d.getDay() + 6) % 7
  const mon = new Date(d)
  mon.setDate(d.getDate() - day)
  const dates = Array.from({ length: 7 }, (_, i) => {
    const x = new Date(mon)
    x.setDate(mon.getDate() + i)
    return x
  })
  const dayLabels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

  function hLabel(h) {
    return h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`
  }

  return (
    <div className="week-grid">
      <div className="week-time-col" style={{ padding: '8px 0', textAlign: 'center', fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.4px', background: 'var(--surface2)', borderRight: '1px solid var(--border)' }}>
        Time
      </div>
      {dates.map((dt, i) => {
        const ds = toDs(dt)
        const isT = ds === todayStr
        return (
          <div key={i} className="week-day-hdr">
            <div className="week-day-hdr-label">{dayLabels[i]}</div>
            <div className={'week-day-hdr-num' + (isT ? ' today-num' : '')}>{dt.getDate()}</div>
          </div>
        )
      })}
      {Array.from({ length: 16 }, (_, idx) => idx + 6).map(h => (
        <>
          <div key={`t${h}`} className="week-time-slot">
            <span className="week-time-label">{hLabel(h)}</span>
          </div>
          {dates.map((dt, i) => {
            const ds = toDs(dt)
            const evs = events.filter(e => e.date === ds && e.start && parseInt(e.start.split(':')[0]) === h)
            return (
              <div key={`${h}-${i}`} className="week-day-slot" onClick={() => onSelectDay(ds)}>
                {evs.map(e => (
                  <div key={e.id} className={`week-event ${e.cat}`}>{e.title}</div>
                ))}
              </div>
            )
          })}
        </>
      ))}
    </div>
  )
}

function DayView({ calViewDate, events }) {
  const ds = toDs(calViewDate)
  const allDay = events.filter(e => e.date === ds && (!e.start || e.start === ''))

  function hLabel(h) {
    return h < 12 ? `${h}:00am` : h === 12 ? '12:00pm' : `${h - 12}:00pm`
  }

  return (
    <div className="day-grid">
      {allDay.length > 0 && (
        <div style={{ padding: '8px 12px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', fontSize: '12px', color: 'var(--text2)' }}>
          <span style={{ fontWeight: 500 }}>All day:</span> {allDay.map(e => e.title).join(', ')}
        </div>
      )}
      {Array.from({ length: 16 }, (_, idx) => idx + 6).map(h => {
        const evs = events.filter(e => e.date === ds && e.start && parseInt(e.start.split(':')[0]) === h)
        return (
          <div key={h} className="day-hour-row">
            <div className="day-hour-label">{hLabel(h)}</div>
            <div className="day-hour-cell">
              {evs.map(e => (
                <div key={e.id} className={`day-event-pill ${e.cat}`}>
                  {e.start} {e.title}{e.notes ? ` — ${e.notes}` : ''}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function Calendar({ state, setState }) {
  const [calView, setCalView] = useState('month')
  const [calViewDate, setCalViewDate] = useState(new Date())
  const [form, setForm] = useState({
    title: '', date: toDs(new Date()), start: '', end: '', cat: 'personal', notes: ''
  })

  const today = new Date()
  const todayStr = toDs(today)

  function calNav(dir) {
    setCalViewDate(prev => {
      const d = new Date(prev)
      if (calView === 'month') return new Date(d.getFullYear(), d.getMonth() + dir, 1)
      d.setDate(d.getDate() + dir * (calView === 'week' ? 7 : 1))
      return d
    })
  }

  function selectDay(ds) {
    setForm(prev => ({ ...prev, date: ds }))
    setCalViewDate(new Date(ds + 'T12:00:00'))
  }

  function addEvent() {
    if (!form.title.trim() || !form.date) return
    setState(prev => ({
      ...prev,
      events: [...prev.events, {
        id: uid(),
        title: form.title.trim(),
        date: form.date,
        start: form.start || '',
        end: form.end || '',
        cat: form.cat,
        notes: form.notes,
      }],
    }))
    setForm(prev => ({ ...prev, title: '', notes: '' }))
  }

  function deleteEvent(id) {
    setState(prev => ({ ...prev, events: prev.events.filter(e => e.id !== id) }))
  }

  function getCalLabel() {
    if (calView === 'month') {
      return calViewDate.toLocaleString('default', { month: 'long', year: 'numeric' })
    }
    if (calView === 'week') {
      const day = (calViewDate.getDay() + 6) % 7
      const mon = new Date(calViewDate)
      mon.setDate(calViewDate.getDate() - day)
      const sun = new Date(mon)
      sun.setDate(mon.getDate() + 6)
      const fmt = d => d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
      return `${fmt(mon)} — ${fmt(sun)}`
    }
    return calViewDate.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  const upcoming = state.events
    .filter(e => e.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.start || '').localeCompare(b.start || ''))
    .slice(0, 5)

  return (
    <div className="panel">
      <div className="cal-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button className="btn-ghost" onClick={() => calNav(-1)}>←</button>
          <span className="cal-label">{getCalLabel()}</span>
          <button className="btn-ghost" onClick={() => calNav(1)}>→</button>
          <button className="btn-ghost" onClick={() => setCalViewDate(new Date())}>Today</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="cal-view-btns">
            {['month','week','day'].map(v => (
              <button
                key={v}
                className={'cal-view-btn' + (calView === v ? ' active' : '')}
                onClick={() => setCalView(v)}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text3)' }}>Google Calendar</span>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ccc', display: 'inline-block' }} />
        </div>
      </div>

      <div className="cal-sidebar">
        <div>
          {calView === 'month' && <MonthView calViewDate={calViewDate} events={state.events} onSelectDay={selectDay} />}
          {calView === 'week'  && <WeekView  calViewDate={calViewDate} events={state.events} onSelectDay={selectDay} />}
          {calView === 'day'   && <DayView   calViewDate={calViewDate} events={state.events} />}
        </div>

        <div>
          <div className="side-card">
            <h3>Upcoming</h3>
            {upcoming.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text3)' }}>No upcoming events</div>
            ) : upcoming.map(e => {
              const label = new Date(e.date + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'short', month: 'short', day: 'numeric' })
              return (
                <div key={e.id} className="event-item">
                  <div className="event-dot" style={{ background: CAT_DOT[e.cat] || 'var(--accent)' }} />
                  <div className="event-time">{e.start}</div>
                  <div>
                    <div className="event-title">{e.title}</div>
                    <div className="event-sub">{label}{e.notes ? ` · ${e.notes}` : ''}</div>
                  </div>
                  <button className="del-btn" onClick={() => deleteEvent(e.id)} style={{ marginLeft: 'auto' }}>×</button>
                </div>
              )
            })}
          </div>

          <div className="side-card">
            <h3>Add Event</h3>
            <div className="form-row">
              <label>Title</label>
              <input className="form-input" placeholder="Event name" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addEvent()} />
            </div>
            <div className="form-row">
              <label>Date</label>
              <input className="form-input" type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text3)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Start</label>
                <input className="form-input" type="time" value={form.start} onChange={e => setForm(p => ({ ...p, start: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text3)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>End</label>
                <input className="form-input" type="time" value={form.end} onChange={e => setForm(p => ({ ...p, end: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <label>Category</label>
              <select className="form-select" style={{ width: '100%' }} value={form.cat} onChange={e => setForm(p => ({ ...p, cat: e.target.value }))}>
                <option value="personal">Personal</option>
                <option value="work">Work</option>
                <option value="google">Study</option>
              </select>
            </div>
            <div className="form-row">
              <label>Notes</label>
              <input className="form-input" placeholder="Optional" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
            <button className="btn-primary" onClick={addEvent} style={{ width: '100%' }}>Add Event</button>
          </div>
        </div>
      </div>
    </div>
  )
}
