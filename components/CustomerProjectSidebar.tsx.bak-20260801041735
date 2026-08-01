'use client'
// ═══════════════════════════════════════════════════════════════
// CustomerProjectSidebar — THE one sidebar for the whole admin.
// Used by /admin/home AND /admin/project/[id]. Add features HERE
// and they appear everywhere automatically.
// Features: customer tree, folders (create/rename/delete),
// drag-&-drop project→folder, add project (incl. into a folder),
// ⧉ copy project, ⬇ Excel export, delete project/customer,
// ＋ New Customer, active-project highlight.
// ═══════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const STATUS_COLOR: Record<string, string> = {
  draft:'#E8C96B', sent:'#93C5FD', viewed:'#D8B4FE', confirmed:'#5EEAD4',
  invoiced:'#FCD34D', completed:'#6EE7A0', cancelled:'#FCA5A5',
}

type QF = { open: boolean; name: string; email: string; addr: string; phone: string; folderId?: string | null }

export default function CustomerProjectSidebar({ activeProjectId, refreshKey = 0, onChanged }: {
  activeProjectId?: string; refreshKey?: number; onChanged?: () => void
}) {
  const router = useRouter()
  const [customers, setCustomers] = useState<any[]>([])
  const [folders, setFolders] = useState<any[]>([])
  const [projFolderMap, setProjFolderMap] = useState<Record<string, string>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [folderExpanded, setFolderExpanded] = useState<Record<string, boolean>>({})
  const [dragProj, setDragProj] = useState<string | null>(null)
  const [quickForm, setQuickForm] = useState<Record<string, QF>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const [showNewCust, setShowNewCust] = useState(false)
  const [newCust, setNewCust] = useState({ name: '', email: '', phone: '' })
  const [newCustBusy, setNewCustBusy] = useState(false)

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), type === 'err' ? 6000 : 3000)
  }

  const load = () => fetch('/api/customers', { cache: 'no-store' }).then(r => r.json()).then(d => {
    if (!Array.isArray(d)) return
    setCustomers(d)
    setExpanded(prev => {
      const exp = { ...prev }
      d.forEach((c: any) => {
        if (c.projects?.some((p: any) => p.id === activeProjectId)) exp[c.id] = true
        else if (exp[c.id] === undefined && c.projects?.length) exp[c.id] = true
      })
      return exp
    })
  }).catch(() => {})

  const loadFolders = () => fetch('/api/folders', { cache: 'no-store' }).then(r => r.json()).then(d => {
    if (!d?.folders) return
    setFolders(d.folders)
    setProjFolderMap(d.mapping || {})
    if (activeProjectId && d.mapping?.[activeProjectId]) {
      setFolderExpanded(prev => ({ ...prev, [d.mapping[activeProjectId]]: true }))
    }
  }).catch(() => {})

  const changed = async () => { await load(); await loadFolders(); onChanged?.() }

  useEffect(() => { load(); loadFolders() }, [refreshKey])

  const foldersByCust: Record<string, any[]> = {}
  folders.forEach(f => { (foldersByCust[f.customer_id] = foldersByCust[f.customer_id] || []).push(f) })

  // ── folder ops ──
  const createFolder = async (custId: string) => {
    const name = prompt('Folder name:')
    if (!name?.trim()) return
    const res = await fetch('/api/folders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer_id: custId, name: name.trim() }) })
    if (!res.ok) { const d = await res.json().catch(() => ({})); showToast(d.error || 'Could not create folder', 'err'); return }
    const created = await res.json().catch(() => null)
    await changed()
    if (created?.id) setFolderExpanded(p => ({ ...p, [created.id]: true }))
    showToast('Folder created')
  }
  const renameFolder = async (f: any) => {
    const name = prompt('Rename folder:', f.name)
    if (!name?.trim() || name.trim() === f.name) return
    const res = await fetch(`/api/folders/${f.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim() }) })
    if (!res.ok) { showToast('Rename failed', 'err'); return }
    await changed(); showToast('Folder renamed')
  }
  const deleteFolder = async (f: any) => {
    if (!confirm(`Delete folder "${f.name}"? Projects inside move to Unfiled (nothing is deleted).`)) return
    const res = await fetch(`/api/folders/${f.id}`, { method: 'DELETE' })
    if (!res.ok) { showToast('Delete failed', 'err'); return }
    await changed(); showToast('Folder deleted — projects moved to Unfiled')
  }
  const moveProject = async (projId: string, folderId: string | null) => {
    setDragProj(null)
    const res = await fetch('/api/folders/move', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project_id: projId, folder_id: folderId }) })
    if (!res.ok) { showToast('Move failed', 'err'); return }
    await changed(); showToast(folderId ? 'Moved to folder' : 'Moved to Unfiled')
  }

  // ── project ops ──
  const exportExcel = (projId: string, e?: any) => { e?.stopPropagation?.(); window.location.href = `/api/projects/${projId}/export` }
  const duplicateProject = async (p: any, e?: any) => {
    e?.stopPropagation?.()
    const name = prompt('Name for the copy:', `${p.name} (Copy)`)
    if (!name?.trim()) return
    const res = await fetch(`/api/projects/${p.id}/duplicate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim() }) })
    if (!res.ok) { const d = await res.json().catch(() => ({})); showToast(d.error || 'Copy failed', 'err'); return }
    await changed(); showToast('Project copied')
  }
  const deleteProject = async (p: any, e?: any) => {
    e?.stopPropagation?.()
    if (!confirm(`Delete project "${p.name}"? This cannot be undone.`)) return
    await fetch(`/api/projects/${p.id}`, { method: 'DELETE' })
    await changed()
    if (p.id === activeProjectId) router.push('/admin/home')
  }
  const deleteCustomer = async (c: any, e?: any) => {
    e?.stopPropagation?.()
    if (!confirm(`Delete customer "${c.name}" and ALL their projects? This cannot be undone.`)) return
    const wasViewingTheirs = c.projects?.some((p: any) => p.id === activeProjectId)
    await fetch(`/api/customers/${c.id}`, { method: 'DELETE' })
    await changed()
    if (wasViewingTheirs) router.push('/admin/home')
  }

  const openQuickForm = (c: any, folderId: string | null) => {
    setExpanded(p => ({ ...p, [c.id]: true }))
    if (folderId) setFolderExpanded(p => ({ ...p, [folderId]: true }))
    setQuickForm(p => ({ ...p, [c.id]: { open: true, name: '', email: c.email, addr: '', phone: c.phone || '', folderId } }))
  }

  const quickCreate = async (custId: string, custEmail: string) => {
    const qf = quickForm[custId]
    if (!qf?.name?.trim()) return showToast('Enter a project name', 'err')
    setSaving(custId)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: custId, name: qf.name.trim(), email: qf.email || custEmail, phone: qf.phone || null, address: qf.addr || null, status: 'draft' }),
      })
      const text = await res.text()
      let data: any = {}
      try { data = text ? JSON.parse(text) : {} } catch { showToast('Server returned an unexpected response', 'err'); return }
      if (!res.ok) { showToast(data.error || 'Could not create project', 'err'); return }
      if (qf.folderId && data.id) {
        await fetch('/api/folders/move', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project_id: data.id, folder_id: qf.folderId }) }).catch(() => {})
      }
      setQuickForm(p => ({ ...p, [custId]: { open: false, name: '', email: '', addr: '', phone: '', folderId: null } }))
      onChanged?.()
      router.push(`/admin/project/${data.id}`)
    } catch (err: any) { showToast('Network error: ' + err.message, 'err') } finally { setSaving(null) }
  }

  const createCustomer = async () => {
    if (!newCust.name.trim() || !newCust.email.trim()) return showToast('Name and email required', 'err')
    setNewCustBusy(true)
    try {
      const res = await fetch('/api/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...newCust, status: 'active' }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { showToast(d.error || 'Could not create customer', 'err'); return }
      setNewCust({ name: '', email: '', phone: '' }); setShowNewCust(false)
      await changed(); showToast('Customer created')
    } catch (err: any) { showToast('Network error: ' + err.message, 'err') } finally { setNewCustBusy(false) }
  }

  const projRow = (p: any) => {
    const isActive = p.id === activeProjectId
    return (
      <div key={p.id}
        draggable
        onDragStart={() => setDragProj(p.id)}
        onDragEnd={() => setDragProj(null)}
        title="Drag onto a folder to move"
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', borderRadius: 5, fontSize: 13, marginBottom: 2,
          background: isActive ? 'rgba(201,168,76,.15)' : 'transparent',
          opacity: dragProj === p.id ? .45 : 1, cursor: 'grab' }}>
        <span onClick={() => router.push(`/admin/project/${p.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1, cursor: 'pointer', color: isActive ? '#C9A84C' : 'rgba(255,255,255,.55)', minWidth: 0 }}>
          <span style={{ fontSize: 13, flexShrink: 0 }}>📋</span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 6, background: 'rgba(255,255,255,.08)', color: STATUS_COLOR[p.status] || '#E8C96B', flexShrink: 0 }}>{p.status}</span>
        </span>
        <button onClick={e => duplicateProject(p, e)} title="Copy project"
          style={{ background: 'none', border: 'none', color: 'rgba(216,180,254,.7)', cursor: 'pointer', fontSize: 12, padding: '2px 3px', flexShrink: 0, lineHeight: 1 }}>⧉</button>
        <button onClick={e => exportExcel(p.id, e)} title="Download Excel"
          style={{ background: 'none', border: 'none', color: 'rgba(94,234,212,.7)', cursor: 'pointer', fontSize: 12, padding: '2px 3px', flexShrink: 0, lineHeight: 1 }}>⬇</button>
        <button onClick={e => deleteProject(p, e)} title="Delete project"
          style={{ background: 'none', border: 'none', color: 'rgba(239,68,68,.5)', cursor: 'pointer', fontSize: 12, padding: '2px 4px', flexShrink: 0, lineHeight: 1 }}>✕</button>
      </div>
    )
  }

  const quickFormBox = (c: any, qf: QF) => {
    const targetFolder = qf.folderId ? folders.find((f: any) => f.id === qf.folderId) : null
    return (
      <div style={{ margin: '6px 4px 8px', padding: 10, background: 'rgba(201,168,76,.08)', borderRadius: 7, border: '1px solid rgba(201,168,76,.2)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#C9A84C', marginBottom: 8 }}>
          New Project{targetFolder ? <span style={{ color: 'rgba(255,255,255,.6)', fontWeight: 400 }}> → 📁 {targetFolder.name}</span> : null}
        </div>
        <input autoFocus placeholder="Project name *" value={qf.name}
          onChange={e => setQuickForm(p => ({ ...p, [c.id]: { ...qf, name: e.target.value } }))}
          onKeyDown={e => { if (e.key === 'Enter') quickCreate(c.id, c.email) }}
          style={{ width: '100%', padding: '5px 7px', border: '1px solid rgba(201,168,76,.3)', borderRadius: 4, fontSize: 12, background: '#2a2a2a', color: '#fff', marginBottom: 5, outline: 'none', boxSizing: 'border-box' }} />
        <input placeholder={`Email (${c.email})`} value={qf.email}
          onChange={e => setQuickForm(p => ({ ...p, [c.id]: { ...qf, email: e.target.value } }))}
          style={{ width: '100%', padding: '5px 7px', border: '1px solid rgba(255,255,255,.1)', borderRadius: 4, fontSize: 12, background: '#2a2a2a', color: '#fff', marginBottom: 5, outline: 'none', boxSizing: 'border-box' }} />
        <input placeholder="Address" value={qf.addr}
          onChange={e => setQuickForm(p => ({ ...p, [c.id]: { ...qf, addr: e.target.value } }))}
          style={{ width: '100%', padding: '5px 7px', border: '1px solid rgba(255,255,255,.1)', borderRadius: 4, fontSize: 12, background: '#2a2a2a', color: '#fff', marginBottom: 7, outline: 'none', boxSizing: 'border-box' }} />
        <div style={{ display: 'flex', gap: 5 }}>
          <button onClick={() => quickCreate(c.id, c.email)} disabled={saving === c.id}
            style={{ flex: 1, background: '#C9A84C', color: '#1C1C1E', border: 'none', padding: 6, borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
            {saving === c.id ? 'Creating…' : '✓ Create'}
          </button>
          <button onClick={() => setQuickForm(p => ({ ...p, [c.id]: { ...qf, open: false } }))}
            style={{ background: 'transparent', color: '#9AA5B4', border: '1px solid rgba(255,255,255,.1)', padding: '6px 10px', borderRadius: 5, fontSize: 11, cursor: 'pointer' }}>✕</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '10px 12px 0' }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: '#9AA5B4', marginBottom: 9 }}>Customers</div>
      {customers.map(c => {
        const isExp = !!expanded[c.id]
        const qf = quickForm[c.id] || { open: false, name: '', email: '', addr: '', phone: '', folderId: null }
        const custFolders = foldersByCust[c.id] || []
        const unfiled = (c.projects || []).filter((p: any) => !projFolderMap[p.id])
        return (
          <div key={c.id} style={{ marginBottom: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px', borderRadius: 7, cursor: 'pointer', background: isExp ? 'rgba(255,255,255,.05)' : 'transparent' }}
              onClick={() => setExpanded(p => ({ ...p, [c.id]: !p[c.id] }))}>
              <span style={{ fontSize: 11, color: '#9AA5B4', transform: isExp ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: '.15s', flexShrink: 0 }}>▶</span>
              <span style={{ fontSize: 14 }}>👤</span>
              <span style={{ flex: 1, color: 'rgba(255,255,255,.7)', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
              <span style={{ fontSize: 10, background: 'rgba(255,255,255,.08)', color: '#9AA5B4', padding: '2px 6px', borderRadius: 8, flexShrink: 0 }}>{c.projects?.length || 0}</span>
              <button onClick={e => { e.stopPropagation(); createFolder(c.id) }} title="New folder"
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.4)', cursor: 'pointer', fontSize: 13, padding: '0 2px', flexShrink: 0, lineHeight: 1 }}>📁</button>
              <button onClick={e => { e.stopPropagation(); openQuickForm(c, null) }} title="Add project"
                style={{ background: 'none', border: 'none', color: 'rgba(201,168,76,.7)', cursor: 'pointer', fontSize: 16, padding: '0 3px', flexShrink: 0, lineHeight: 1 }}>＋</button>
              <button onClick={e => deleteCustomer(c, e)} title="Delete customer"
                style={{ background: 'none', border: 'none', color: 'rgba(239,68,68,.45)', cursor: 'pointer', fontSize: 12, padding: '0 2px', flexShrink: 0, lineHeight: 1 }}>✕</button>
            </div>

            {isExp && (
              <div style={{ paddingLeft: 20, paddingBottom: 4 }}>
                {custFolders.map((f: any) => {
                  const fProjects = (c.projects || []).filter((p: any) => projFolderMap[p.id] === f.id)
                  const fExp = !!folderExpanded[f.id]
                  return (
                    <div key={f.id}>
                      <div
                        onClick={() => setFolderExpanded(p => ({ ...p, [f.id]: !p[f.id] }))}
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => { e.preventDefault(); if (dragProj) moveProject(dragProj, f.id) }}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 5, cursor: 'pointer',
                          fontSize: 12, color: 'rgba(255,255,255,.65)', marginBottom: 2,
                          background: dragProj ? 'rgba(201,168,76,.12)' : 'transparent',
                          border: dragProj ? '1px dashed rgba(201,168,76,.45)' : '1px solid transparent' }}>
                        <span style={{ fontSize: 9, transform: fExp ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: '.15s', flexShrink: 0 }}>▶</span>
                        <span style={{ flexShrink: 0 }}>📁</span>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                        <span style={{ fontSize: 9, background: 'rgba(255,255,255,.08)', padding: '1px 5px', borderRadius: 7, flexShrink: 0 }}>{fProjects.length}</span>
                        <button onClick={e => { e.stopPropagation(); openQuickForm(c, f.id) }} title="Add project in this folder"
                          style={{ background: 'none', border: 'none', color: 'rgba(201,168,76,.7)', cursor: 'pointer', fontSize: 13, padding: '0 2px', lineHeight: 1 }}>＋</button>
                        <button onClick={e => { e.stopPropagation(); renameFolder(f) }} title="Rename folder"
                          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.35)', cursor: 'pointer', fontSize: 11, padding: '0 2px', lineHeight: 1 }}>✎</button>
                        <button onClick={e => { e.stopPropagation(); deleteFolder(f) }} title="Delete folder"
                          style={{ background: 'none', border: 'none', color: 'rgba(239,68,68,.5)', cursor: 'pointer', fontSize: 11, padding: '0 2px', lineHeight: 1 }}>✕</button>
                      </div>
                      {fExp && (
                        <div style={{ paddingLeft: 16 }}>
                          {fProjects.map((p: any) => projRow(p))}
                          {qf.open && qf.folderId === f.id
                            ? quickFormBox(c, qf)
                            : (
                              <button onClick={() => openQuickForm(c, f.id)}
                                style={{ background: 'none', border: 'none', color: 'rgba(201,168,76,.5)', fontSize: 11, padding: '3px 8px', cursor: 'pointer', fontFamily: 'Inter,sans-serif', textAlign: 'left' }}>
                                ＋ Add project here
                              </button>
                            )}
                          {!fProjects.length && <div style={{ fontSize: 10, color: '#9AA5B4', padding: '0 8px 3px' }}>Empty — drag a project here or use ＋ above</div>}
                        </div>
                      )}
                    </div>
                  )
                })}

                <div
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); if (dragProj) moveProject(dragProj, null) }}
                  style={dragProj ? { border: '1px dashed rgba(255,255,255,.25)', borderRadius: 5, padding: 2, marginTop: 2 } : {}}>
                  {custFolders.length > 0 && unfiled.length > 0 && (
                    <div style={{ fontSize: 9, color: '#9AA5B4', textTransform: 'uppercase', letterSpacing: 1, padding: '4px 8px' }}>Unfiled</div>
                  )}
                  {dragProj && custFolders.length > 0 && unfiled.length === 0 && (
                    <div style={{ fontSize: 10, color: '#9AA5B4', padding: '3px 8px' }}>Drop here to unfile</div>
                  )}
                  {unfiled.map((p: any) => projRow(p))}
                </div>

                {!c.projects?.length && !qf.open && !custFolders.length && (
                  <div style={{ fontSize: 11, color: '#9AA5B4', padding: '5px 10px' }}>No projects yet</div>
                )}
                {qf.open && !qf.folderId ? quickFormBox(c, qf) : null}
                {!qf.open && (
                  <button onClick={() => openQuickForm(c, null)}
                    style={{ background: 'none', border: 'none', color: 'rgba(201,168,76,.5)', fontSize: 11, padding: '4px 8px', cursor: 'pointer', fontFamily: 'Inter,sans-serif', textAlign: 'left' }}>
                    ＋ Add project
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
      {!customers.length && <div style={{ fontSize: 12, color: '#9AA5B4', padding: '4px 0' }}>No customers yet</div>}

      {showNewCust ? (
        <div style={{ margin: '8px 0 12px', padding: 10, background: 'rgba(201,168,76,.08)', borderRadius: 7, border: '1px solid rgba(201,168,76,.25)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#C9A84C', marginBottom: 8 }}>New Customer</div>
          <input autoFocus placeholder="Name *" value={newCust.name} onChange={e => setNewCust(p => ({ ...p, name: e.target.value }))}
            style={{ width: '100%', padding: '5px 7px', border: '1px solid rgba(201,168,76,.3)', borderRadius: 4, fontSize: 12, background: '#2a2a2a', color: '#fff', marginBottom: 5, outline: 'none', boxSizing: 'border-box' }} />
          <input placeholder="Email *" value={newCust.email} onChange={e => setNewCust(p => ({ ...p, email: e.target.value }))}
            style={{ width: '100%', padding: '5px 7px', border: '1px solid rgba(255,255,255,.1)', borderRadius: 4, fontSize: 12, background: '#2a2a2a', color: '#fff', marginBottom: 5, outline: 'none', boxSizing: 'border-box' }} />
          <input placeholder="Phone" value={newCust.phone} onChange={e => setNewCust(p => ({ ...p, phone: e.target.value }))}
            style={{ width: '100%', padding: '5px 7px', border: '1px solid rgba(255,255,255,.1)', borderRadius: 4, fontSize: 12, background: '#2a2a2a', color: '#fff', marginBottom: 7, outline: 'none', boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 5 }}>
            <button onClick={createCustomer} disabled={newCustBusy}
              style={{ flex: 1, background: '#C9A84C', color: '#1C1C1E', border: 'none', padding: 6, borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              {newCustBusy ? 'Creating…' : '✓ Create Customer'}
            </button>
            <button onClick={() => setShowNewCust(false)}
              style={{ background: 'transparent', color: '#9AA5B4', border: '1px solid rgba(255,255,255,.1)', padding: '6px 10px', borderRadius: 5, fontSize: 11, cursor: 'pointer' }}>✕</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowNewCust(true)}
          style={{ margin: '8px 0 12px', width: '100%', background: 'rgba(201,168,76,.1)', border: '1px dashed rgba(201,168,76,.3)', color: '#C9A84C', padding: 8, borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
          ＋ New Customer
        </button>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 70, left: '50%', transform: 'translateX(-50%)', background: toast.type === 'err' ? '#E53E3E' : '#1C1C1E', color: '#fff', padding: '10px 18px', borderRadius: 8, fontSize: 12, fontWeight: 500, boxShadow: '0 8px 24px rgba(0,0,0,.25)', zIndex: 999, borderLeft: `3px solid ${toast.type === 'err' ? '#fff' : '#C9A84C'}` }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
