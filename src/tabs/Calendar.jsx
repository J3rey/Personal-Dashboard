import { useState, useRef, useEffect } from 'react'
import { useGoogleCalendar } from '../hooks/useGoogleCalendar.js'

let _nextId = 100
const uid = () => _nextId++

const CAT_DOT = { google: 'var(--blue)', personal: 'var(--green)', work: 'var(--purple)' }
const CATS_LIST = [
  { value: 'personal', label: 'Personal', color: 'var(--green)',  bg: 'var(--green-light)'  },
  { value: 'work',     label: 'Work',     color: 'var(--purple)', bg: 'var(--purple-light)' },
  { value: 'google',   label: 'Study',    color: 'var(--blue)',   bg: 'var(--blue-light)'   },
]

function gcalEvStyle(e) {
  if (!e.calendarColor) return {}
  return { background: e.calendarColor + '22', color: e.calendarColor }
}

const HOUR_H  = 56
const START_H = 0
const END_H   = 24
const HOURS   = Array.from({ length: END_H - START_H }, (_, i) => i + START_H)

function toDs(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDateLabel(ds) {
  return new Date(ds + 'T12:00:00').toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function hLabel(h) {
  if (h === 0)  return '12 AM'
  if (h < 12)   return `${h} AM`
  if (h === 12) return '12 PM'
  return `${h - 12} PM`
}

function calcPos(e) {
  const [sh, sm] = e.start.split(':').map(Number)
  const startMin = sh * 60 + sm
  let endMin = startMin + 60
  if (e.end) { const [eh, em] = e.end.split(':').map(Number); endMin = eh * 60 + em }
  return {
    top:    (startMin - START_H * 60) * (HOUR_H / 60),
    height: Math.max((endMin - startMin) * (HOUR_H / 60), 22),
  }
}

// ── Event detail popover ───────────────────────────────────────────────────────
function EventPopup({ event, x, y, onClose, onDelete }) {
  const ref = useRef(null)
  const cat       = CATS_LIST.find(c => c.value === event.cat)
  const evColor   = event.calendarColor || cat?.color || 'var(--accent)'
  const evBg      = event.calendarColor ? event.calendarColor + '22' : cat?.bg || 'var(--surface2)'
  const evLabel   = event.calendarName  || cat?.label || event.cat
  const isGcal    = !!event.calendarColor

  useEffect(() => {
    function onMouse(e) { if (ref.current && !ref.current.contains(e.target)) onClose() }
    function onKey(e) { if (e.key === 'Escape') onClose() }
    // delay so the opening click doesn't immediately close
    const t = setTimeout(() => document.addEventListener('mousedown', onMouse), 0)
    window.addEventListener('keydown', onKey)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', onMouse); window.removeEventListener('keydown', onKey) }
  }, [])

  // smart positioning — flip if too close to edge
  const W = 268, H = 320
  const left = x + W + 16 > window.innerWidth  ? x - W - 8 : x + 12
  const top  = y + H      > window.innerHeight ? window.innerHeight - H - 12 : y

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed', left, top, zIndex: 2000,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: '13px', width: `${W}px`,
        boxShadow: '0 8px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)',
        animation: 'slideUp 0.14s ease',
        overflow: 'hidden',
      }}
    >
      {/* Colour header band */}
      <div style={{ height: '5px', background: evColor }} />

      <div style={{ padding: '14px 16px 16px' }}>
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px', gap: '8px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>{event.title}</div>
          <button
            onClick={onClose}
            style={{ background: 'var(--surface2)', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', color: 'var(--text2)', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >×</button>
        </div>

        {/* Date */}
        <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '4px' }}>
          {new Date(event.date + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>

        {/* Time */}
        <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '10px' }}>
          {event.start ? `${event.start}${event.end ? ` – ${event.end}` : ''}` : 'All day'}
        </div>

        {/* Notes */}
        {event.notes && (
          <div style={{ fontSize: '12px', color: 'var(--text2)', background: 'var(--surface2)', borderRadius: '7px', padding: '8px 10px', marginBottom: '10px', lineHeight: 1.5, wordBreak: 'break-word', overflowWrap: 'break-word', maxHeight: '120px', overflowY: 'auto' }}>
            {event.notes}
          </div>
        )}

        {/* Category chip + event type */}
        <div style={{ marginBottom: '12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', padding: '3px 9px', borderRadius: '10px', background: evBg, color: evColor, fontWeight: 500 }}>
            {evLabel}
          </span>
          <span style={{ fontSize: '11px', padding: '3px 9px', borderRadius: '10px', background: 'var(--surface2)', color: 'var(--text3)', fontWeight: 500 }}>
            {event.isAllDay ? 'All Day' : 'Event'}
          </span>
        </div>

        {/* Actions */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
          {isGcal && <span style={{ fontSize: '11px', color: 'var(--text3)', alignSelf: 'center', marginRight: 'auto' }}>Google Calendar</span>}
          <button
            onClick={() => !isGcal && onDelete(event.id)}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', padding: '5px 12px', cursor: isGcal ? 'default' : 'pointer', fontSize: '12px', color: isGcal ? 'var(--text3)' : 'var(--red)', transition: 'all 0.1s', opacity: isGcal ? 0.4 : 1 }}
            onMouseEnter={e => { if (!isGcal) { e.currentTarget.style.background = '#fff0f0'; e.currentTarget.style.borderColor = 'var(--red)' } }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'var(--border)' }}
          >Delete</button>
        </div>
      </div>
    </div>
  )
}

// ── Create-event modal ─────────────────────────────────────────────────────────
function CreateEventModal({ date, onClose, onSave }) {
  const [title, setTitle]     = useState('')
  const [allDay, setAllDay]   = useState(false)
  const [start, setStart]     = useState('09:00')
  const [end, setEnd]         = useState('10:00')
  const [cat, setCat]         = useState('personal')
  const [notes, setNotes]     = useState('')
  const [shaking, setShaking] = useState(false)
  const titleRef = useRef(null)

  useEffect(() => {
    titleRef.current?.focus()
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function handleSave() {
    if (!title.trim()) {
      setShaking(true); setTimeout(() => setShaking(false), 350)
      titleRef.current?.focus(); return
    }
    onSave({ title: title.trim(), date, start: allDay ? '' : start, end: allDay ? '' : end, cat, notes })
  }

  const selectedCat = CATS_LIST.find(c => c.value === cat)

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.15s ease' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '18px', padding: '28px', width: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', animation: 'slideUp 0.18s cubic-bezier(0.34,1.2,0.64,1)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '22px' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px' }}>New Event</div>
            <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '3px' }}>{formatDateLabel(date)}</div>
          </div>
          <button onClick={onClose} style={{ background: 'var(--surface2)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', fontSize: '15px', color: 'var(--text2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        <div className={shaking ? 'modal-shake' : ''} style={{ marginBottom: '14px' }}>
          <input ref={titleRef} className="form-input" placeholder="Event title" value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSave() }} style={{ fontSize: '15px', padding: '9px 13px', fontWeight: 500 }} />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text2)', marginBottom: '14px', cursor: 'pointer', userSelect: 'none' }}>
          <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} style={{ accentColor: 'var(--accent)', width: '14px', height: '14px' }} />
          All day
        </label>

        {!allDay && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
            {[['Start', start, setStart], ['End', end, setEnd]].map(([lbl, val, set]) => (
              <div key={lbl}>
                <div style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '5px' }}>{lbl}</div>
                <input className="form-input" type="time" value={val} onChange={e => set(e.target.value)} style={{ fontSize: '13px', padding: '7px 10px' }} />
              </div>
            ))}
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Category</div>
          <div style={{ display: 'flex', gap: '7px' }}>
            {CATS_LIST.map(c => {
              const active = cat === c.value
              return (
                <button key={c.value} onClick={() => setCat(c.value)} style={{ padding: '6px 14px', borderRadius: '20px', border: `1.5px solid ${active ? c.color : 'var(--border)'}`, background: active ? c.bg : 'transparent', color: active ? c.color : 'var(--text2)', fontSize: '12px', fontWeight: active ? 600 : 400, cursor: 'pointer', transition: 'all 0.12s', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: active ? c.color : 'var(--border2)', flexShrink: 0 }} />
                  {c.label}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '5px' }}>Notes</div>
          <input className="form-input" placeholder="Add a note..." value={notes} onChange={e => setNotes(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSave() }} style={{ fontSize: '12px', padding: '7px 11px' }} />
        </div>

        <div style={{ height: '3px', borderRadius: '2px', background: selectedCat?.color || 'var(--accent)', marginBottom: '20px', opacity: 0.7, transition: 'background 0.15s' }} />

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-ghost" onClick={onClose} style={{ flex: 1, padding: '9px 0', fontSize: '13px' }}>Cancel</button>
          <button onClick={handleSave} style={{ flex: 2, padding: '9px 0', fontSize: '13px', fontWeight: 600, background: selectedCat?.color || 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'} onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
            Add Event
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Month View ────────────────────────────────────────────────────────────────
function MonthView({ calViewDate, events, onSelectDay, onSelectEvent }) {
  const today = new Date()
  const todayStr = toDs(today)
  const y = calViewDate.getFullYear(), m = calViewDate.getMonth()
  const firstDay = (new Date(y, m, 1).getDay() + 6) % 7
  const daysInMonth = new Date(y, m + 1, 0).getDate()

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push({ d: new Date(y, m, 1 - firstDay + i), other: true })
  for (let day = 1; day <= daysInMonth; day++) cells.push({ d: new Date(y, m, day), other: false })
  const rem = (7 - ((firstDay + daysInMonth) % 7)) % 7
  for (let i = 1; i <= rem; i++) cells.push({ d: new Date(y, m + 1, i), other: true })

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
          <div key={i} className={`cal-cell${cell.other ? ' other-month' : ''}${isToday ? ' today' : ''}`} onClick={() => onSelectDay(ds)}>
            <div className="cal-date">{cell.d.getDate()}</div>
            {evs.slice(0, 3).map(e => (
              <div
                key={e.id}
                className={`cal-event${e.calendarColor ? '' : ' ' + e.cat}`}
                style={gcalEvStyle(e)}
                onClick={ev => { ev.stopPropagation(); onSelectEvent(ev, e) }}
              >
                {e.start ? e.start + ' ' : ''}{e.title}
              </div>
            ))}
            {evs.length > 3 && <div style={{ fontSize: '9px', color: 'var(--text3)' }}>+{evs.length - 3} more</div>}
          </div>
        )
      })}
    </div>
  )
}

// ── Week View ─────────────────────────────────────────────────────────────────
function WeekView({ calViewDate, events, onSelectDay, onSelectEvent }) {
  const today    = new Date()
  const todayStr = toDs(today)
  const d        = calViewDate
  const mon      = new Date(d)
  mon.setDate(d.getDate() - (d.getDay() + 6) % 7)
  const dates     = Array.from({ length: 7 }, (_, i) => { const x = new Date(mon); x.setDate(mon.getDate() + i); return x })
  const dayLabels = ['MON','TUE','WED','THU','FRI','SAT','SUN']

  const nowMin     = today.getHours() * 60 + today.getMinutes()
  const nowTop     = (nowMin - START_H * 60) * (HOUR_H / 60)
  const nowVisible = nowMin >= START_H * 60 && nowMin < END_H * 60

  const allDayMap = {}
  dates.forEach(dt => { const ds = toDs(dt); allDayMap[ds] = events.filter(e => e.date === ds && !e.start) })
  const hasAllDay = dates.some(dt => allDayMap[toDs(dt)].length > 0)

  return (
    <div className="gcal-wrap">
      {/* Sticky day headers */}
      <div className="gcal-hdr">
        <div className="gcal-gutter" />
        {dates.map((dt, i) => {
          const isT = toDs(dt) === todayStr
          return (
            <div key={i} className="gcal-col-hdr">
              <span className="gcal-col-hdr-day">{dayLabels[i]}</span>
              <span className={'gcal-col-hdr-num' + (isT ? ' is-today' : '')}>{dt.getDate()}</span>
            </div>
          )
        })}
      </div>

      {/* All-day strip */}
      {hasAllDay && (
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
          <div className="gcal-gutter gcal-allday-label">all‑day</div>
          {dates.map((dt, i) => {
            const ds = toDs(dt)
            return (
              <div key={i} style={{ flex: 1, borderLeft: '1px solid var(--border)', padding: '3px 3px', display: 'flex', flexWrap: 'wrap', gap: '2px', minHeight: '26px' }}>
                {allDayMap[ds].map(e => (
                  <div key={e.id} className={`gcal-allday-chip gcal-ev-${e.cat}`}
                    onClick={ev => { ev.stopPropagation(); onSelectEvent(ev, e) }}>
                    {e.title}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {/* Scrollable body */}
      <div className="gcal-body">
        <div className="gcal-time-col">
          {HOURS.map((h, idx) => (
            <div key={h} className="gcal-hour-label" style={{ height: HOUR_H }}>
              {idx > 0 && <span>{hLabel(h)}</span>}
            </div>
          ))}
        </div>

        {dates.map((dt, i) => {
          const ds   = toDs(dt)
          const isT  = ds === todayStr
          const evs  = events.filter(e => e.date === ds && e.start)
          return (
            <div key={i} className={'gcal-day-col' + (isT ? ' gcal-today-col' : '')} onClick={() => onSelectDay(ds)}>
              {HOURS.map(h => <div key={h} className="gcal-hour-line" style={{ height: HOUR_H }} />)}
              {isT && nowVisible && (
                <div className="gcal-now-line" style={{ top: nowTop }}><div className="gcal-now-dot" /></div>
              )}
              {evs.map(e => {
                const { top, height } = calcPos(e)
                return (
                  <div key={e.id} className={`gcal-event${e.calendarColor ? '' : ' gcal-ev-' + e.cat}`} style={{ top, height, ...gcalEvStyle(e) }}
                    onClick={ev => { ev.stopPropagation(); onSelectEvent(ev, e) }}>
                    <div className="gcal-ev-title">{e.title}</div>
                    {height > 34 && <div className="gcal-ev-time">{e.start}{e.end ? `–${e.end}` : ''}</div>}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Day View ──────────────────────────────────────────────────────────────────
function DayView({ calViewDate, events, onSelectDay, onSelectEvent }) {
  const ds      = toDs(calViewDate)
  const today   = new Date()
  const isToday = ds === toDs(today)
  const allDay  = events.filter(e => e.date === ds && !e.start)
  const timed   = events.filter(e => e.date === ds && e.start)

  const nowMin     = today.getHours() * 60 + today.getMinutes()
  const nowTop     = (nowMin - START_H * 60) * (HOUR_H / 60)
  const nowVisible = isToday && nowMin >= START_H * 60 && nowMin < END_H * 60

  return (
    <div className="gcal-wrap">
      {/* Day header */}
      <div className="gcal-hdr" style={{ cursor: 'default' }}>
        <div className="gcal-gutter" />
        <div className="gcal-col-hdr" style={{ flex: 1 }}>
          <span className="gcal-col-hdr-day">
            {calViewDate.toLocaleDateString('en-AU', { weekday: 'long' }).toUpperCase()}
          </span>
          <span className={'gcal-col-hdr-num' + (isToday ? ' is-today' : '')} style={{ fontSize: '24px', width: '40px', height: '40px' }}>
            {calViewDate.getDate()}
          </span>
        </div>
      </div>

      {/* All-day strip */}
      {allDay.length > 0 && (
        <div className="gcal-allday-strip">
          <div className="gcal-gutter gcal-allday-label">all‑day</div>
          <div className="gcal-allday-events">
            {allDay.map(e => (
              <div key={e.id} className={`gcal-allday-chip gcal-ev-${e.cat}`}
                onClick={ev => { ev.stopPropagation(); onSelectEvent(ev, e) }}>
                {e.title}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scrollable body */}
      <div className="gcal-body">
        <div className="gcal-time-col">
          {HOURS.map((h, idx) => (
            <div key={h} className="gcal-hour-label" style={{ height: HOUR_H }}>
              {idx > 0 && <span>{hLabel(h)}</span>}
            </div>
          ))}
        </div>
        <div className="gcal-day-col gcal-day-col--single" style={{ flex: 1 }} onClick={() => onSelectDay(ds)}>
          {HOURS.map(h => <div key={h} className="gcal-hour-line" style={{ height: HOUR_H }} />)}
          {nowVisible && (
            <div className="gcal-now-line" style={{ top: nowTop }}><div className="gcal-now-dot" /></div>
          )}
          {timed.map(e => {
            const { top, height } = calcPos(e)
            return (
              <div key={e.id} className={`gcal-event${e.calendarColor ? '' : ' gcal-ev-' + e.cat}`} style={{ top, height, ...gcalEvStyle(e) }}
                onClick={ev => { ev.stopPropagation(); onSelectEvent(ev, e) }}>
                <div className="gcal-ev-title">{e.title}</div>
                {height > 34 && <div className="gcal-ev-time">{e.start}{e.end ? ` – ${e.end}` : ''}{e.notes ? ` · ${e.notes}` : ''}</div>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Main Calendar ──────────────────────────────────────────────────────────────
export default function Calendar({ state, setState }) {
  const { isConnected, events: gcalEvents, calendars, loading: gcalLoading, connect, disconnect } = useGoogleCalendar()

  const [calView, setCalView]         = useState('month')
  const [calViewDate, setCalViewDate] = useState(new Date())
  const [createModal, setCreateModal] = useState(null)
  const [eventPopup, setEventPopup]   = useState(null) // { event, x, y }
  const [hiddenCals, setHiddenCals]   = useState(new Set())
  const [form, setForm] = useState({ title: '', date: toDs(new Date()), start: '', end: '', cat: 'personal', notes: '' })

  const today    = new Date()
  const todayStr = toDs(today)

  function toggleCal(calId) {
    setHiddenCals(prev => {
      const next = new Set(prev)
      next.has(calId) ? next.delete(calId) : next.add(calId)
      return next
    })
  }

  const allEvents = (isConnected ? gcalEvents : state.events).filter(e => !hiddenCals.has(e.cat))

  function calNav(dir) {
    setCalViewDate(prev => {
      const d = new Date(prev)
      if (calView === 'month') return new Date(d.getFullYear(), d.getMonth() + dir, 1)
      d.setDate(d.getDate() + dir * (calView === 'week' ? 7 : 1))
      return d
    })
  }

  function handleSelectDay(ds) {
    setEventPopup(null)
    setCreateModal({ date: ds })
  }

  function handleSelectEvent(mouseEvt, event) {
    setCreateModal(null)
    setEventPopup({ event, x: mouseEvt.clientX, y: mouseEvt.clientY })
  }

  function saveEvent(data) {
    setState(prev => ({ ...prev, events: [...prev.events, { id: uid(), ...data }] }))
    setCreateModal(null)
  }

  function deleteEvent(id) {
    setState(prev => ({ ...prev, events: prev.events.filter(e => e.id !== id) }))
    setEventPopup(null)
  }

  function addEvent() {
    if (!form.title.trim() || !form.date) return
    setState(prev => ({
      ...prev,
      events: [...prev.events, { id: uid(), title: form.title.trim(), date: form.date, start: form.start, end: form.end, cat: form.cat, notes: form.notes }],
    }))
    setForm(prev => ({ ...prev, title: '', notes: '', start: '', end: '' }))
  }

  function getCalLabel() {
    if (calView === 'month') return calViewDate.toLocaleString('default', { month: 'long', year: 'numeric' })
    if (calView === 'week') {
      const mon = new Date(calViewDate)
      mon.setDate(calViewDate.getDate() - (calViewDate.getDay() + 6) % 7)
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
      return `${mon.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} — ${sun.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`
    }
    return calViewDate.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  const upcoming = allEvents
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
        <div className="cal-view-btns">
          {['month','week','day'].map(v => (
            <button key={v} className={'cal-view-btn' + (calView === v ? ' active' : '')} onClick={() => setCalView(v)}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px', paddingLeft: '8px', borderLeft: '1px solid var(--border)' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: isConnected ? '#4285f4' : '#ccc', display: 'inline-block', flexShrink: 0 }} />
            {isConnected ? (
              <>
                <span style={{ fontSize: '11px', color: 'var(--text2)' }}>
                  {gcalLoading ? 'Syncing…' : `${gcalEvents.length} events`}
                </span>
                <button className="btn-ghost" style={{ fontSize: '11px', padding: '2px 8px' }} onClick={disconnect}>Disconnect</button>
              </>
            ) : (
              <button className="btn-ghost" style={{ fontSize: '11px', padding: '2px 8px' }} onClick={connect}>Connect Google Calendar</button>
            )}
          </span>
        </div>
      </div>

      <div className="cal-sidebar">
        <div>
          {calView === 'month' && <MonthView calViewDate={calViewDate} events={allEvents} onSelectDay={handleSelectDay} onSelectEvent={handleSelectEvent} />}
          {calView === 'week'  && <WeekView  calViewDate={calViewDate} events={allEvents} onSelectDay={handleSelectDay} onSelectEvent={handleSelectEvent} />}
          {calView === 'day'   && <DayView   calViewDate={calViewDate} events={allEvents} onSelectDay={handleSelectDay} onSelectEvent={handleSelectEvent} />}
        </div>

        <div>
          <div className="side-card">
            <h3>Upcoming</h3>
            {upcoming.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text3)' }}>No upcoming events</div>
            ) : upcoming.map(e => {
              const label = new Date(e.date + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'short', month: 'short', day: 'numeric' })
              return (
                <div key={e.id} className="event-item" style={{ cursor: 'pointer' }} onClick={ev => handleSelectEvent(ev, e)}>
                  <div className="event-dot" style={{ background: e.calendarColor || CAT_DOT[e.cat] || 'var(--accent)' }} />
                  <div className="event-time">{e.start}</div>
                  <div style={{ flex: 1 }}>
                    <div className="event-title">{e.title}</div>
                    <div className="event-sub">{label}{e.calendarName ? ` · ${e.calendarName}` : ''}</div>
                  </div>
                </div>
              )
            })}
          </div>

          {isConnected && calendars.length > 0 && (
            <div className="side-card">
              <h3>My Calendars</h3>
              {calendars.map(cal => {
                const hidden = hiddenCals.has(cal.id)
                return (
                  <div
                    key={cal.id}
                    onClick={() => toggleCal(cal.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', cursor: 'pointer', opacity: hidden ? 0.4 : 1, userSelect: 'none' }}
                  >
                    <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: hidden ? 'var(--border2)' : (cal.backgroundColor ?? 'var(--accent)'), flexShrink: 0, transition: 'background 0.15s' }} />
                    <span style={{ fontSize: '12px', color: 'var(--text)', flex: 1 }}>{cal.summary}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text3)' }}>{hidden ? 'hidden' : ''}</span>
                  </div>
                )
              })}
            </div>
          )}

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

      {createModal && (
        <CreateEventModal date={createModal.date} onClose={() => setCreateModal(null)} onSave={saveEvent} />
      )}

      {eventPopup && (
        <EventPopup
          event={eventPopup.event}
          x={eventPopup.x}
          y={eventPopup.y}
          onClose={() => setEventPopup(null)}
          onDelete={deleteEvent}
        />
      )}
    </div>
  )
}
