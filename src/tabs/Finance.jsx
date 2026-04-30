import { useState, useRef } from 'react'
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

function createCentrePlugin(total) {
  return {
    id: 'ctr',
    beforeDraw(chart) {
      const { ctx, chartArea: { left, right, top, bottom } } = chart
      const cx = (left + right) / 2, cy = (top + bottom) / 2
      ctx.save()
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#9c9990'
      ctx.font = '11px DM Sans'
      ctx.fillText('total', cx, cy - 10)
      ctx.fillStyle = '#1a1a18'
      ctx.font = '600 17px DM Sans'
      ctx.fillText('A$' + total.toFixed(0), cx, cy + 8)
      ctx.restore()
    },
  }
}

export default function Finance({ state, setState }) {
  const [activeFilters, setActiveFilters] = useState([])
  const [monthFilter, setMonthFilter] = useState('all')
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

  function toggleFilter(cat) {
    setActiveFilters(prev =>
      prev.includes(cat) ? prev.filter(x => x !== cat) : [...prev, cat]
    )
  }

  function getFilteredExpenses() {
    return state.expenses.filter(e => {
      if (e.isHeader || e.isEnd) {
        if (monthFilter === 'all') return true
        if (!e.date) return false
        return new Date(e.date + 'T12:00:00').getMonth() + 1 === parseInt(monthFilter)
      }
      if (activeFilters.length > 0 && !activeFilters.includes(e.cat)) return false
      if (monthFilter !== 'all') {
        const em = new Date(e.date + 'T12:00:00').getMonth() + 1
        if (em !== parseInt(monthFilter)) return false
      }
      return true
    })
  }

  function getMonthFilteredExpenses() {
    return state.expenses.filter(e => {
      if (e.isHeader || e.isEnd) return false
      if (monthFilter === 'all') return true
      return new Date(e.date + 'T12:00:00').getMonth() + 1 === parseInt(monthFilter)
    })
  }

  function getMonthFilteredIncome() {
    return state.income.filter(e =>
      monthFilter === 'all' ||
      new Date(e.date + 'T12:00:00').getMonth() + 1 === parseInt(monthFilter)
    )
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

  function editExpenseCell(id, field) {
    const exps = [...state.expenses]
    const e = exps.find(x => x.id === id)
    if (!e) return
    if (field === 'cat') {
      const v = prompt('Edit category (Food/Transport/Misc/Recurring/Events/Clothes/Gifts):', e.cat)
      if (v && CATS.includes(v)) { e.cat = v; setState(prev => ({ ...prev, expenses: exps })) }
    } else if (field === 'cost') {
      const v = parseFloat(prompt('Edit cost:', e.cost))
      if (!isNaN(v)) { e.cost = v; setState(prev => ({ ...prev, expenses: exps })) }
    } else if (field === 'date') {
      const v = prompt('Edit date (YYYY-MM-DD):', e.date)
      if (v && /\d{4}-\d{2}-\d{2}/.test(v)) { e.date = v; setState(prev => ({ ...prev, expenses: exps })) }
    } else {
      const v = prompt('Edit detail:', e.detail)
      if (v !== null) { e.detail = v; setState(prev => ({ ...prev, expenses: exps })) }
    }
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

  function editIncome(id) {
    const incs = [...state.income]
    const i = incs.find(x => x.id === id)
    if (!i) return
    const field = prompt('Edit field (source/amount/date):', 'amount')
    if (!field) return
    if (field === 'source') { const v = prompt('Source:', i.source); if (v !== null) i.source = v }
    else if (field === 'amount') { const v = parseFloat(prompt('Amount:', i.amount)); if (!isNaN(v)) i.amount = v }
    else if (field === 'date') { const v = prompt('Date (YYYY-MM-DD):', i.date); if (v) i.date = v }
    setState(prev => ({ ...prev, income: incs }))
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
      catTotals[c] = state.expenses.filter(e =>
        !e.isHeader && !e.isEnd && e.cat === c &&
        (isAll || new Date(e.date + 'T12:00:00').getMonth() + 1 === selMo)
      ).reduce((a, e) => a + e.cost, 0)
    })
    const total = Object.values(catTotals).reduce((a, b) => a + b, 0)

    const donutData = {
      labels: CATS,
      datasets: [{ data: CATS.map(c => parseFloat((catTotals[c] || 0).toFixed(2))), backgroundColor: CATS.map(c => CAT_COLORS[c]), borderWidth: 2, borderColor: '#fff' }],
    }
    const donutOptions = { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.label}: A$${ctx.raw.toFixed(2)}` } } } }

    let barLabels, barDataArr
    if (isAll) {
      const monthData = {}
      for (let mo = 1; mo <= 12; mo++) { monthData[mo] = {}; CATS.forEach(c => { monthData[mo][c] = 0 }) }
      state.expenses.filter(e => !e.isHeader && !e.isEnd).forEach(e => {
        const mo = new Date(e.date + 'T12:00:00').getMonth() + 1
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

  return (
    <div className="panel">
      {/* Top stat cards */}
      <div className="finance-top">
        <div className="stat-card">
          <div className="stat-label">Total Expenses</div>
          <div className="stat-value neg">A${totalExp.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Income</div>
          <div className="stat-value pos">A${totalInc.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Net</div>
          <div className={'stat-value ' + (net >= 0 ? 'pos' : 'neg')}>
            {net >= 0 ? '+' : '−'}A${Math.abs(net).toFixed(2)}
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
                    <th style={{ width: '120px' }}>Type</th>
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
                        <td style={{ fontSize: '11px', color: 'var(--text2)', fontFamily: "'DM Mono', monospace" }} className="editable-cell" onDoubleClick={() => editExpenseCell(e.id, 'date')}>{ds}</td>
                        <td className="editable-cell" onDoubleClick={() => editExpenseCell(e.id, 'cat')}><span className={`cat-badge cat-${e.cat}`}>{e.cat}</span></td>
                        <td className="editable-cell" onDoubleClick={() => editExpenseCell(e.id, 'detail')}>{e.detail}</td>
                        <td style={{ textAlign: 'right' }}><span className={`cost-cell ${cls}`} style={{ cursor: 'pointer' }} onDoubleClick={() => editExpenseCell(e.id, 'cost')}>A${e.cost.toFixed(2)}</span></td>
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
              <div style={{ display: 'grid', gridTemplateColumns: '52px 72px 1fr 70px 120px 30px', gap: '5px', alignItems: 'center', marginBottom: '6px' }}>
                <input className="form-input" type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={{ fontSize: '11px', padding: '4px 5px' }} />
                <select className="form-select" value={newCat} onChange={e => setNewCat(e.target.value)} style={{ fontSize: '11px', padding: '4px 5px', width: '100%' }}>
                  {CATS.map(c => <option key={c}>{c}</option>)}
                </select>
                <input className="form-input" placeholder="Details" value={newDetail} onChange={e => setNewDetail(e.target.value)} style={{ fontSize: '12px', padding: '4px 7px' }} />
                <input className="form-input" type="number" placeholder="0.00" step="0.01" value={newCost} onChange={e => setNewCost(e.target.value)} style={{ fontSize: '12px', padding: '4px 7px', textAlign: 'right' }} />
                <select className="form-select" value={newType} onChange={e => { setNewType(e.target.value); setNameFieldVisible(e.target.value !== 'normal') }} style={{ fontSize: '11px', padding: '4px 5px', width: '100%' }}>
                  <option value="normal">Normal</option>
                  <option value="paid">p/ Paid with someone</option>
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
                  <Doughnut data={chartData.donutData} options={chartData.donutOptions} plugins={[createCentrePlugin(chartData.total)]} />
                </div>
                <div className="chart-legend">
                  {CATS.filter(c => (chartData.catTotals[c] || 0) > 0).map(c => (
                    <div key={c} className="legend-item">
                      <div className="legend-dot" style={{ background: CAT_COLORS[c] }} />
                      {c} A${(chartData.catTotals[c] || 0).toFixed(2)}
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
                  <span className={`cost-cell ${cls}`} style={{ fontSize: '11px' }}>A${v.toFixed(2)}</span>
                </div>
              )
            })}
            <div className="overview-total">
              <span>Total</span>
              <span>A${monthExpenses.reduce((a, e) => a + e.cost, 0).toFixed(2)}</span>
            </div>
          </div>

          {/* Income */}
          <div className="overview-box">
            <div className="overview-box-hdr"><h3>Income</h3></div>
            {monthIncome.map(i => (
              <div key={i.id} className="overview-row" style={{ gap: '8px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 500 }}>{i.source}{i.salary ? ' (Salary)' : ''}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text3)' }}>{i.date}</div>
                </div>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '12px', color: 'var(--green)', cursor: 'pointer' }} onDoubleClick={() => editIncome(i.id)}>A${i.amount.toFixed(2)}</span>
                <button className="del-btn" onClick={() => deleteIncome(i.id)}>×</button>
              </div>
            ))}
            <div className="overview-total">
              <span>Total</span>
              <span>A${totalInc.toFixed(2)}</span>
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
    </div>
  )
}
