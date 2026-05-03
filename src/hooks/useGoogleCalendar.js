import { useState, useEffect } from 'react'

const SCOPE        = 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/tasks.readonly'
const STORAGE_KEY  = 'gcal_was_connected'

function stripHtml(html) {
  const div = document.createElement('div')
  div.innerHTML = html
  return (div.textContent || div.innerText || '').trim()
}
const ONE_MONTH_AGO   = () => new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString()
const THREE_MONTHS_FW = () => new Date(new Date().getFullYear(), new Date().getMonth() + 3, 1).toISOString()

export function useGoogleCalendar() {
  const [accessToken, setAccessToken] = useState(null)
  const [events, setEvents]           = useState([])
  const [calendars, setCalendars]     = useState([])
  const [loading, setLoading]         = useState(false)
  const [tokenClient, setTokenClient] = useState(null)

  useEffect(() => {
    function init() {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        scope: SCOPE,
        callback: (resp) => {
          if (resp.error) return
          localStorage.setItem(STORAGE_KEY, '1')
          setAccessToken(resp.access_token)
        },
      })
      setTokenClient(client)
      // Silent re-auth if user previously connected
      if (localStorage.getItem(STORAGE_KEY)) {
        client.requestAccessToken({ prompt: 'none' })
      }
    }

    if (window.google?.accounts?.oauth2) {
      init()
    } else {
      const id = setInterval(() => {
        if (window.google?.accounts?.oauth2) { init(); clearInterval(id) }
      }, 200)
      return () => clearInterval(id)
    }
  }, [])

  useEffect(() => {
    if (accessToken) fetchAll(accessToken)
  }, [accessToken])

  async function fetchAll(token) {
    setLoading(true)
    try {
      const calRes  = await fetch(
        'https://www.googleapis.com/calendar/v3/users/me/calendarList',
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const calData = await calRes.json()
      const cals    = calData.items ?? []
      setCalendars(cals)

      const allEvents = []
      await Promise.all(cals.map(async (cal) => {
        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events` +
          `?timeMin=${ONE_MONTH_AGO()}&timeMax=${THREE_MONTHS_FW()}&maxResults=250&orderBy=startTime&singleEvents=true`
        const evRes  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        const evData = await evRes.json()
        ;(evData.items ?? []).forEach(ev => {
          allEvents.push({
            id:            ev.id,
            title:         ev.summary ?? '(no title)',
            date:          (ev.start.date || ev.start.dateTime || '').slice(0, 10),
            start:         ev.start.dateTime ? ev.start.dateTime.slice(11, 16) : '',
            end:           ev.end?.dateTime  ? ev.end.dateTime.slice(11, 16)  : '',
            isAllDay:      !!ev.start.date,
            cat:           cal.id,
            calendarName:  cal.summary,
            calendarColor: cal.backgroundColor ?? '#4a7c59',
            notes:         ev.description ? stripHtml(ev.description) : '',
          })
        })
      }))
      // Fetch tasks
      const listsRes  = await fetch(
        'https://tasks.googleapis.com/tasks/v1/users/@me/lists',
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const listsData = await listsRes.json()
      const taskLists = listsData.items ?? []

      await Promise.all(taskLists.map(async (list) => {
        const url = `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(list.id)}/tasks` +
          `?showCompleted=false&maxResults=100`
        const tasksRes  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        const tasksData = await tasksRes.json()
        const today = new Date().toISOString().split('T')[0]
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

  function connect() { tokenClient?.requestAccessToken() }

  function disconnect() {
    if (accessToken) window.google?.accounts.oauth2.revoke(accessToken, () => {})
    localStorage.removeItem(STORAGE_KEY)
    setAccessToken(null)
    setEvents([])
    setCalendars([])
  }

  return {
    isConnected: !!accessToken,
    events,
    calendars,
    loading,
    connect,
    disconnect,
  }
}
