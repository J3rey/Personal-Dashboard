import { useState, useRef, useEffect } from 'react'
import { Doughnut, Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { CATS, CAT_COLORS, RATES } from '../constants/index.js'

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend)

let _nextId = 300
const uid = () => _nextId++

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function getCostClass(cost, allCosts) {
  if (!allCosts.length) return ''
  const max = Math.max(...allCosts), min = Math.min(...allCosts), range = max - min
  if (range === 0) return 'cost-low'
  const pct = (cost - min) / range
  return pct >= 0.66 ? 'cost-high' : pct >= 0.33 ? 'cost-mid' : 'cost-low'
}

const centrePlugin = {
  id: 'ctr',
  beforeDraw(chart) {
    const { ctx, chartArea: { left, right, top, bottom } } = chart
    const cx = (left + right) / 2, cy = (top + bottom) / 2
    const total = (chart.data.datasets[0]?.data ?? []).reduce((s, v) => s + v, 0)
    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#9c9990'
    ctx.font = '11px DM Sans'
    ctx.fillText('total', cx, cy - 10)
    ctx.fillStyle = '#1a1a18'
    ctx.font = '600 17px DM Sans'
    ctx.fillText('$' + total.toFixed(0), cx, cy + 8)
    ctx.restore()
  },
}

export default function Finance({ state, setState }) {
  const [activeFilters, setActiveFilters] = useState([])
  const [monthFilter, setMonthFilter] = useState(String(new Date().getMonth() + 1))
  const [yearFilter, setYearFilter]   = useState(new Date().getFullYear())
  const [showCharts, setShowCharts] = useState(false)
  const [showCurrency, setShowCurrency] = useState(false)
  const [nameFieldVisible, setNameFieldVisible] = useState(false)

  // Add expense form
  const [newDate, setNewDate]     = useState(new Date().toISOString().split('T')[0])
  const [newCat, setNewCat]       = useState('Food')
  const [newDetail, setNewDetail] = useState('')
  const [newCost, setNewCost]     = useState('')
  const [newType, setNewType]     = useState('normal')
  const [newPerson, setNewPerson] = useState('')
  const [newHeader, setNewHeader] = useState('')

  // Add income form
  const [incDate, setIncDate]     = useState(new Date().toISOString().split('T')[0])
  const [incAmount, setIncAmount] = useState('')
  const [incSource, setIncSource] = useState('')
  const [incSalary, setIncSalary] = useState(false)

  // Currency converter
  const [currAmount, setCurrAmount] = useState('')
  const [currFrom, setCurrFrom]     = useState('AUD')
  const [currTo, setCurrTo]         = useState('USD')
  const [currResult, setCurrResult] = useState('')

  const [incomeModal, setIncomeModal] = useState(null)

  useEffect(() => {
    const today = new Date()
    const y = yearFilter
    const m = monthFilter === 'all'
      ? (y === today.getFullYear() ? today.getMonth() + 1 : 1)
      : parseInt(monthFilter)
    const isCurrentPeriod = y === today.getFullYear() && m === today.getMonth() + 1
    const d = isCurrentPeriod ? today.getDate() : 1
    setNewDate(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }, [yearFilter, monthFilter])

  function toggleFilter(cat) {
    setActiveFilters(prev =>
      prev.includes(cat) ? prev.filter(x => x !== cat) : [...prev, cat]
    )
  }

  function getFilteredExpenses() {
    return state.expenses.filter(e => {
      if (e.isHeader || e.isEnd) {
        if (!e.date) return false
        const d = new Date(e.date + 'T12:00:00')
        if (d.getFullYear() !== yearFilter) return false
        if (monthFilter === 'all') return true
        return d.getMonth() + 1 === parseInt(monthFilter)
      }
      const d = new Date(e.date + 'T12:00:00')
      if (d.getFullYear() !== yearFilter) return false
      if (activeFilters.length > 0 && !activeFilters.includes(e.cat)) return false
      if (monthFilter !== 'all' && d.getMonth() + 1 !== parseInt(monthFilter)) return false
      return true
    })
  }

  function getMonthFilteredExpenses() {
    return state.expenses.filter(e => {
      if (e.isHeader || e.isEnd) return false
      const d = new Date(e.date + 'T12:00:00')
      if (d.getFullYear() !== yearFilter) return false
      if (monthFilter === 'all') return true
      return d.getMonth() + 1 === parseInt(monthFilter)
    })
  }

  function getMonthFilteredIncome() {
    return state.income.filter(e => {
      const d = new Date(e.date + 'T12:00:00')
      if (d.getFullYear() !== yearFilter) return false
      if (monthFilter === 'all') return true
      return d.getMonth() + 1 === parseInt(monthFilter)
    })
  }

  const filtered = getFilteredExpenses()
  const allCosts = filtered.filter(e => !e.isHeader && !e.isEnd)
  const monthExpenses = getMonthFilteredExpenses()
  const monthIncome   = getMonthFilteredIncome()

  const totalExp = monthExpenses.reduce((a, e) => a + e.cost, 0)
  const totalInc = monthIncome.reduce((a, i) => a + i.amount, 0)
  const net = totalInc - totalExp

  function addExpense() {
    if (!newDetail.trim() || isNaN(parseFloat(newCost))) return
    const entry = {
      id: uid(), date: newDate, cat: newCat,
      detail: newDetail.trim(), cost: parseFloat(newCost),
      type: newType, person: newPerson.trim(),
    }
    setState(prev => {
      const exps = [...prev.expenses]
      let insertIdx = exps.length
      for (let i = exps.length - 1; i >= 0; i--) {
        const e = exps[i]
        if (e.isHeader || e.isEnd) continue
        if (e.date <= newDate) { insertIdx = i + 1; break }
        else insertIdx = i
      }
      exps.splice(insertIdx, 0, entry)
      return { ...prev, expenses: exps }
    })
    setNewDetail(''); setNewCost(''); setNewPerson('')
    setNameFieldVisible(false); setNewType('normal')
  }

  function addEventHeader() {
    if (!newHeader.trim()) return
    setState(prev => ({
      ...prev,
      expenses: [...prev.expenses, { id: 'h' + uid(), isHeader: true, label: newHeader.trim(), date: newDate || '0000-00-00' }],
    }))
    setNewHeader('')
  }

  function addEventEnd() {
    const endedIds = new Set(state.expenses.filter(e => e.isEnd && e.headerId).map(e => e.headerId))
    const last = [...state.expenses].reverse().find(e => e.isHeader && !endedIds.has(e.id))
    if (!last) return
    setState(prev => ({
      ...prev,
      expenses: [...prev.expenses, { id: 'e' + uid(), isEnd: true, label: 'End of ' + last.label, headerId: last.id, date: newDate }],
    }))
  }

  function deleteExpense(id) {
    setState(prev => {
      const target = prev.expenses.find(e => e.id === id)
      const toDelete = new Set([id])
      if (target?.isHeader) {
        const end = prev.expenses.find(e => e.isEnd && e.headerId === id)
        if (end) toDelete.add(end.id)
      }
      return { ...prev, expenses: prev.expenses.filter(e => !toDelete.has(e.id)) }
    })
  }

  function editExpenseCat(id) {
    const exps = [...state.expenses]
    const e = exps.find(x => x.id === id)
    if (!e) return
    const v = prompt('Edit category (Food/Transport/Misc/Recurring/Events/Clothes/Gifts):', e.cat)
    if (v && CATS.includes(v)) { e.cat = v; setState(prev => ({ ...prev, expenses: exps })) }
  }

  function saveIncomeModal() {
    if (!incomeModal) return
    setState(prev => ({ ...prev, income: prev.income.map(i => i.id === incomeModal.id ? { ...incomeModal, amount: parseFloat(incomeModal.amount) || i.amount } : i) }))
    setIncomeModal(null)
  }

  function addIncome() {
    const amount = parseFloat(incAmount)
    if (!incSource.trim() || isNaN(amount)) return
    setState(prev => ({
      ...prev,
      income: [...prev.income, { id: uid(), date: incDate, source: incSource.trim(), amount, salary: incSalary }],
    }))
    setIncAmount(''); setIncSource(''); setIncSalary(false)
  }

  function deleteIncome(id) {
    setState(prev => ({ ...prev, income: prev.income.filter(i => i.id !== id) }))
  }

  function convertCurrency() {
    const amt = parseFloat(currAmount)
    if (isNaN(amt)) return
    const result = ((amt / RATES[currFrom]) * RATES[currTo]).toFixed(2)
    setCurrResult(`${amt} ${currFrom} = ${result} ${currTo}`)
  }

  // Chart data
  function buildChartData() {
    const isAll = monthFilter === 'all'
    const selMo = parseInt(monthFilter)

    const catTotals = {}
    CATS.forEach(c => {
      catTotals[c] = state.expenses.filter(e => {
        if (e.isHeader || e.isEnd || e.cat !== c) return false
        const d = new Date(e.date + 'T12:00:00')
        if (d.getFullYear() !== yearFilter) return false
        return isAll || d.getMonth() + 1 === selMo
      }).reduce((a, e) => a + e.cost, 0)
    })
    const total = Object.values(catTotals).reduce((a, b) => a + b, 0)

    const donutData = {
      labels: CATS,
      datasets: [{ data: CATS.map(c => parseFloat((catTotals[c] || 0).toFixed(2))), backgroundColor: CATS.map(c => CAT_COLORS[c]), borderWidth: 2, borderColor: '#fff' }],
    }
    const donutOptions = { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.raw.toFixed(2)}` } } } }

    let barLabels, barDataArr
    if (isAll) {
      const monthData = {}
      for (let mo = 1; mo <= 12; mo++) { monthData[mo] = {}; CATS.forEach(c => { monthData[mo][c] = 0 }) }
      state.expenses.filter(e => !e.isHeader && !e.isEnd).forEach(e => {
        const d = new Date(e.date + 'T12:00:00')
        if (d.getFullYear() !== yearFilter) return
        const mo = d.getMonth() + 1
        if (monthData[mo]) CATS.forEach(c => { if (e.cat === c) monthData[mo][c] += e.cost })
      })
      const activeMos = Object.keys(monthData).filter(mo => CATS.some(c => monthData[mo][c] > 0))
      barLabels = activeMos.map(mo => MONTH_NAMES[mo - 1])
      barDataArr = activeMos.map(mo => monthData[mo])
    } else {
      const now = new Date()
      const last6 = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
        return { m: d.getMonth() + 1, y: d.getFullYear() }
      })
      const monthData = {}
      last6.forEach(({ m, y }) => { const key = `${y}-${m}`; monthData[key] = {}; CATS.forEach(c => { monthData[key][c] = 0 }) })
      state.expenses.filter(e => !e.isHeader && !e.isEnd).forEach(e => {
        const d = new Date(e.date + 'T12:00:00'), mo = d.getMonth() + 1, yr = d.getFullYear(), key = `${yr}-${mo}`
        if (monthData[key]) CATS.forEach(c => { if (e.cat === c) monthData[key][c] += e.cost })
      })
      barLabels = last6.map(({ m }) => MONTH_NAMES[m - 1][0])
      barDataArr = last6.map(({ m, y }) => monthData[`${y}-${m}`] || {})
    }

    const barData = {
      labels: barLabels,
      datasets: CATS.map(c => ({ label: c, data: barDataArr.map(d => parseFloat((d[c] || 0).toFixed(2))), backgroundColor: CAT_COLORS[c], stack: 's', borderWidth: 0 })),
    }
    const barOptions = {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { font: { size: 11 }, color: '#9c9990' }, border: { display: false } },
        y: { stacked: true, grid: { color: '#e5e3dc' }, ticks: { font: { size: 10 }, color: '#9c9990' }, border: { display: false } },
      },
    }

    return { donutData, donutOptions, barData, barOptions, total, catTotals }
  }

  const chartData = showCharts ? buildChartData() : null

  const hasUnclosedHeader = (() => {
    const endedIds = new Set(state.expenses.filter(e => e.isEnd && e.headerId).map(e => e.headerId))
    return state.expenses.some(e => e.isHeader && !endedIds.has(e.id))
  })()

  // Overview by category
  const byCat = {}
  CATS.forEach(c => { byCat[c] = 0 })
  monthExpenses.forEach(e => { if (byCat[e.cat] !== undefined) byCat[e.cat] += e.cost })
  const maxCatVal = Math.max(...CATS.map(c => byCat[c]))

  const monthHeading = monthFilter === 'all'
    ? 'All Months'
    : MONTH_NAMES[parseInt(monthFilter) - 1]

  return (
    <div className="panel">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text1)', letterSpacing: '-0.3px' }}>{monthHeading}</div>
          <div style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text3)' }}>{yearFilter}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', background: 'var(--surface2)', borderRadius: '8px', padding: '3px 4px' }}>
          <button className="btn-ghost" onClick={() => setYearFilter(y => y - 1)} style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '5px' }}>←</button>
          <span style={{ fontSize: '13px', fontWeight: 600, minWidth: '38px', textAlign: 'center', color: 'var(--text1)' }}>{yearFilter}</span>
          <button className="btn-ghost" onClick={() => setYearFilter(y => y + 1)} style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '5px' }}>→</button>
        </div>
      </div>
      {/* Top stat cards */}
      <div className="finance-top">
        <div className="stat-card">
          <div className="stat-label">Total Expenses</div>
          <div className="stat-value neg">${totalExp.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Income</div>
          <div className="stat-value pos">${totalInc.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Net</div>
          <div className={'stat-value ' + (net >= 0 ? 'pos' : 'neg')}>
            {net >= 0 ? '+' : '−'}${Math.abs(net).toFixed(2)}
          </div>
        </div>
      </div>

      <div className="finance-layout">
        <div>
          <div className="finance-table-wrap">
            {/* Toolbar */}
            <div className="finance-toolbar">
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {CATS.map(cat => (
                  <button
                    key={cat}
                    className={'filter-btn' + (activeFilters.includes(cat) ? ' active' : '')}
                    onClick={() => toggleFilter(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <select className="form-select" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} style={{ fontSize: '12px', padding: '4px 8px' }}>
                  <option value="all">All Year</option>
                  {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
                <button className="btn-ghost" onClick={() => setShowCharts(v => !v)} style={{ fontSize: '12px' }}>
                  {showCharts ? 'Hide Charts' : 'Show Charts'}
                </button>
              </div>
            </div>

            {/* Expense table */}
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '52px' }}>Date</th>
                    <th style={{ width: '72px' }}>Category</th>
                    <th>Details</th>
                    <th style={{ width: '80px', textAlign: 'right' }}>Cost</th>
                    <th style={{ width: '150px' }}>Type</th>
                    <th style={{ width: '30px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(e => {
                    if (e.isHeader) return (
                      <tr key={e.id} className="ev-header-row">
                        <td colSpan={5}>&#9632; {e.label}</td>
                        <td><button className="del-btn" onClick={() => deleteExpense(e.id)}>×</button></td>
                      </tr>
                    )
                    if (e.isEnd) return (
                      <tr key={e.id} className="ev-end-row">
                        <td colSpan={5}>&#9633; {e.label}</td>
                        <td><button className="del-btn" onClick={() => deleteExpense(e.id)}>×</button></td>
                      </tr>
                    )
                    const cls = getCostClass(e.cost, allCosts)
                    const ds = e.date ? e.date.slice(5).replace('-', '/') : ''
                    const badge = e.type === 'paid'
                      ? <span className="badge badge-paid">p/{e.person ? ' ' + e.person : ''}</span>
                      : e.type === 'for'
                        ? <span className="badge badge-for">f/{e.person ? ' ' + e.person : ''}</span>
                        : <span className="badge badge-normal">—</span>
                    return (
                      <tr key={e.id}>
                        <td style={{ fontSize: '11px', color: 'var(--text2)', fontFamily: "'DM Mono', monospace", whiteSpace: 'nowrap' }}>
                          <span style={{ pointerEvents: 'none', userSelect: 'none' }}>{e.date.slice(5, 7)}/</span>
                          <span suppressContentEditableWarning contentEditable style={{ cursor: 'text', outline: 'none' }}
                            onKeyDown={ev => {
                              if (ev.key === 'Enter') { ev.preventDefault(); ev.currentTarget.blur(); return }
                              if (ev.key === 'Escape') { ev.currentTarget.textContent = e.date.slice(8); ev.currentTarget.blur(); return }
                              if (ev.ctrlKey || ev.metaKey) return
                              if (/^(Arrow|Backspace|Delete|Tab|Home|End)/.test(ev.key)) return
                              if (!/^\d$/.test(ev.key)) { ev.preventDefault(); return }
                              const selLen = window.getSelection()?.toString().length || 0
                              if (ev.currentTarget.textContent.length - selLen >= 2) ev.preventDefault()
                            }}
                            onBlur={ev => {
                              const dayNum = parseInt(ev.currentTarget.textContent.trim(), 10)
                              if (!isNaN(dayNum) && dayNum >= 1 && dayNum <= 31) {
                                const [yr, mo] = e.date.split('-')
                                const newDate = `${yr}-${mo}-${String(dayNum).padStart(2, '0')}`
                                ev.currentTarget.textContent = String(dayNum).padStart(2, '0')
                                if (newDate !== e.date) setState(prev => {
                                  const exps = prev.expenses.map(x => x.id === e.id ? { ...x, date: newDate } : x)
                                  const specials = exps.filter(x => x.isHeader || x.isEnd)
                                  const regulars = exps.filter(x => !x.isHeader && !x.isEnd)
                                  regulars.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
                                  return { ...prev, expenses: [...regulars, ...specials] }
                                })
                              } else {
                                ev.currentTarget.textContent = e.date.slice(8)
                              }
                            }}
                          >{e.date.slice(8)}</span>
                        </td>
                        <td className="editable-cell" onDoubleClick={() => editExpenseCat(e.id)}><span className={`cat-badge cat-${e.cat}`}>{e.cat}</span></td>
                        <td suppressContentEditableWarning contentEditable style={{ cursor: 'text' }}
                          onBlur={ev => { const v = ev.currentTarget.textContent; if (v !== e.detail) setState(prev => ({ ...prev, expenses: prev.expenses.map(x => x.id === e.id ? { ...x, detail: v } : x) })) }}
                          onKeyDown={ev => { if (ev.key === 'Enter') { ev.preventDefault(); ev.currentTarget.blur() } if (ev.key === 'Escape') { ev.currentTarget.textContent = e.detail; ev.currentTarget.blur() } }}
                        >{e.detail}</td>
                        <td style={{ textAlign: 'right' }}>
                          <span className={`cost-cell ${cls}`} style={{ cursor: 'text' }}>
                            <span style={{ pointerEvents: 'none', userSelect: 'none' }}>$</span>
                            <span suppressContentEditableWarning contentEditable style={{ outline: 'none' }}
                              onKeyDown={ev => {
                                if (ev.key === 'Enter') { ev.preventDefault(); ev.currentTarget.blur(); return }
                                if (ev.key === 'Escape') { ev.currentTarget.textContent = e.cost.toFixed(2); ev.currentTarget.blur(); return }
                                if (ev.ctrlKey || ev.metaKey) return
                                if (/^(Arrow|Backspace|Delete|Tab|Home|End)/.test(ev.key)) return
                                if (!/^\d$/.test(ev.key) && ev.key !== '.') { ev.preventDefault(); return }
                                if (ev.key === '.' && ev.currentTarget.textContent.includes('.')) ev.preventDefault()
                              }}
                              onBlur={ev => {
                                const v = parseFloat(ev.currentTarget.textContent.trim())
                                if (!isNaN(v) && v >= 0) {
                                  const rounded = Math.round(v * 100) / 100
                                  ev.currentTarget.textContent = rounded.toFixed(2)
                                  if (rounded !== e.cost) setState(prev => ({ ...prev, expenses: prev.expenses.map(x => x.id === e.id ? { ...x, cost: rounded } : x) }))
                                } else {
                                  ev.currentTarget.textContent = e.cost.toFixed(2)
                                }
                              }}
                            >{e.cost.toFixed(2)}</span>
                          </span>
                        </td>
                        <td>{badge}</td>
                        <td><button className="del-btn" onClick={() => deleteExpense(e.id)}>×</button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Add expense row */}
            <div style={{ padding: '10px 16px', borderTop: '2px solid var(--border)', background: 'var(--surface2)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '52px 72px 1fr 70px 150px 30px', gap: '5px', alignItems: 'center', marginBottom: '6px' }}>
                <input className="form-input" type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={{ fontSize: '11px', padding: '4px 5px' }} />
                <select className="form-select" value={newCat} onChange={e => setNewCat(e.target.value)} style={{ fontSize: '11px', padding: '4px 5px', width: '100%' }}>
                  {CATS.map(c => <option key={c}>{c}</option>)}
                </select>
                <input className="form-input" placeholder="Details" value={newDetail} onChange={e => setNewDetail(e.target.value)} style={{ fontSize: '12px', padding: '4px 7px' }} />
                <input className="form-input" type="number" placeholder="0.00" step="0.01" value={newCost} onChange={e => setNewCost(e.target.value)} style={{ fontSize: '12px', padding: '4px 7px', textAlign: 'right' }} />
                <select className="form-select" value={newType} onChange={e => { setNewType(e.target.value); setNameFieldVisible(e.target.value !== 'normal') }} style={{ fontSize: '11px', padding: '4px 5px', width: '100%' }}>
                  <option value="normal">Normal</option>
                  <option value="paid">p/ Paid aswell</option>
                  <option value="for">f/ Bought for someone</option>
                </select>
                <button onClick={addExpense} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', height: '30px', width: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
              </div>
              {nameFieldVisible && (
                <div style={{ display: 'block', marginBottom: '6px' }}>
                  <input className="form-input" placeholder="Person's name" value={newPerson} onChange={e => setNewPerson(e.target.value)} style={{ fontSize: '12px', padding: '4px 8px', width: '200px' }} />
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input className="form-input" placeholder="+ Event header (e.g. Trip to Sydney)" value={newHeader} onChange={e => setNewHeader(e.target.value)} style={{ fontSize: '12px', padding: '4px 8px', width: '260px' }} />
                <button className="btn-ghost" onClick={addEventHeader} style={{ fontSize: '12px', padding: '4px 10px' }}>Add Header</button>
                <button className="btn-ghost" onClick={addEventEnd} disabled={!hasUnclosedHeader} style={{ fontSize: '12px', padding: '4px 10px', color: hasUnclosedHeader ? 'var(--text2)' : 'var(--text3)', opacity: hasUnclosedHeader ? 1 : 0.45, cursor: hasUnclosedHeader ? 'pointer' : 'default' }}>End Event</button>
              </div>
            </div>
          </div>

          {/* Charts */}
          {showCharts && chartData && (
            <div className="charts-row">
              <div className="chart-box">
                <div className="chart-box-title">
                  {monthFilter === 'all' ? 'Category Breakdown — All Year' : `Category Breakdown — ${MONTH_NAMES[parseInt(monthFilter) - 1]}`}
                </div>
                <div style={{ position: 'relative', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Doughnut data={chartData.donutData} options={chartData.donutOptions} plugins={[centrePlugin]} />
                </div>
                <div className="chart-legend">
                  {CATS.filter(c => (chartData.catTotals[c] || 0) > 0).map(c => (
                    <div key={c} className="legend-item">
                      <div className="legend-dot" style={{ background: CAT_COLORS[c] }} />
                      {c} ${(chartData.catTotals[c] || 0).toFixed(2)}
                    </div>
                  ))}
                </div>
              </div>
              <div className="chart-box">
                <div className="chart-box-title">
                  {monthFilter === 'all' ? 'Monthly Breakdown — All Year' : 'Monthly Breakdown · Last 6 Months'}
                </div>
                <div style={{ position: 'relative', height: '200px' }}>
                  <Bar data={chartData.barData} options={chartData.barOptions} />
                </div>
                <div className="chart-legend">
                  {CATS.map(c => (
                    <div key={c} className="legend-item">
                      <div className="legend-dot" style={{ background: CAT_COLORS[c] }} />
                      {c}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div>
          {/* Overview — Expenses */}
          <div className="overview-box">
            <div className="overview-box-hdr"><h3>Overview — Expenses</h3></div>
            {CATS.map(c => {
              const v = byCat[c]
              const pct = maxCatVal > 0 ? v / maxCatVal : 0
              const cls = pct >= 0.5 ? 'cost-high' : pct >= 0.2 ? 'cost-mid' : 'cost-low'
              return (
                <div key={c} className="overview-row">
                  <span>{c}</span>
                  <span className={`cost-cell ${cls}`} style={{ fontSize: '11px' }}>${v.toFixed(2)}</span>
                </div>
              )
            })}
            <div className="overview-total">
              <span>Total</span>
              <span>${monthExpenses.reduce((a, e) => a + e.cost, 0).toFixed(2)}</span>
            </div>
          </div>

          {/* Income */}
          <div className="overview-box">
            <div className="overview-box-hdr"><h3>Income</h3></div>
            {monthIncome.map(i => (
              <div key={i.id} className="overview-row" style={{ gap: '8px', cursor: 'pointer' }} onClick={() => setIncomeModal({ ...i })}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 500 }}>{i.source}{i.salary ? ' (Salary)' : ''}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text3)' }}>{i.date}</div>
                </div>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '12px', color: 'var(--green)' }} onClick={ev => ev.stopPropagation()}>
                  <span style={{ pointerEvents: 'none', userSelect: 'none' }}>$</span>
                  <span suppressContentEditableWarning contentEditable style={{ outline: 'none', cursor: 'text' }}
                    onKeyDown={ev => {
                      if (ev.key === 'Enter') { ev.preventDefault(); ev.currentTarget.blur(); return }
                      if (ev.key === 'Escape') { ev.currentTarget.textContent = i.amount.toFixed(2); ev.currentTarget.blur(); return }
                      if (ev.ctrlKey || ev.metaKey) return
                      if (/^(Arrow|Backspace|Delete|Tab|Home|End)/.test(ev.key)) return
                      if (!/^\d$/.test(ev.key) && ev.key !== '.') { ev.preventDefault(); return }
                      if (ev.key === '.' && ev.currentTarget.textContent.includes('.')) ev.preventDefault()
                    }}
                    onBlur={ev => {
                      const v = parseFloat(ev.currentTarget.textContent.trim())
                      if (!isNaN(v) && v >= 0) {
                        const rounded = Math.round(v * 100) / 100
                        ev.currentTarget.textContent = rounded.toFixed(2)
                        if (rounded !== i.amount) setState(prev => ({ ...prev, income: prev.income.map(x => x.id === i.id ? { ...x, amount: rounded } : x) }))
                      } else {
                        ev.currentTarget.textContent = i.amount.toFixed(2)
                      }
                    }}
                  >{i.amount.toFixed(2)}</span>
                </span>
                <button className="del-btn" onClick={ev => { ev.stopPropagation(); deleteIncome(i.id) }}>×</button>
              </div>
            ))}
            <div className="overview-total">
              <span>Total</span>
              <span>${totalInc.toFixed(2)}</span>
            </div>
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', color: 'var(--text3)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Date</label>
                  <input className="form-input" type="date" value={incDate} onChange={e => setIncDate(e.target.value)} style={{ fontSize: '12px', padding: '4px 8px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', color: 'var(--text3)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Amount</label>
                  <input className="form-input" type="number" placeholder="0.00" value={incAmount} onChange={e => setIncAmount(e.target.value)} style={{ fontSize: '12px', padding: '4px 8px' }} />
                </div>
              </div>
              <div style={{ marginBottom: '6px' }}>
                <label style={{ display: 'block', fontSize: '10px', color: 'var(--text3)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Source</label>
                <input className="form-input" placeholder="e.g. Allied, Freelance" value={incSource} onChange={e => setIncSource(e.target.value)} style={{ fontSize: '12px', padding: '4px 8px' }} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text2)', cursor: 'pointer', marginBottom: '8px' }}>
                <input type="checkbox" checked={incSalary} onChange={e => setIncSalary(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
                Mark as Salary
              </label>
              <button className="btn-primary" onClick={addIncome} style={{ fontSize: '12px', padding: '6px 16px', width: '100%' }}>Add Income</button>
            </div>
          </div>

          {/* Currency Converter */}
          <div className="overview-box">
            <div className="overview-box-hdr">
              <h3>Currency Converter</h3>
              <label style={{ fontSize: '11px', color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                <input type="checkbox" checked={showCurrency} onChange={e => setShowCurrency(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
                Show
              </label>
            </div>
            {showCurrency && (
              <div style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input className="form-input" type="number" placeholder="Amount" value={currAmount} onChange={e => setCurrAmount(e.target.value)} style={{ width: '80px', padding: '5px 8px', fontSize: '12px' }} />
                  <select className="form-select" value={currFrom} onChange={e => setCurrFrom(e.target.value)} style={{ fontSize: '12px', padding: '4px 6px', width: '70px' }}>
                    {Object.keys(RATES).map(r => <option key={r}>{r}</option>)}
                  </select>
                  <span style={{ color: 'var(--text3)', fontSize: '12px' }}>to</span>
                  <select className="form-select" value={currTo} onChange={e => setCurrTo(e.target.value)} style={{ fontSize: '12px', padding: '4px 6px', width: '70px' }}>
                    {Object.keys(RATES).map(r => <option key={r}>{r}</option>)}
                  </select>
                  <button className="btn-ghost" onClick={convertCurrency} style={{ fontSize: '12px', padding: '4px 8px' }}>Go</button>
                </div>
                {currResult && <div style={{ fontFamily: "'DM Mono', monospace", fontWeight: 500, color: 'var(--accent)', marginTop: '6px', fontSize: '13px' }}>{currResult}</div>}
                <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '4px' }}>Approximate rates only</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Income edit modal */}
      {incomeModal && (
        <div onClick={() => setIncomeModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={ev => ev.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', width: '320px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text1)', marginBottom: '18px' }}>Edit Income</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '10px', color: 'var(--text3)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Date</label>
                <input className="form-input" type="date" value={incomeModal.date} onChange={ev => setIncomeModal(m => ({ ...m, date: ev.target.value }))} style={{ fontSize: '12px', padding: '5px 8px', width: '100%' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', color: 'var(--text3)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Amount</label>
                <input className="form-input" type="number" step="0.01" value={incomeModal.amount} onChange={ev => setIncomeModal(m => ({ ...m, amount: ev.target.value }))} style={{ fontSize: '12px', padding: '5px 8px', width: '100%' }} />
              </div>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '10px', color: 'var(--text3)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Source</label>
              <input className="form-input" value={incomeModal.source} onChange={ev => setIncomeModal(m => ({ ...m, source: ev.target.value }))} style={{ fontSize: '12px', padding: '5px 8px', width: '100%' }} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: 'var(--text2)', cursor: 'pointer', marginBottom: '18px' }}>
              <input type="checkbox" checked={!!incomeModal.salary} onChange={ev => setIncomeModal(m => ({ ...m, salary: ev.target.checked }))} style={{ accentColor: 'var(--accent)' }} />
              Mark as Salary
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-primary" onClick={saveIncomeModal} style={{ flex: 1, fontSize: '12px', padding: '7px 0' }}>Save</button>
              <button className="btn-ghost" onClick={() => setIncomeModal(null)} style={{ flex: 1, fontSize: '12px', padding: '7px 0' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
