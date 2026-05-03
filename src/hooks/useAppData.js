import { useState, useEffect } from 'react'
import { defaultState } from '../state/defaultState.js'
import * as db from '../services/db.js'

const emptyUserState = {
  ...defaultState,
  events: [],
  expenses: [],
  income: [],
  habits: [],
  habitChecks: {},
  pillars: [],
  content: [],
}

export function useAppData(user) {
  const [state, setStateRaw] = useState(defaultState)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) {
      setStateRaw(defaultState)
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    db.fetchAll(user.id)
      .then(data => { setStateRaw(data); setLoading(false) })
      .catch(err => {
        console.error('fetchAll failed', err)
        setStateRaw(emptyUserState)
        setError(err.message || 'Failed to load dashboard data')
        setLoading(false)
      })
  }, [user?.id])

  function setState(updater) {
    setStateRaw(prev => typeof updater === 'function' ? updater(prev) : updater)
  }

  return { state, setState, loading, error, isDemo: !user }
}
