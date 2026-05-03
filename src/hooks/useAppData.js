import { useState, useEffect } from 'react'
import { defaultState } from '../state/defaultState.js'
import * as db from '../services/db.js'

export function useAppData(user) {
  const [state, setStateRaw] = useState(defaultState)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) {
      setStateRaw(defaultState)
      return
    }
    setLoading(true)
    db.fetchAll(user.id)
      .then(data => { setStateRaw(data); setLoading(false) })
      .catch(err => { console.error('fetchAll failed', err); setLoading(false) })
  }, [user?.id])

  function setState(updater) {
    setStateRaw(prev => typeof updater === 'function' ? updater(prev) : updater)
  }

  return { state, setState, loading, isDemo: !user }
}
