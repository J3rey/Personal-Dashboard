import { supabase } from '../lib/supabase.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function dateFromWeekStartAndDay(weekStart, dayIndex) {
  const d = new Date(weekStart + 'T12:00:00')
  d.setDate(d.getDate() + dayIndex)
  return d.toISOString().split('T')[0]
}

function weekStartAndDayFromDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  const dayIndex = (d.getDay() + 6) % 7
  const mon = new Date(d)
  mon.setDate(d.getDate() - dayIndex)
  return { weekStart: mon.toISOString().split('T')[0], dayIndex }
}

// ── Calendar ──────────────────────────────────────────────────────────────────

export async function fetchEvents(userId) {
  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('user_id', userId)
    .order('date')
  if (error) throw error
  return (data ?? []).map(e => ({
    id: e.id, title: e.title, date: e.date,
    start: e.start ?? '', end: e.end ?? '',
    cat: e.cat, notes: e.notes ?? '',
  }))
}

export async function insertEvent(userId, event) {
  const { data, error } = await supabase
    .from('calendar_events')
    .insert({
      user_id: userId, title: event.title, date: event.date,
      start: event.start || null, end: event.end || null,
      cat: event.cat, notes: event.notes,
    })
    .select().single()
  if (error) throw error
  return { ...event, id: data.id }
}

export async function deleteEvent(id) {
  const { error } = await supabase.from('calendar_events').delete().eq('id', id)
  if (error) throw error
}

// ── Finance: transactions ─────────────────────────────────────────────────────

export async function fetchTransactions(userId) {
  const { data, error } = await supabase
    .from('finance_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('date')
    .order('sort_order')
  if (error) throw error
  return (data ?? []).map(tx => {
    if (tx.row_type === 'header') return { id: tx.id, isHeader: true, label: tx.label, date: tx.date }
    if (tx.row_type === 'end')    return { id: tx.id, isEnd: true,    label: tx.label, date: tx.date, headerId: tx.header_id }
    return {
      id: tx.id, date: tx.date, cat: tx.cat, detail: tx.detail,
      cost: tx.cost, type: tx.tx_type, person: tx.person ?? '',
    }
  })
}

export async function insertTransaction(userId, tx, sortOrder) {
  const row = tx.isHeader
    ? { user_id: userId, date: tx.date, row_type: 'header', label: tx.label, sort_order: sortOrder }
    : tx.isEnd
    ? { user_id: userId, date: tx.date, row_type: 'end', label: tx.label, header_id: tx.headerId ?? null, sort_order: sortOrder }
    : { user_id: userId, date: tx.date, row_type: 'expense', cat: tx.cat, detail: tx.detail, cost: tx.cost, tx_type: tx.type, person: tx.person, sort_order: sortOrder }
  const { data, error } = await supabase.from('finance_transactions').insert(row).select().single()
  if (error) throw error
  return data.id
}

export async function updateTransaction(id, changes) {
  const mapped = { ...changes }
  if ('type' in mapped) { mapped.tx_type = mapped.type; delete mapped.type }
  const { error } = await supabase.from('finance_transactions').update(mapped).eq('id', id)
  if (error) throw error
}

export async function deleteTransaction(id) {
  const { error } = await supabase.from('finance_transactions').delete().eq('id', id)
  if (error) throw error
}

// ── Finance: income ───────────────────────────────────────────────────────────

export async function fetchIncome(userId) {
  const { data, error } = await supabase
    .from('finance_income')
    .select('*')
    .eq('user_id', userId)
    .order('date')
  if (error) throw error
  return (data ?? []).map(i => ({
    id: i.id, date: i.date, source: i.source,
    amount: i.amount, salary: i.is_salary,
  }))
}

export async function insertIncome(userId, inc) {
  const { data, error } = await supabase
    .from('finance_income')
    .insert({ user_id: userId, date: inc.date, source: inc.source, amount: inc.amount, is_salary: inc.salary })
    .select().single()
  if (error) throw error
  return data.id
}

export async function updateIncome(id, changes) {
  const mapped = {}
  if ('salary' in changes) { mapped.is_salary = changes.salary }
  if ('source' in changes) { mapped.source = changes.source }
  if ('amount' in changes) { mapped.amount = changes.amount }
  if ('date'   in changes) { mapped.date = changes.date }
  const { error } = await supabase.from('finance_income').update(mapped).eq('id', id)
  if (error) throw error
}

export async function deleteIncome(id) {
  const { error } = await supabase.from('finance_income').delete().eq('id', id)
  if (error) throw error
}

// ── Habits ────────────────────────────────────────────────────────────────────

export async function fetchHabits(userId) {
  const { data, error } = await supabase
    .from('habits')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order')
  if (error) throw error
  return (data ?? []).map(h => ({
    id: h.id, name: h.name, type: h.type, goal: h.goal, daily: h.is_daily,
  }))
}

export async function insertHabit(userId, habit, sortOrder) {
  const { data, error } = await supabase
    .from('habits')
    .insert({ user_id: userId, name: habit.name, type: habit.type, goal: habit.goal, is_daily: habit.daily, sort_order: sortOrder })
    .select().single()
  if (error) throw error
  return data.id
}

export async function deleteHabit(id) {
  const { error } = await supabase.from('habits').delete().eq('id', id)
  if (error) throw error
}

// ── Habit logs ────────────────────────────────────────────────────────────────

export async function fetchHabitLogs(userId) {
  const { data, error } = await supabase
    .from('habit_logs')
    .select('*')
    .eq('user_id', userId)
  if (error) throw error
  const habitChecks = {}
  ;(data ?? []).forEach(({ habit_id, week_start, day_index }) => {
    const dateStr = dateFromWeekStartAndDay(week_start, day_index)
    habitChecks[`${habit_id}_${dateStr}`] = true
  })
  return habitChecks
}

export async function toggleHabitLog(userId, habitId, dateStr, checked) {
  const { weekStart, dayIndex } = weekStartAndDayFromDate(dateStr)
  if (checked) {
    const { error } = await supabase.from('habit_logs').upsert(
      { user_id: userId, habit_id: habitId, week_start: weekStart, day_index: dayIndex, checked: true },
      { onConflict: 'habit_id,week_start,day_index' }
    )
    if (error) throw error
  } else {
    const { error } = await supabase.from('habit_logs')
      .delete()
      .match({ habit_id: habitId, week_start: weekStart, day_index: dayIndex })
    if (error) throw error
  }
}

// ── Content ───────────────────────────────────────────────────────────────────

export async function fetchContent(userId) {
  const [{ data: pillarsData, error: e1 }, { data: itemsData, error: e2 }] = await Promise.all([
    supabase.from('content_pillars').select('*').eq('user_id', userId).order('sort_order'),
    supabase.from('content_items').select('*').eq('user_id', userId).order('sort_order'),
  ])
  if (e1) throw e1
  if (e2) throw e2
  const pillars = (pillarsData ?? []).map(p => ({ id: p.id, name: p.name, colorIdx: p.color_idx }))
  const content = (itemsData ?? []).map(c => ({ id: c.id, idea: c.idea, pillarId: c.pillar_id, status: c.status, notes: c.notes ?? '' }))
  return { pillars, content }
}

export async function insertPillar(userId, pillar, sortOrder) {
  const { data, error } = await supabase
    .from('content_pillars')
    .insert({ user_id: userId, name: pillar.name, color_idx: pillar.colorIdx, sort_order: sortOrder })
    .select().single()
  if (error) throw error
  return data.id
}

export async function deletePillar(id) {
  const { error } = await supabase.from('content_pillars').delete().eq('id', id)
  if (error) throw error
}

export async function insertContentItem(userId, item, sortOrder) {
  const { data, error } = await supabase
    .from('content_items')
    .insert({ user_id: userId, idea: item.idea, pillar_id: item.pillarId, status: item.status, notes: item.notes, sort_order: sortOrder })
    .select().single()
  if (error) throw error
  return data.id
}

export async function updateContentItem(id, changes) {
  const mapped = {}
  if ('pillarId' in changes) mapped.pillar_id = changes.pillarId
  if ('idea'     in changes) mapped.idea      = changes.idea
  if ('status'   in changes) mapped.status    = changes.status
  if ('notes'    in changes) mapped.notes     = changes.notes
  const { error } = await supabase.from('content_items').update(mapped).eq('id', id)
  if (error) throw error
}

export async function updateContentOrder(items) {
  const updates = items.map((item, sortOrder) =>
    supabase.from('content_items').update({ sort_order: sortOrder }).eq('id', item.id)
  )
  const results = await Promise.all(updates)
  const failed = results.find(({ error }) => error)
  if (failed?.error) throw failed.error
}

export async function deleteContentItem(id) {
  const { error } = await supabase.from('content_items').delete().eq('id', id)
  if (error) throw error
}

// ── Fetch all on login ────────────────────────────────────────────────────────

export async function fetchAll(userId) {
  const [expenses, income, habits, habitChecks, { pillars, content }] =
    await Promise.all([
      fetchTransactions(userId),
      fetchIncome(userId),
      fetchHabits(userId),
      fetchHabitLogs(userId),
      fetchContent(userId),
    ])
  return {
    events: [], expenses, income,
    habits, habitChecks, habitWeekOffset: 0,
    pillars, content, contentFilter: 'all',
    nextId: 200,
  }
}
