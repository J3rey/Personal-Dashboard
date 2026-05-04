import { useState, useRef, useEffect } from 'react'
import { useGoogleCalendar } from '../hooks/useGoogleCalendar.js'

const HIDDEN_CALENDARS_KEY = 'dashboard.hiddenCalendars'

function readHiddenCalendars() {
  if (typeof window === 'undefined') return new Set()
  try {
    const saved = JSON.parse(window.localStorage.getItem(HIDDEN_CALENDARS_KEY) || '[]')
    return new Set(Array.isArray(saved) ? saved : [])
  } catch {
    return new Set()
  }
}

function saveHiddenCalendars(hiddenCalendars) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(HIDDEN_CALENDARS_KEY, JSON.stringify([...hiddenCalendars]))
  } catch {
    // Ignore storage failures so private browsing or quota issues do not break the calendar.
  }
}

function gcalEvStyle(e) {
  if (!e.calendarColor) return {}
  if (e.isTask) return { background: '#e8f0fe', color: '#1a1a18', fontWeight: 600 }
  return { background: e.calendarColor + '22', color: '#1a1a18' }
}

function eventDisplayRank(e) {
  if (!e.start && !e.isTask) return 0
  if (e.isTask) return 1
  return 2
}

function sortEventsForDisplay(a, b) {
  return (
    a.date.localeCompare(b.date) ||
    eventDisplayRank(a) - eventDisplayRank(b) ||
    (a.start || '').localeCompare(b.start || '') ||
    a.title.localeCompare(b.title)
  )
}

function eventKey(e) {
  return `${e.cat}:${e.id}:${e.date}:${e.start || ''}`
}

function EventLabel({ event, showTime = false }) {
  return (
    <span className="event-label">
      {event.isTask && <span className="task-marker" aria-hidden="true" />}
      {showTime && event.start && <span>{formatTime12(event.start)}</span>}
      <span className="event-label-title">{event.title}</span>
    </span>
  )
}

const HOUR_H  = 56
const START_H = 0
const END_H   = 24
const HOURS   = Array.from({ length: END_H - START_H }, (_, i) => i + START_H)

function toDs(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function hLabel(h) {
  if (h === 0)  return '12 AM'
  if (h < 12)   return `${h} AM`
  if (h === 12) return '12 PM'
  return `${h - 12} PM`
}

function formatTime12(time) {
  if (!time) return ''
  if (/\b(?:AM|PM)\b/i.test(time)) return time
  const [h, m = '00'] = time.split(':')
  const hour = Number(h)
  if (Number.isNaN(hour)) return time
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${m.padStart(2, '0')} ${suffix}`
}

function formatTimeRange12(start, end) {
  if (!start) return ''
  return end ? `${formatTime12(start)} - ${formatTime12(end)}` : formatTime12(start)
}

function calcPos(e) {
  const { startMin, endMin } = getEventMinutes(e)
  return {
    top:    (startMin - START_H * 60) * (HOUR_H / 60),
    height: Math.max((endMin - startMin) * (HOUR_H / 60), 22),
  }
}

function getEventMinutes(e) {
  const [sh, sm] = e.start.split(':').map(Number)
  const startMin = sh * 60 + sm
  let endMin = startMin + 60
  if (e.end) {
    const [eh, em] = e.end.split(':').map(Number)
    endMin = eh * 60 + em
  }
  if (endMin <= startMin) endMin = startMin + 60
  return { startMin, endMin }
}

function layoutTimedEvents(events) {
  const sorted = [...events].sort((a, b) => {
    const ar = getEventMinutes(a)
    const br = getEventMinutes(b)
    return ar.startMin - br.startMin || ar.endMin - br.endMin || a.title.localeCompare(b.title)
  })
  const layout = new Map()
  let group = []
  let groupEnd = -1

  function flushGroup() {
    if (!group.length) return
    const columnEnds = []
    const placed = group.map(event => {
      const { startMin, endMin } = getEventMinutes(event)
      let column = columnEnds.findIndex(end => end <= startMin)
      if (column === -1) {
        column = columnEnds.length
        columnEnds.push(endMin)
      } else {
        columnEnds[column] = endMin
      }
      return { event, column }
    })
    const columns = Math.max(columnEnds.length, 1)
    placed.forEach(({ event, column }) => layout.set(eventKey(event), { column, columns }))
    group = []
    groupEnd = -1
  }

  sorted.forEach(event => {
    const { startMin, endMin } = getEventMinutes(event)
    if (group.length && startMin >= groupEnd) flushGroup()
    group.push(event)
    groupEnd = Math.max(groupEnd, endMin)
  })
  flushGroup()

  return layout
}

function eventColumnStyle(layoutInfo) {
  if (!layoutInfo || layoutInfo.columns <= 1) return {}
  const widthPct = 100 / layoutInfo.columns
  return {
    left: `calc(${layoutInfo.column * widthPct}% + 3px)`,
    right: 'auto',
    width: `calc(${widthPct}% - 6px)`,
  }
}

// ── Event detail popover ───────────────────────────────────────────────────────
function EventPopup({ event, x, y, onClose }) {
  const ref = useRef(null)
  const evColor   = event.calendarColor || '#4a7c59'
  const evBg      = evColor + '22'
  const evLabel   = event.calendarName || event.cat

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
  const popupW = Math.min(W, window.innerWidth - 24)
  const rawLeft = x + popupW + 16 > window.innerWidth ? x - popupW - 8 : x + 12
  const left = Math.max(12, Math.min(rawLeft, window.innerWidth - popupW - 12))
  const top  = Math.max(12, Math.min(y, window.innerHeight - H - 12))

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed', left, top, zIndex: 2000,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: '13px', width: `${popupW}px`,
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
          <span style={{ fontSize: '11px', padding: '3px 9px', borderRadius: '10px', background: event.isTask ? '#e8f0fe' : 'var(--surface2)', color: event.isTask ? '#1a73e8' : 'var(--text3)', fontWeight: 500 }}>
            {event.isTask ? 'Task' : event.isAllDay ? 'All Day' : 'Event'}
          </span>
        </div>

        {/* Source */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: '11px', color: 'var(--text3)', alignSelf: 'center', marginRight: 'auto' }}>Google Calendar</span>
        </div>
      </div>
    </div>
  )
}

// ── Create-event modal ─────────────────────────────────────────────────────────
function CreateEventModal() {
  return null

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.15s ease' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '18px', padding: '28px', width: 'min(400px, calc(100vw - 24px))', maxHeight: 'calc(100vh - 24px)', overflowY: 'auto', overflowX: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', animation: 'slideUp 0.18s cubic-bezier(0.34,1.2,0.64,1)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '22px' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px' }}>New Event</div>
            <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '3px' }}>{date}</div>
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
          <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
            {[].map(c => {
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
        const evs = events.filter(e => e.date === ds).sort(sortEventsForDisplay)
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
                <EventLabel event={e} showTime />
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
  const taskMap = {}
  dates.forEach(dt => {
    const ds = toDs(dt)
    allDayMap[ds] = events.filter(e => e.date === ds && !e.start && !e.isTask).sort(sortEventsForDisplay)
    taskMap[ds] = events.filter(e => e.date === ds && e.isTask).sort(sortEventsForDisplay)
  })
  const hasAllDay = dates.some(dt => allDayMap[toDs(dt)].length > 0)
  const hasTasks = dates.some(dt => taskMap[toDs(dt)].length > 0)

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
              <div key={i} style={{ flex: 1, minWidth: 0, borderLeft: '1px solid var(--border)', padding: '3px 3px', display: 'flex', flexWrap: 'wrap', gap: '2px', minHeight: '26px', overflow: 'hidden' }}>
                {allDayMap[ds].map(e => (
                  <div key={e.id} className={`gcal-allday-chip${e.calendarColor ? '' : ' gcal-ev-' + e.cat}`}
                    style={{ ...gcalEvStyle(e), width: '100%', display: 'block' }}
                    onClick={ev => { ev.stopPropagation(); onSelectEvent(ev, e) }}>
                    <EventLabel event={e} />
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {hasTasks && (
        <div className="gcal-task-strip">
          <div className="gcal-gutter gcal-allday-label">tasks</div>
          {dates.map((dt, i) => {
            const ds = toDs(dt)
            return (
              <div key={i} className="gcal-task-cell">
                {taskMap[ds].map(e => (
                  <div key={e.id} className={`gcal-allday-chip${e.calendarColor ? '' : ' gcal-ev-' + e.cat}`}
                    style={{ ...gcalEvStyle(e), width: '100%', display: 'block' }}
                    onClick={ev => { ev.stopPropagation(); onSelectEvent(ev, e) }}>
                    <EventLabel event={e} />
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
          const evs  = events.filter(e => e.date === ds && e.start).sort(sortEventsForDisplay)
          const timedLayout = layoutTimedEvents(evs)
          return (
            <div key={i} className={'gcal-day-col' + (isT ? ' gcal-today-col' : '')} onClick={() => onSelectDay(ds)}>
              {HOURS.map(h => <div key={h} className="gcal-hour-line" style={{ height: HOUR_H }} />)}
              {isT && nowVisible && (
                <div className="gcal-now-line" style={{ top: nowTop }}><div className="gcal-now-dot" /></div>
              )}
              {evs.map(e => {
                const { top, height } = calcPos(e)
                return (
                  <div key={eventKey(e)} className={`gcal-event${e.calendarColor ? '' : ' gcal-ev-' + e.cat}`} style={{ top, height, ...eventColumnStyle(timedLayout.get(eventKey(e))), ...gcalEvStyle(e) }}
                    onClick={ev => { ev.stopPropagation(); onSelectEvent(ev, e) }}>
                    <div className="gcal-ev-title"><EventLabel event={e} /></div>
                    {height > 34 && <div className="gcal-ev-time">{formatTimeRange12(e.start, e.end)}</div>}
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
  const allDay  = events.filter(e => e.date === ds && !e.start && !e.isTask).sort(sortEventsForDisplay)
  const tasks   = events.filter(e => e.date === ds && e.isTask).sort(sortEventsForDisplay)
  const timed   = events.filter(e => e.date === ds && e.start).sort(sortEventsForDisplay)
  const timedLayout = layoutTimedEvents(timed)

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
              <div key={e.id} className={`gcal-allday-chip${e.calendarColor ? '' : ' gcal-ev-' + e.cat}`}
                style={{ ...gcalEvStyle(e), width: '100%', display: 'block' }}
                onClick={ev => { ev.stopPropagation(); onSelectEvent(ev, e) }}>
                <EventLabel event={e} />
              </div>
            ))}
          </div>
        </div>
      )}

      {tasks.length > 0 && (
        <div className="gcal-task-strip">
          <div className="gcal-gutter gcal-allday-label">tasks</div>
          <div className="gcal-allday-events">
            {tasks.map(e => (
              <div key={e.id} className={`gcal-allday-chip${e.calendarColor ? '' : ' gcal-ev-' + e.cat}`}
                style={{ ...gcalEvStyle(e), width: '100%', display: 'block' }}
                onClick={ev => { ev.stopPropagation(); onSelectEvent(ev, e) }}>
                <EventLabel event={e} />
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
              <div key={eventKey(e)} className={`gcal-event${e.calendarColor ? '' : ' gcal-ev-' + e.cat}`} style={{ top, height, ...eventColumnStyle(timedLayout.get(eventKey(e))), ...gcalEvStyle(e) }}
                onClick={ev => { ev.stopPropagation(); onSelectEvent(ev, e) }}>
                <div className="gcal-ev-title"><EventLabel event={e} /></div>
                {height > 34 && <div className="gcal-ev-time">{formatTimeRange12(e.start, e.end)}{e.notes ? ` · ${e.notes}` : ''}</div>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Main Calendar ──────────────────────────────────────────────────────────────
export default function Calendar() {
  const {
    isConnected,
    events: gcalEvents,
    calendars,
    loading: gcalLoading,
    authStatus,
    authError,
    reconnectNeeded,
    connect,
    disconnect,
  } = useGoogleCalendar()

  const [calView, setCalView]         = useState('month')
  const [calViewDate, setCalViewDate] = useState(new Date())
  const [eventPopup, setEventPopup]   = useState(null) // { event, x, y }
  const [hiddenCals, setHiddenCals]   = useState(readHiddenCalendars)

  const today    = new Date()
  const todayStr = toDs(today)

  function toggleCal(calId) {
    setHiddenCals(prev => {
      const next = new Set(prev)
      next.has(calId) ? next.delete(calId) : next.add(calId)
      saveHiddenCalendars(next)
      return next
    })
  }

  const allEvents = (isConnected ? gcalEvents : []).filter(e => !hiddenCals.has(e.cat))

  function calNav(dir) {
    setCalViewDate(prev => {
      const d = new Date(prev)
      if (calView === 'month') return new Date(d.getFullYear(), d.getMonth() + dir, 1)
      d.setDate(d.getDate() + dir * (calView === 'week' ? 7 : 1))
      return d
    })
  }

  function handleSelectDay() {
    setEventPopup(null)
  }

  function handleSelectEvent(mouseEvt, event) {
    const popupEvent = event.start
      ? { ...event, start: formatTime12(event.start), end: event.end ? formatTime12(event.end) : '' }
      : event
    setEventPopup({ event: popupEvent, x: mouseEvt.clientX, y: mouseEvt.clientY })
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
    .sort(sortEventsForDisplay)
    .slice(0, 5)
  const authButtonLabel = authStatus === 'reconnecting'
    ? 'Sign in again'
    : reconnectNeeded
      ? 'Reconnect Google Calendar'
      : 'Connect Google Calendar'

  return (
    <div className="panel">
      <div className="cal-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0, maxWidth: '100%' }}>
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
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px', paddingLeft: '8px', borderLeft: '1px solid var(--border)', flexWrap: 'wrap', minWidth: 0 }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: isConnected ? '#4285f4' : (reconnectNeeded || authStatus === 'reconnecting') ? '#fbbc04' : '#ccc', display: 'inline-block', flexShrink: 0 }} />
            {isConnected ? (
              <>
                <span style={{ fontSize: '11px', color: 'var(--text2)' }}>
                  {gcalLoading ? 'Syncing…' : `${gcalEvents.length} events`}
                </span>
                <button className="btn-ghost" style={{ fontSize: '11px', padding: '2px 8px' }} onClick={disconnect}>Disconnect</button>
              </>
            ) : (
              <>
                {authStatus === 'reconnecting' && (
                  <span style={{ fontSize: '11px', color: 'var(--text2)' }}>Reconnecting…</span>
                )}
                <button className="btn-ghost" style={{ fontSize: '11px', padding: '2px 8px' }} onClick={connect}>
                  {authButtonLabel}
                </button>
                {authError && (
                  <span style={{ fontSize: '11px', color: '#b45309', width: '100%' }}>{authError}</span>
                )}
              </>
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
                  <div className="event-dot" style={{ background: e.calendarColor || 'var(--accent)' }} />
                  <div className="event-time">{formatTime12(e.start)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="event-title"><EventLabel event={e} /></div>
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
                    <span style={{ fontSize: '12px', color: 'var(--text)', flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{cal.summary}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text3)' }}>{hidden ? 'hidden' : ''}</span>
                  </div>
                )
              })}
            </div>
          )}

        </div>
      </div>

      {eventPopup && (
        <EventPopup
          event={eventPopup.event}
          x={eventPopup.x}
          y={eventPopup.y}
          onClose={() => setEventPopup(null)}
        />
      )}
    </div>
  )
}
