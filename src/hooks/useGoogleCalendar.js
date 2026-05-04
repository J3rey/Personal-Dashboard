import { useState, useEffect, useRef } from 'react'

const SCOPE        = 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/tasks.readonly'
const FLAG_KEY     = 'gcal_connected'   // permanent — user wants to stay connected
const TOKEN_KEY    = 'gcal_token'       // expires after 55 min
const EXPIRES_KEY  = 'gcal_expires'
const TOKEN_REFRESH_MARGIN_MS = 60 * 1000
const SILENT_RECONNECT_TIMEOUT_MS = 4000
const GOOGLE_CONFIG_ERROR = 'Google Calendar is not configured for this deployment.'

function stripHtml(html) {
  const div = document.createElement('div')
  div.innerHTML = html
  return (div.textContent || div.innerText || '').trim()
}

function toDs(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function expandAllDayDates(startDate, endDate) {
  const start = new Date(startDate + 'T12:00:00')
  const end = new Date((endDate || startDate) + 'T12:00:00')
  const dates = []
  for (const d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    dates.push(toDs(d))
  }
  return dates.length ? dates : [startDate]
}

const ONE_MONTH_AGO   = () => new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString()
const THREE_MONTHS_FW = () => new Date(new Date().getFullYear(), new Date().getMonth() + 3, 1).toISOString()

function wantsStoredConnection() {
  try {
    return localStorage.getItem(FLAG_KEY) === '1'
  } catch {
    return false
  }
}

function readStoredToken() {
  try {
    const token = localStorage.getItem(TOKEN_KEY)
    const expires = Number(localStorage.getItem(EXPIRES_KEY) || '0')
    if (token && Date.now() + TOKEN_REFRESH_MARGIN_MS < expires) return token
  } catch {}
  return null
}

function storeToken(resp) {
  const expiresInMs = Number(resp.expires_in || 3600) * 1000
  const expiresAt = Date.now() + Math.max(expiresInMs - TOKEN_REFRESH_MARGIN_MS, TOKEN_REFRESH_MARGIN_MS)

  localStorage.setItem(FLAG_KEY, '1')
  localStorage.setItem(TOKEN_KEY, resp.access_token)
  localStorage.setItem(EXPIRES_KEY, String(expiresAt))
}

function clearStoredToken({ keepConnectionPreference = false } = {}) {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(EXPIRES_KEY)
  if (!keepConnectionPreference) localStorage.removeItem(FLAG_KEY)
}

export function useGoogleCalendar() {
  const [accessToken, setAccessToken] = useState(() => {
    return readStoredToken()
  })
  const [events, setEvents]       = useState([])
  const [calendars, setCalendars] = useState([])
  const [loading, setLoading]     = useState(false)
  const [authError, setAuthError] = useState('')
  const [authStatus, setAuthStatus] = useState(() => {
    if (readStoredToken()) return 'connected'
    if (wantsStoredConnection()) return 'reconnecting'
    return 'disconnected'
  })
  const clientRef                 = useRef(null)
  const reconnectTimerRef          = useRef(null)

  // Fetch calendar data whenever we have a valid token
  useEffect(() => {
    if (accessToken) fetchAll(accessToken)
  }, [accessToken])

  useEffect(() => {
    return () => clearReconnectTimer()
  }, [])

  // Init GIS token client
  useEffect(() => {
    function init() {
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
      if (!clientId) {
        clearReconnectTimer()
        setAuthError(GOOGLE_CONFIG_ERROR)
        setAuthStatus('needsInteraction')
        return
      }

      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPE,
        error_callback: (err) => {
          clearReconnectTimer()
          console.warn('GCal popup error', err)
          setAuthError('Google sign-in could not open. Allow pop-ups for this site, then try again.')
          setAuthStatus(wantsStoredConnection() ? 'needsInteraction' : 'disconnected')
        },
        callback: (resp) => {
          clearReconnectTimer()
          if (resp.error || !resp.access_token) {
            console.warn('GCal auth error', resp.error || resp)
            clearStoredToken({ keepConnectionPreference: wantsStoredConnection() })
            resetCalendarState()
            setAuthError('Google Calendar needs you to sign in again.')
            setAuthStatus(wantsStoredConnection() ? 'needsInteraction' : 'disconnected')
            return
          }
          storeToken(resp)
          setAuthError('')
          setAuthStatus('connected')
          setAccessToken(resp.access_token)
        },
      })
      clientRef.current = client

      const storedToken = readStoredToken()
      if (storedToken) {
        clearReconnectTimer()
        setAuthError('')
        setAccessToken(storedToken)
        setAuthStatus('connected')
      } else if (wantsStoredConnection()) {
        requestSilentReconnect()
      }
    }

    if (window.google?.accounts?.oauth2) {
      init()
    } else {
      if (wantsStoredConnection()) startReconnectTimer()
      const id = setInterval(() => {
        if (window.google?.accounts?.oauth2) { init(); clearInterval(id) }
      }, 200)
      return () => clearInterval(id)
    }
  }, [])

  async function fetchAll(token) {
    setLoading(true)
    try {
      const calRes  = await fetch(
        'https://www.googleapis.com/calendar/v3/users/me/calendarList',
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const calData = await calRes.json()
      if (calRes.status === 401 || calData.error?.code === 401) {
        handleExpiredToken()
        return
      }
      if (calData.error) { console.error('Calendar API error', calData.error); return }
      const cals = calData.items ?? []
      setCalendars(cals)

      const allEvents = []
      await Promise.all(cals.map(async (cal) => {
        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events` +
          `?timeMin=${ONE_MONTH_AGO()}&timeMax=${THREE_MONTHS_FW()}&maxResults=250&orderBy=startTime&singleEvents=true`
        const evRes  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        const evData = await evRes.json()
        ;(evData.items ?? []).forEach(ev => {
          const base = {
            title:         ev.summary ?? '(no title)',
            isTask:        false,
            cat:           cal.id,
            calendarName:  cal.summary,
            calendarColor: cal.backgroundColor ?? '#4a7c59',
            notes:         ev.description ? stripHtml(ev.description) : '',
          }
          if (ev.start?.date) {
            expandAllDayDates(ev.start.date, ev.end?.date).forEach(date => {
              allEvents.push({
                ...base,
                id:       `${ev.id}_${date}`,
                date,
                start:    '',
                end:      '',
                isAllDay: true,
              })
            })
            return
          }
          allEvents.push({
            ...base,
            id:       ev.id,
            date:     (ev.start?.dateTime || '').slice(0, 10),
            start:    ev.start?.dateTime ? ev.start.dateTime.slice(11, 16) : '',
            end:      ev.end?.dateTime  ? ev.end.dateTime.slice(11, 16)  : '',
            isAllDay: false,
          })
        })
      }))

      // Fetch tasks
      const listsRes  = await fetch(
        'https://tasks.googleapis.com/tasks/v1/users/@me/lists',
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const listsData = await listsRes.json()
      const taskLists = listsData.error ? [] : (listsData.items ?? [])

      const today = toDs(new Date())
      await Promise.all(taskLists.map(async (list) => {
        const url = `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(list.id)}/tasks` +
          `?showCompleted=false&maxResults=100`
        const tasksRes  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        const tasksData = await tasksRes.json()
        ;(tasksData.items ?? []).forEach(task => {
          allEvents.push({
            id:            task.id,
            title:         task.title ?? '(no title)',
            date:          task.due ? task.due.slice(0, 10) : today,
            start:         '',
            end:           '',
            isAllDay:      true,
            isTask:        true,
            cat:           `task_${list.id}`,
            calendarName:  list.title,
            calendarColor: '#1a73e8',
            notes:         task.notes ?? '',
          })
        })
      }))

      setEvents(allEvents)
    } catch (err) {
      console.error('Google Calendar fetch failed', err)
    } finally {
      setLoading(false)
    }
  }

  function clearReconnectTimer() {
    if (!reconnectTimerRef.current) return
    window.clearTimeout(reconnectTimerRef.current)
    reconnectTimerRef.current = null
  }

  function resetCalendarState() {
    setAccessToken(null)
    setEvents([])
    setCalendars([])
  }

  function startReconnectTimer() {
    clearReconnectTimer()
    reconnectTimerRef.current = window.setTimeout(() => {
      reconnectTimerRef.current = null
      if (readStoredToken()) return
      resetCalendarState()
      setAuthError('Google Calendar needs you to sign in again.')
      setAuthStatus(wantsStoredConnection() ? 'needsInteraction' : 'disconnected')
    }, SILENT_RECONNECT_TIMEOUT_MS)
  }

  function requestSilentReconnect() {
    if (clientRef.current) {
      setAuthStatus('reconnecting')
      startReconnectTimer()
      clientRef.current.requestAccessToken({ prompt: 'none' })
    } else {
      setAuthStatus('needsInteraction')
    }
  }

  function requestInteractiveToken() {
    clearReconnectTimer()
    setAuthError('')
    setAuthStatus('reconnecting')
    try {
      clientRef.current.requestAccessToken({ prompt: 'select_account consent' })
    } catch (err) {
      console.warn('GCal interactive auth failed', err)
      setAuthError('Google sign-in could not open. Allow pop-ups for this site, then try again.')
      setAuthStatus('needsInteraction')
    }
  }

  function handleExpiredToken() {
    clearStoredToken({ keepConnectionPreference: true })
    resetCalendarState()
    requestSilentReconnect()
  }

  function connect() {
    localStorage.setItem(FLAG_KEY, '1')
    clearStoredToken({ keepConnectionPreference: true })
    resetCalendarState()

    if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) {
      setAuthError(GOOGLE_CONFIG_ERROR)
      setAuthStatus('needsInteraction')
      return
    }

    if (clientRef.current) {
      requestInteractiveToken()
    } else {
      setAuthError('Google sign-in is still loading. Try again in a moment.')
      setAuthStatus('needsInteraction')
    }
  }

  function disconnect() {
    clearReconnectTimer()
    if (accessToken) window.google?.accounts.oauth2.revoke(accessToken, () => {})
    clearStoredToken()
    resetCalendarState()
    setAuthError('')
    setAuthStatus('disconnected')
  }

  return {
    isConnected: !!accessToken,
    events,
    calendars,
    loading,
    authStatus,
    authError,
    reconnectNeeded: authStatus === 'needsInteraction',
    connect,
    disconnect,
  }
}
