import { useState, useRef, useEffect } from 'react'
import { PILLAR_COLORS } from '../constants/index.js'
import * as db from '../services/db.js'

let _nextId = 500
const uid = () => _nextId++

const STATUSES = ['Idea', 'Scripted', 'Filmed', 'Edited', 'Posted']

function AutoTextarea({ value, onBlur, placeholder }) {
  const ref = useRef(null)

  function resize() {
    if (ref.current) {
      ref.current.style.height = 'auto'
      ref.current.style.height = ref.current.scrollHeight + 'px'
    }
  }

  useEffect(resize, [value])

  return (
    <textarea
      ref={ref}
      className="note-input"
      rows={1}
      placeholder={placeholder}
      defaultValue={value}
      onInput={resize}
      style={{ resize: 'none', overflow: 'hidden' }}
      onBlur={e => onBlur(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.target.blur() } }}
    />
  )
}

function ContentRow({ c, pillars, onStatusChange, onNoteChange, onDelete, onDragStart, onDrop, allowDrag }) {
  const [editingIdea, setEditingIdea] = useState(false)
  const [ideaVal, setIdeaVal] = useState(c.idea)
  const [dragOver, setDragOver] = useState(false)
  const ideaRef = useRef(null)
  const p = pillars.find(x => x.id === c.pillarId)
  const col = p ? PILLAR_COLORS[p.colorIdx] || PILLAR_COLORS[0] : { bg: 'var(--surface2)', text: 'var(--text2)' }
  const statusCls = `status-${c.status.toLowerCase()}`

  useEffect(() => {
    if (editingIdea && ideaRef.current) {
      ideaRef.current.focus()
      ideaRef.current.style.height = 'auto'
      ideaRef.current.style.height = ideaRef.current.scrollHeight + 'px'
    }
  }, [editingIdea])

  const isDraggable = allowDrag && !editingIdea

  return (
    <tr
      className={c.status === 'Posted' ? 'posted-row' : ''}
      draggable={isDraggable}
      style={{
        cursor: isDraggable ? 'grab' : 'default',
        boxShadow: dragOver ? 'inset 0 -2px 0 var(--accent)' : 'none',
      }}
      onDragStart={e => { if (!isDraggable) return; e.dataTransfer.effectAllowed = 'move'; onDragStart(c.id) }}
      onDragOver={e => { if (!allowDrag) return; e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); onDrop(c.id) }}
    >
      <td style={{ fontSize: '13px' }}>
        {editingIdea ? (
          <textarea
            ref={ideaRef}
            className="inline-edit"
            value={ideaVal}
            rows={1}
            style={{ resize: 'none', overflow: 'hidden', width: '100%', boxSizing: 'border-box' }}
            onChange={e => { setIdeaVal(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
            onBlur={() => { if (ideaVal.trim()) onStatusChange(c.id, 'idea', ideaVal.trim()); setEditingIdea(false) }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.target.blur() }
              if (e.key === 'Escape') { setIdeaVal(c.idea); setEditingIdea(false) }
            }}
          />
        ) : (
          <span style={{ display: 'flex', alignItems: 'flex-start', gap: '5px' }}>
            {allowDrag && (
              <span style={{ color: 'var(--text3)', fontSize: '13px', lineHeight: 1.4, cursor: 'grab', flexShrink: 0, userSelect: 'none' }}>⠿</span>
            )}
            <span
              className="editable-cell"
              style={{ cursor: 'text', flex: 1, whiteSpace: 'pre-wrap' }}
              onClick={() => { setIdeaVal(c.idea); setEditingIdea(true) }}
            >
              {c.idea}
            </span>
          </span>
        )}
      </td>
      <td>
        {p ? <span style={{ background: col.bg, color: col.text, padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: 500 }}>{p.name}</span> : '—'}
      </td>
      <td>
        <select className={`${statusCls} status-select`} value={c.status} onChange={e => onStatusChange(c.id, 'status', e.target.value)}>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
      </td>
      <td>
        <AutoTextarea value={c.notes} placeholder="Notes…" onBlur={val => onNoteChange(c.id, val)} />
      </td>
      <td><button className="del-btn" onClick={() => onDelete(c.id)}>×</button></td>
    </tr>
  )
}

export default function Content({ state, setState, user, isDemo }) {
  const [postedCollapsed, setPostedCollapsed] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedColor, setSelectedColor] = useState(0)
  const [newPillarName, setNewPillarName] = useState('')

  // Add content form
  const [newIdea, setNewIdea]     = useState('')
  const [newPillar, setNewPillar] = useState(state.pillars[0]?.id || 1)
  const [newStatus, setNewStatus] = useState('Idea')
  const [newNotes, setNewNotes]   = useState('')
  const newNotesRef = useRef(null)
  const newIdeaRef = useRef(null)

  const dragSrcId = useRef(null)

  function setFilter(f) {
    setState(prev => ({ ...prev, contentFilter: f }))
  }

  function updateContent(id, field, val) {
    setState(prev => ({
      ...prev,
      content: prev.content.map(c => c.id === id ? { ...c, [field]: val } : c),
    }))
    if (!isDemo) db.updateContentItem(id, { [field]: val }).catch(console.error)
  }

  function deleteContent(id) {
    setState(prev => ({ ...prev, content: prev.content.filter(c => c.id !== id) }))
    if (!isDemo) db.deleteContentItem(id).catch(console.error)
  }

  async function addContentRow() {
    if (!newIdea.trim()) return
    const item = { idea: newIdea.trim(), pillarId: Number(newPillar), status: newStatus, notes: newNotes }
    if (isDemo) {
      setState(prev => ({ ...prev, content: [...prev.content, { id: uid(), ...item }] }))
    } else {
      const id = await db.insertContentItem(user.id, item, state.content.length).catch(console.error)
      if (id) setState(prev => ({ ...prev, content: [...prev.content, { id, ...item }] }))
    }
    setNewIdea('')
    setNewNotes('')
    if (newIdeaRef.current) newIdeaRef.current.style.height = 'auto'
    if (newNotesRef.current) newNotesRef.current.style.height = 'auto'
  }

  function handleDragStart(id) {
    dragSrcId.current = id
  }

  function handleDrop(targetId) {
    if (dragSrcId.current == null || dragSrcId.current === targetId) return
    const items = [...state.content]
    const srcIdx = items.findIndex(x => x.id === dragSrcId.current)
    const tgtIdx = items.findIndex(x => x.id === targetId)
    if (srcIdx === -1 || tgtIdx === -1) return
    const [removed] = items.splice(srcIdx, 1)
    items.splice(tgtIdx, 0, removed)
    setState(prev => ({ ...prev, content: items }))
    if (!isDemo) db.updateContentOrder(items).catch(console.error)
    dragSrcId.current = null
  }

  async function savePillar() {
    if (!newPillarName.trim()) return
    const pillar = { name: newPillarName.trim(), colorIdx: selectedColor }
    if (isDemo) {
      setState(prev => ({ ...prev, pillars: [...prev.pillars, { id: uid(), ...pillar }] }))
    } else {
      const id = await db.insertPillar(user.id, pillar, state.pillars.length).catch(console.error)
      if (id) setState(prev => ({ ...prev, pillars: [...prev.pillars, { id, ...pillar }] }))
    }
    setNewPillarName('')
  }

  function deletePillar(id) {
    setState(prev => ({ ...prev, pillars: prev.pillars.filter(p => p.id !== id) }))
    if (!isDemo) db.deletePillar(id).catch(console.error)
  }

  const f = state.contentFilter
  const active = state.content.filter(c => c.status !== 'Posted' && (f === 'all' || c.pillarId === f))
  const posted = state.content.filter(c => c.status === 'Posted' && (f === 'all' || c.pillarId === f))

  return (
    <div className="panel">
      {/* Toolbar */}
      <div className="content-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: 'var(--text2)', marginRight: '4px' }}>Filter:</span>
          <button
            className={'pillar-chip' + (f === 'all' ? ' selected' : '')}
            onClick={() => setFilter('all')}
            style={{ background: 'var(--surface2)', color: 'var(--text2)' }}
          >
            All
          </button>
          {state.pillars.map(p => {
            const c = PILLAR_COLORS[p.colorIdx] || PILLAR_COLORS[0]
            return (
              <button
                key={p.id}
                className={'pillar-chip' + (f === p.id ? ' selected' : '')}
                onClick={() => setFilter(p.id)}
                style={{ background: c.bg, color: c.text }}
              >
                {p.name}
              </button>
            )
          })}
        </div>
        <button className="btn-ghost" onClick={() => setModalOpen(true)} style={{ fontSize: '12px' }}>Manage Pillars</button>
      </div>

      {/* Content table */}
      <div className="content-table-wrap">
        <table style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '220px' }} />
            <col style={{ width: '150px' }} />
            <col style={{ width: '110px' }} />
            <col style={{ width: '260px' }} />
            <col style={{ width: '34px' }} />
          </colgroup>
          <thead>
            <tr>
              <th>Reel Idea</th>
              <th>Content Pillar</th>
              <th>Status</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {active.map(c => (
              <ContentRow
                key={c.id}
                c={c}
                pillars={state.pillars}
                onStatusChange={updateContent}
                onNoteChange={(id, val) => updateContent(id, 'notes', val)}
                onDelete={deleteContent}
                onDragStart={handleDragStart}
                onDrop={handleDrop}
                allowDrag
              />
            ))}
          </tbody>
        </table>

        {/* Posted section */}
        {posted.length > 0 && (
          <div
            className="posted-section-label"
            onClick={() => setPostedCollapsed(v => !v)}
          >
            <span>Posted (Archived)</span>
            <span className={'collapse-icon' + (!postedCollapsed ? ' open' : '')}>&#9650;</span>
          </div>
        )}
        {!postedCollapsed && posted.length > 0 && (
          <table style={{ tableLayout: 'fixed', opacity: 0.45 }}>
            <colgroup>
              <col style={{ width: '220px' }} />
              <col style={{ width: '150px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '260px' }} />
              <col style={{ width: '34px' }} />
            </colgroup>
            <tbody>
              {posted.map(c => (
                <ContentRow
                  key={c.id}
                  c={c}
                  pillars={state.pillars}
                  onStatusChange={updateContent}
                  onNoteChange={(id, val) => updateContent(id, 'notes', val)}
                  onDelete={deleteContent}
                  onDragStart={handleDragStart}
                  onDrop={handleDrop}
                  allowDrag={false}
                />
              ))}
            </tbody>
          </table>
        )}

        {/* Add row */}
        <div className="add-content-row">
          <textarea
            ref={newIdeaRef}
            className="form-input"
            placeholder="Reel idea..."
            value={newIdea}
            rows={1}
            onChange={e => { setNewIdea(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addContentRow() } }}
            style={{ fontSize: '12px', padding: '5px 8px', resize: 'none', overflow: 'hidden' }}
          />
          <select className="form-select" value={newPillar} onChange={e => setNewPillar(e.target.value)} style={{ fontSize: '12px', padding: '4px 8px' }}>
            {state.pillars.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="form-select" value={newStatus} onChange={e => setNewStatus(e.target.value)} style={{ fontSize: '12px', padding: '4px 8px' }}>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          <textarea
            ref={newNotesRef}
            className="form-input"
            placeholder="Notes..."
            rows={1}
            value={newNotes}
            onChange={e => { setNewNotes(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addContentRow() } }}
            style={{ fontSize: '12px', padding: '5px 8px' }}
          />
          <button className="btn-primary" onClick={addContentRow} style={{ width: 'auto', padding: '5px 14px', fontSize: '12px', whiteSpace: 'nowrap' }}>Add</button>
        </div>
      </div>

      {/* Pillar Manager Modal */}
      {modalOpen && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="modal">
            <h3>Manage Content Pillars</h3>
            <div style={{ marginBottom: '16px' }}>
              {state.pillars.map(p => {
                const c = PILLAR_COLORS[p.colorIdx] || PILLAR_COLORS[0]
                return (
                  <div key={p.id} className="pillar-list-item">
                    <div className="pillar-color-dot" style={{ background: c.text }} />
                    <div style={{ flex: 1, fontSize: '13px' }}>{p.name}</div>
                    <button className="del-btn" onClick={() => deletePillar(p.id)}>×</button>
                  </div>
                )
              })}
            </div>
            <div style={{ marginBottom: '8px' }}>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '4px' }}>New Pillar Name</label>
              <input
                className="form-input"
                placeholder="e.g. Vlog, Tutorial, Story..."
                value={newPillarName}
                onChange={e => setNewPillarName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') savePillar() }}
                style={{ fontSize: '13px', marginBottom: '8px' }}
              />
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>Colour</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {PILLAR_COLORS.map((c, i) => (
                  <div
                    key={i}
                    className={'color-swatch' + (selectedColor === i ? ' selected' : '')}
                    style={{ background: c.text }}
                    onClick={() => setSelectedColor(i)}
                  />
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn-primary" onClick={savePillar} style={{ width: 'auto', padding: '7px 16px' }}>Add Pillar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
