'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'

const CONV = 0.00064516
const MOUNTS = ['Inside','Outside']
const VALANCES = ['—','Standard','Deluxe','Hidden','Corniced']
const BRAILS = ['—','Standard','Weighted','Decorative']
const FABRICS_DEFAULT = ['YX2501','YX2501 + YX2509','M1001-1','Standard','Blackout','Solar 3%','Solar 5%','Natural','Custom']
// Matches the status color-coding already used in /admin/home's sidebar, so a
// project's status reads the same way in both places.
const SIDEBAR_STATUS_COLOR: Record<string,string> = {
  draft:'#E8C96B', sent:'#93C5FD', viewed:'#D8B4FE', confirmed:'#5EEAD4', invoiced:'#FCD34D', completed:'#6EE7A0', cancelled:'#FCA5A5'
}
const OPTIONAL_COLS = [
  { key:'fabric', label:'Fabric' },
  { key:'valance', label:'Valance' },
  { key:'bottom_rail', label:'Bottom Rail' },
  { key:'mount', label:'Mount' },
  { key:'remark', label:'Remarks' },
]

type Row = { id:string; is_section:boolean; section_name?:string; blind_type:string; control:string; location:string; fabric:string; valance:string; bottom_rail:string; mount:string; width_in:number|''; height_in:number|''; qty:number; remark:string }
type Config = { tax_pct:number; shipping_pct:number; discount_pct:number; discount_reason:string; installation:number }
type Product = { id:string; name:string; my_cost_per_sqm:number; factor:number }
type Motor = { id:string; name:string; my_cost_per_unit:number; factor:number }
type Fee = { id?:string; label:string; fee_type:'flat'|'pct'; value:number }
type Invoice = { id:string; invoice_number:string; status:string; total_amount:number|null; sequence_num:number|null; invoice_type:string|null; pct_of_total:number|null; payment_method:string|null; square_surcharge:number|null; fully_paid_at:string|null; created_at:string }
type GrievancePhoto = { id:string; photo_url:string; caption:string|null }
type GrievanceUpdate = { id:string; note:string; created_at:string }
type Grievance = { id:string; title:string; description:string|null; status:string; resolution_note:string|null; created_at:string; resolved_at:string|null; grievance_photos:GrievancePhoto[]; grievance_updates:GrievanceUpdate[] }
type ManualEmail = { id:string; to_email:string; subject:string; body:string; sent_at:string }

export default function AdminProjectPage() {
  const { id } = useParams()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastCellRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null)

  const [project, setProject] = useState<any>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [config, setConfig] = useState<Config>({ tax_pct:10, shipping_pct:18, discount_pct:0, discount_reason:'', installation:500 })
  const [products, setProducts] = useState<Product[]>([])
  const [motors, setMotors] = useState<Motor[]>([])
  const [selId, setSelId] = useState<string|null>(null)
  const [tab, setTab] = useState<'sheet'|'purchase'|'summary'|'invoices'|'grievances'|'email'>('sheet')
  const [pushing, setPushing] = useState(false)
  const [fees, setFees] = useState<Fee[]>([])
  const [sendingEmail, setSendingEmail] = useState(false)
  const [customers, setCustomers] = useState<any[]>([])
  const [expandedCust, setExpandedCust] = useState<Record<string,boolean>>({})
  const [isPushed, setIsPushed] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [importStatus, setImportStatus] = useState<{msg:string; type:'ok'|'error'|'info'}|null>(null)
  const [newProdName, setNewProdName] = useState(''); const [newProdCost, setNewProdCost] = useState(15); const [newProdFactor, setNewProdFactor] = useState(5)
  const [newMotorName, setNewMotorName] = useState(''); const [newMotorCost, setNewMotorCost] = useState(30); const [newMotorFactor, setNewMotorFactor] = useState(3)

  // ── NEW: Invoices / Grievances / Email state ──
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [grievances, setGrievances] = useState<Grievance[]>([])
  const [emails, setEmails] = useState<ManualEmail[]>([])
  const [showAddInvoice, setShowAddInvoice] = useState(false)
  const [newInvPct, setNewInvPct] = useState(30)
  const [newInvMethod, setNewInvMethod] = useState<'cash'|'square'>('cash')
  const [expandedInv, setExpandedInv] = useState<Record<string,boolean>>({})
  const [editInvPct, setEditInvPct] = useState<Record<string,number>>({})
  const [editInvMethod, setEditInvMethod] = useState<Record<string,'cash'|'square'>>({})
  const [invBusy, setInvBusy] = useState(false)
  const [showAddGrievance, setShowAddGrievance] = useState(false)
  const [newGrievTitle, setNewGrievTitle] = useState('')
  const [newGrievDesc, setNewGrievDesc] = useState('')
  const [newGrievFile, setNewGrievFile] = useState<File|null>(null)
  const [grievBusy, setGrievBusy] = useState(false)
  const [expandedGriev, setExpandedGriev] = useState<Record<string,boolean>>({})
  const [expandedEmail, setExpandedEmail] = useState<Record<string,boolean>>({})
  const [toast, setToast] = useState<{msg:string,type:'ok'|'err'}|null>(null)
  const [pendingDelete, setPendingDelete] = useState<string|null>(null) // id of row/customer/project asking "really delete?"
  const [resolvingGriev, setResolvingGriev] = useState<string|null>(null)
  const [resolveNote, setResolveNote] = useState('')
  const [addingProjectFor, setAddingProjectFor] = useState<string|null>(null)
  const [newProjName, setNewProjName] = useState('')
  const [newProjEmail, setNewProjEmail] = useState('')
  const [newProjAddress, setNewProjAddress] = useState('')
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set())
  const [showColsMenu, setShowColsMenu] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [newCustName, setNewCustName] = useState('')
  const [newCustEmail, setNewCustEmail] = useState('')
  const [newCustPhone, setNewCustPhone] = useState('')
  const [newCustBusy, setNewCustBusy] = useState(false)
  // Grievance updates (running log before final resolve)
  const [addingUpdateFor, setAddingUpdateFor] = useState<string|null>(null)
  const [newUpdateNote, setNewUpdateNote] = useState('')
  const [updateBusy, setUpdateBusy] = useState(false)
  const [showSendEmail, setShowSendEmail] = useState(false)
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [emailTemplateIdx, setEmailTemplateIdx] = useState(0)
  const [emailBusy, setEmailBusy] = useState(false)

  const loadAll = () => {
    fetch(`/api/projects/${id}`, { cache:'no-store' }).then(r=>{
      if (!r.ok) throw new Error('not-found')
      return r.json()
    }).then(d => {
      setProject(d)
      const rawRows = (d.project_rows || []).sort((a:any,b:any)=>a.sort_order-b.sort_order)
      setRows(rawRows.map((r:any)=>({...r, width_in:r.width_in||'', height_in:r.height_in||''})))
      if (d.project_config) setConfig(d.project_config)
      if (d.project_fees?.length) setFees(d.project_fees)
      setIsPushed(!!d.is_pushed)
      if (d.customer_id) setExpandedCust(prev=>({...prev,[d.customer_id]:true}))
      setLoadError(false)
    }).catch(()=>setLoadError(true))
    fetch('/api/products', { cache:'no-store' }).then(r=>r.json()).then(setProducts).catch(()=>setProducts([]))
    fetch('/api/motors', { cache:'no-store' }).then(r=>r.json()).then(setMotors).catch(()=>setMotors([]))
    fetch('/api/customers', { cache:'no-store' }).then(r=>r.json()).then(setCustomers).catch(()=>setCustomers([]))
    // Invoices/grievances/emails load in parallel but don't gate the initial render —
    // the Sheet tab (the default) doesn't need any of them.
    loadSecondary()
  }
  const loadSecondary = () => {
    fetch(`/api/invoices?projectId=${id}`, { cache:'no-store' }).then(r=>r.json()).then(setInvoices).catch(()=>setInvoices([]))
    fetch(`/api/grievances?projectId=${id}`, { cache:'no-store' }).then(r=>r.json()).then(setGrievances).catch(()=>setGrievances([]))
    fetch(`/api/emails?projectId=${id}`, { cache:'no-store' }).then(r=>r.json()).then(setEmails).catch(()=>setEmails([]))
  }
  useEffect(loadAll, [id])

  const rawSqm = (w:any,h:any) => parseFloat(w||0)*parseFloat(h||0)*CONV
  // Minimum billable area is 1 sq.m — a window that computes smaller than that
  // still bills (and displays) as 1 sq.m. Only applies once real dimensions are
  // entered; an empty/zero row still shows as empty, not forced to 1.
  const sqm = (w:any,h:any) => { const s = rawSqm(w,h); return s>0 ? Math.max(1,s) : 0 }
  const getProd = (type:string) => products.find(p=>p.name===type)||{my_cost_per_sqm:16, factor:5}
  const getMtr = (ctrl:string) => motors.find(m=>m.name===ctrl)||{my_cost_per_unit:0, factor:1}
  const blindsQ = (r:Row) => { const p=getProd(r.blind_type); return Math.round(sqm(r.width_in,r.height_in)*p.my_cost_per_sqm*p.factor*100)/100*(r.qty||1) }
  const motorQ = (r:Row) => { const m=getMtr(r.control); return m.my_cost_per_unit*m.factor*(r.qty||1) }
  // raw purchase cost (no factor) — what CEB actually pays, used for In-Pocket
  const blindsCost = (r:Row) => { const p=getProd(r.blind_type); return Math.round(sqm(r.width_in,r.height_in)*p.my_cost_per_sqm*100)/100*(r.qty||1) }
  const motorCost = (r:Row) => { const m=getMtr(r.control); return m.my_cost_per_unit*(r.qty||1) }
  const lineTotal = (r:Row) => (blindsQ(r)+motorQ(r))*(1-config.discount_pct/100)
  const fmt = (n:number) => (n<0?'-':'')+'$'+Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',')
  const toastTimer = useRef<any>(null)
  const showToast = (msg:string, type:'ok'|'err'='ok') => {
    setToast({msg,type})
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(()=>setToast(null), type==='err'?6000:3000)
  }
  // Generic inline "are you sure?" — first click arms it (button shows "Confirm?"),
  // second click within 3s actually runs the action. No native dialog involved.
  const confirmOrAsk = (key:string, action:()=>void) => {
    if (pendingDelete===key) { setPendingDelete(null); action() }
    else { setPendingDelete(key); setTimeout(()=>setPendingDelete(p=>p===key?null:p), 3000) }
  }

  const dataRows = rows.filter(r=>!r.is_section)
  const totB = dataRows.reduce((s,r)=>s+blindsQ(r),0)
  const totM = dataRows.reduce((s,r)=>s+motorQ(r),0)
  const totSqm = dataRows.reduce((s,r)=>s+sqm(r.width_in,r.height_in)*(parseInt(String(r.qty))||1),0)
  const totCost = dataRows.reduce((s,r)=>s+blindsCost(r)+motorCost(r),0)
  const sub = (totB+totM)*(1-config.discount_pct/100)
  const ship = sub*(config.shipping_pct/100)
  const tax = sub*(config.tax_pct/100)
  const extraTotal = fees.reduce((s,f)=>s+(f.fee_type==='pct'?sub*(f.value/100):f.value),0)
  const grand = sub+tax+ship+config.installation+extraTotal
  // In-Pocket = goods revenue (after discount) minus goods cost — excludes tax/shipping/installation
  const inPocket = sub - totCost

  // ── ROW OPERATIONS ──────────────────────────────────────
  let localIdCounter = useRef(1)
  const newLocalId = () => `new_${Date.now()}_${localIdCounter.current++}`

  const addRow = () => {
    const lid = newLocalId()
    setRows(prev=>[...prev, { id:lid, is_section:false, blind_type:products[0]?.name||'HoneyComb', control:motors[0]?.name||'Cordless', location:'', fabric:FABRICS_DEFAULT[0], valance:'—', bottom_rail:'—', mount:'Inside', width_in:'', height_in:'', qty:1, remark:'' }])
    setSelId(lid)
    setTimeout(()=>{ document.querySelector('.sheet-scroll')?.scrollTo({top:99999, behavior:'smooth'}) }, 50)
  }
  // Inserts a new row immediately AFTER a specific row, instead of always at the
  // very bottom -- used by Enter-to-add-row so it works from any row, not just
  // the last one.
  const addRowAfter = (afterId:string) => {
    const lid = newLocalId()
    const newRow: Row = { id:lid, is_section:false, blind_type:products[0]?.name||'HoneyComb', control:motors[0]?.name||'Cordless', location:'', fabric:FABRICS_DEFAULT[0], valance:'—', bottom_rail:'—', mount:'Inside', width_in:'', height_in:'', qty:1, remark:'' }
    setRows(prev=>{
      const idx = prev.findIndex(r=>r.id===afterId)
      if (idx===-1) return [...prev, newRow]
      const next=[...prev]; next.splice(idx+1,0,newRow); return next
    })
    setSelId(lid)
  }
  // Drag-to-reorder: the small handle next to each row's # is the only
  // draggable element, so you can't accidentally drag by clicking elsewhere
  // in the row (which is still used for row selection).
  const [dragRowId, setDragRowId] = useState<string|null>(null)
  const [dragOverRowId, setDragOverRowId] = useState<string|null>(null)
  const reorderRow = (draggedId:string, targetId:string) => {
    if (draggedId===targetId) return
    setRows(prev=>{
      const draggedIdx = prev.findIndex(r=>r.id===draggedId)
      const targetIdx = prev.findIndex(r=>r.id===targetId)
      if (draggedIdx===-1 || targetIdx===-1) return prev
      const next=[...prev]
      const [item] = next.splice(draggedIdx,1)
      const insertAt = next.findIndex(r=>r.id===targetId)
      next.splice(insertAt,0,item)
      return next
    })
    markDirty()
  }
  const deleteSection = (rowId:string) => {
    if (!confirm('Delete this section heading? Rows under it are kept, just ungrouped.')) return
    setRows(prev=>prev.filter(r=>r.id!==rowId))
    markDirty()
  }
  const [addingSection, setAddingSection] = useState(false)
  const [newSectionName, setNewSectionName] = useState('')
  const confirmAddSection = () => {
    const name = newSectionName.trim() || 'GROUND FLOOR'
    setRows(prev=>[...prev, { id:newLocalId(), is_section:true, section_name:name.toUpperCase(), blind_type:'', control:'', location:'', fabric:'', valance:'', bottom_rail:'', mount:'', width_in:'', height_in:'', qty:1, remark:'' }])
    setAddingSection(false); setNewSectionName('')
  }
  const toggleColumn = (key:string) => {
    setHiddenCols(prev=>{ const next=new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next })
  }
  const colVisible = (key:string) => !hiddenCols.has(key)
  const delRow = () => { if (!selId) return showToast('Select a row first','err'); setRows(prev=>prev.filter(r=>r.id!==selId)); setSelId(null) }
  const delRowById = (rid:string) => { setRows(prev=>prev.filter(r=>r.id!==rid)); if (selId===rid) setSelId(null); markDirty() }
  const dupRow = () => {
    if (!selId) return showToast('Select a row first','err')
    const s = rows.find(r=>r.id===selId); if (!s) return
    const idx = rows.findIndex(r=>r.id===selId)
    const copy = { ...s, id:newLocalId() }
    setRows(prev=>{ const next=[...prev]; next.splice(idx+1,0,copy); return next })
  }
  const upd = (id:string, field:string, val:any) => { setRows(prev=>prev.map(r=>r.id===id?{...r,[field]:val}:r)); markDirty() }

  // ── PUSH STATE ───────────────────────────────────────────
  const markDirty = () => setIsPushed(false)

  // ── PRODUCTS / MOTORS MANAGEMENT ─────────────────────────
  const updProduct = async (pid: string, field: string, val: number) => {
    setProducts(prev=>prev.map(p=>p.id===pid?{...p,[field]:val}:p))
    markDirty()
  }
  // Persists immediately (on blur) instead of only during Push — editing a price and
  // navigating away without pushing was silently losing the edit before.
  const saveProductField = async (pid: string, field: string, val: number) => {
    try {
      const res = await fetch(`/api/products/${pid}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ [field]: val }) })
      if (!res.ok) showToast('Could not save that price — it may not have persisted','err')
    } catch { showToast('Network error saving price','err') }
  }
  const addProduct = async () => {
    if (!newProdName.trim()) return showToast('Enter a product name','err')
    const res = await fetch('/api/products', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name:newProdName.trim(), my_cost_per_sqm:newProdCost, factor:newProdFactor }) })
    if (res.ok) {
      const p = await res.json()
      setProducts(prev=>[...prev, p])
      setNewProdName(''); setNewProdCost(15); setNewProdFactor(5)
      markDirty()
    } else showToast('Could not add product — it may already exist','err')
  }
  const delProduct = async (pid: string) => {
    if (products.length<=1) return showToast('Keep at least one product','err')
    await fetch(`/api/products/${pid}`, { method:'DELETE' })
    setProducts(prev=>prev.filter(p=>p.id!==pid))
    markDirty()
    showToast('Product removed','ok')
  }
  const updMotor = (mid: string, field: string, val: number) => {
    setMotors(prev=>prev.map(m=>m.id===mid?{...m,[field]:val}:m))
    markDirty()
  }
  const saveMotorField = async (mid: string, field: string, val: number) => {
    try {
      const res = await fetch(`/api/motors/${mid}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ [field]: val }) })
      if (!res.ok) showToast('Could not save that price — it may not have persisted','err')
    } catch { showToast('Network error saving price','err') }
  }
  const addMotor = async () => {
    if (!newMotorName.trim()) return showToast('Enter a name','err')
    const res = await fetch('/api/motors', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name:newMotorName.trim(), my_cost_per_unit:newMotorCost, factor:newMotorFactor }) })
    if (res.ok) {
      const m = await res.json()
      setMotors(prev=>[...prev, m])
      setNewMotorName(''); setNewMotorCost(30); setNewMotorFactor(3)
      markDirty()
    } else showToast('Could not add motor — it may already exist','err')
  }
  const delMotor = async (mid: string) => {
    await fetch(`/api/motors/${mid}`, { method:'DELETE' })
    setMotors(prev=>prev.filter(m=>m.id!==mid))
    markDirty()
    showToast('Motor/control removed','ok')
  }

  // ── NEW: SIDEBAR CUSTOMER/PROJECT MANAGEMENT (inline forms, no native dialogs) ──
  const openAddProjectForm = (customerId:string) => {
    setAddingProjectFor(customerId)
    setNewProjName('')
    setNewProjEmail(customers.find(c=>c.id===customerId)?.email || '')
    setNewProjAddress('')
  }
  const createProjectFor = async (customerId:string) => {
    if (!newProjName.trim()) return showToast('Project name required','err')
    if (!newProjEmail.trim()) return showToast('Email required','err')
    try {
      const res = await fetch('/api/projects', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ customerId, name:newProjName, email:newProjEmail, address:newProjAddress }) })
      const text = await res.text()
      let data: any = {}
      try { data = text ? JSON.parse(text) : {} } catch { showToast('Server returned an unexpected response. Status '+res.status,'err'); return }
      if (!res.ok) { showToast(data.error||'Could not create project','err'); return }
      setCustomers(prev=>prev.map(c=>c.id===customerId?{...c,projects:[...(c.projects||[]),data]}:c))
      setAddingProjectFor(null)
      router.push(`/admin/project/${data.id}`)
    } catch (err:any) {
      showToast('Network/JS error creating project: '+err.message,'err')
    }
  }
  const deleteProjectFromSidebar = async (projId:string, custId:string, e:any) => {
    e.stopPropagation()
    try {
      const res = await fetch(`/api/projects/${projId}`, { method:'DELETE' })
      if (!res.ok) { showToast('Could not delete project','err'); return }
      setCustomers(prev=>prev.map(c=>c.id===custId?{...c,projects:(c.projects||[]).filter((p:any)=>p.id!==projId)}:c))
      showToast('Project deleted','ok')
      if (projId===id) router.push('/admin/panel')
    } catch (err:any) {
      showToast('Network/JS error deleting project: '+err.message,'err')
    }
  }
  const deleteCustomerFromSidebar = async (custId:string, e:any) => {
    e.stopPropagation()
    try {
      const res = await fetch(`/api/customers/${custId}`, { method:'DELETE' })
      if (!res.ok) { showToast('Could not delete customer','err'); return }
      setCustomers(prev=>prev.filter(c=>c.id!==custId))
      showToast('Customer deleted','ok')
    } catch (err:any) {
      showToast('Network/JS error deleting customer: '+err.message,'err')
    }
  }

  // ── FEE LINES ─────────────────────────────────────────────
  const addFeeLine = () => { setFees(prev=>[...prev, { label:'Custom Fee', fee_type:'flat', value:0 }]); markDirty() }
  const updFee = (i:number, field:string, val:any) => { setFees(prev=>prev.map((f,j)=>j===i?{...f,[field]:val}:f)); markDirty() }
  const delFee = (i:number) => { setFees(prev=>prev.filter((_,j)=>j!==i)); markDirty() }

  // ── PUSH ──────────────────────────────────────────────────
  const doPush = async () => {
    setPushing(true)
    const toSave = rows.map(r=>({
      is_section: r.is_section, section_name: r.section_name||null,
      blind_type: r.blind_type||null, control: r.control||null,
      location: r.location||null, fabric: r.fabric||null,
      valance: r.valance||null, bottom_rail: r.bottom_rail||null,
      mount: r.mount||null, width_in: r.width_in||null, height_in: r.height_in||null,
      qty: r.qty||1, remark: r.remark||null
    }))
    try {
      const res = await fetch('/api/push', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ projectId:id, config, fees, rows:toSave, products, motors, grandTotal: grand }) })
      const text = await res.text()
      let data: any = {}
      try { data = text ? JSON.parse(text) : {} } catch { showToast('Server returned an unexpected response. Status '+res.status,'err'); return }
      if (!res.ok) { showToast(data.error||'Push failed','err'); return }
      // sync local project state immediately so grand_total is correct right away —
      // previously this required a full page reload to take effect, which is why
      // "Add Invoice" could fail right after a push that had actually succeeded.
      if (data.project) setProject((p:any)=>p?{...p, ...data.project}:data.project)
      setIsPushed(true)
      showToast('Pushed to customer view!','ok')
    } catch (err:any) {
      showToast('Network/JS error pushing: '+err.message,'err')
    } finally {
      setPushing(false)
    }
  }

  const acceptOnBehalf = async () => {
    setAccepting(true)
    try {
      const res = await fetch(`/api/projects/${id}/accept`, { method:'POST' })
      const text = await res.text()
      let data:any = {}
      try { data = text?JSON.parse(text):{} } catch { showToast('Server returned an unexpected response','err'); return }
      if (!res.ok) { showToast(data.error||'Could not accept','err'); return }
      setProject((p:any)=>p?{...p, status:'confirmed', confirmed_at:data.confirmed_at}:p)
      showToast('Marked accepted on customer\'s behalf','ok')
    } catch (err:any) {
      showToast('Network/JS error: '+err.message,'err')
    } finally { setAccepting(false) }
  }

  const sendEmail = async () => {
    setSendingEmail(true)
    const res = await fetch('/api/email/send-quote', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ projectId:id }) })
    const data = await res.json()
    setSendingEmail(false)
    if (data.success) showToast('Quote email sent!','ok')
    else showToast('Email failed: '+JSON.stringify(data.error),'err')
  }

  // ── NEW: INVOICES ────────────────────────────────────────
  const billedPct = invoices.filter(i=>i.status!=='void').reduce((s,i)=>s+Number(i.pct_of_total||0),0)
  const paidPct = invoices.filter(i=>i.status==='paid').reduce((s,i)=>s+Number(i.pct_of_total||0),0)
  const remainingPct = 100 - billedPct
  const paidAmount = invoices.filter(i=>i.status==='paid').reduce((s,i)=>s+Number(i.total_amount||0),0)
  const invoicedAmount = invoices.reduce((s,i)=>s+Number(i.total_amount||0),0)
  const balanceRemaining = Math.max(0, Number(project?.grand_total||0) - paidAmount)

  const createInvoice = async () => {
    setInvBusy(true)
    try {
      const res = await fetch('/api/invoices', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ projectId:id, pctOfTotal:newInvPct, method:newInvMethod }) })
      const text = await res.text()
      let data: any = {}
      try { data = text ? JSON.parse(text) : {} } catch { showToast('Server returned an unexpected response (not JSON). Status '+res.status,'err'); return }
      if (!res.ok) { showToast(data.error||'Could not create invoice','err'); return }
      setInvoices(prev=>[...prev, data])
      setShowAddInvoice(false)
      setNewInvPct(Math.min(30, remainingPct-newInvPct))
      if (project?.status==='confirmed') setProject((p:any)=>p?{...p,status:'invoiced'}:p)
    } catch (err:any) {
      showToast('Network/JS error creating invoice: '+err.message,'err')
    } finally { setInvBusy(false) }
  }
  const toggleInvExpand = (invId:string) => {
    setExpandedInv(prev=>({...prev,[invId]:!prev[invId]}))
    const inv = invoices.find(i=>i.id===invId)
    if (inv) { setEditInvPct(p=>({...p,[invId]:inv.pct_of_total||0})); setEditInvMethod(p=>({...p,[invId]:(inv.payment_method as 'cash'|'square')||'cash'})) }
  }
  const saveInvoiceEdit = async (invId:string) => {
    setInvBusy(true)
    try {
      const res = await fetch(`/api/invoices/${invId}`, { method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'edit', pctOfTotal:editInvPct[invId], method:editInvMethod[invId] }) })
      const text = await res.text()
      let data: any = {}
      try { data = text ? JSON.parse(text) : {} } catch { showToast('Server returned an unexpected response (not JSON). Status '+res.status,'err'); return }
      if (!res.ok) { showToast(data.error||'Could not save','err'); return }
      setInvoices(prev=>prev.map(i=>i.id===invId?data:i))
    } catch (err:any) {
      showToast('Network/JS error saving invoice: '+err.message,'err')
    } finally { setInvBusy(false) }
  }
  const voidInvoice = async (invId:string, currentlyVoid:boolean) => {
    setInvBusy(true)
    try {
      const res = await fetch(`/api/invoices/${invId}`, { method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action: currentlyVoid?'unvoid':'void' }) })
      const text = await res.text()
      let data: any = {}
      try { data = text ? JSON.parse(text) : {} } catch { showToast('Server returned an unexpected response','err'); return }
      if (!res.ok) { showToast(data.error||'Could not update','err'); return }
      setInvoices(prev=>prev.map(i=>i.id===invId?data:i))
      showToast(currentlyVoid?'Invoice restored':'Invoice voided','ok')
    } catch (err:any) {
      showToast('Network/JS error: '+err.message,'err')
    } finally { setInvBusy(false) }
  }
  const [confirmDeleteInv, setConfirmDeleteInv] = useState<string|null>(null)
  const deleteInvoice = async (invId:string) => {
    if (confirmDeleteInv!==invId) { setConfirmDeleteInv(invId); setTimeout(()=>setConfirmDeleteInv(p=>p===invId?null:p),3000); return }
    setConfirmDeleteInv(null)
    setInvBusy(true)
    try {
      const res = await fetch(`/api/invoices/${invId}`, { method:'DELETE' })
      const text = await res.text()
      let data: any = {}
      try { data = text ? JSON.parse(text) : {} } catch { showToast('Server returned an unexpected response','err'); return }
      if (!res.ok) { showToast(data.error||'Could not delete','err'); return }
      setInvoices(prev=>prev.filter(i=>i.id!==invId))
      showToast('Invoice deleted','ok')
    } catch (err:any) {
      showToast('Network/JS error: '+err.message,'err')
    } finally { setInvBusy(false) }
  }
  const markInvoicePaid = async (invId:string, paid:boolean) => {
    setInvBusy(true)
    try {
      const res = await fetch(`/api/invoices/${invId}`, { method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action: paid?'mark_paid':'unmark_paid' }) })
      const text = await res.text()
      let data: any = {}
      try { data = text ? JSON.parse(text) : {} } catch { showToast('Server returned an unexpected response (not JSON). Status '+res.status,'err'); return }
      if (!res.ok) { showToast(data.error||'Could not update','err'); return }
      setInvoices(prev=>prev.map(i=>i.id===invId?data:i))
      setProject((p:any)=>p ? {...p, status: paid && data.status==='paid' ? 'completed' : p.status} : p)
    } catch (err:any) {
      showToast('Network/JS error updating invoice: '+err.message,'err')
    } finally { setInvBusy(false) }
  }
  const emailInvoice = async (inv:Invoice) => {
    const subject = `Invoice ${inv.invoice_number} — ${inv.status==='paid'?'Payment Confirmation':`Due ${fmt(inv.total_amount||0)}`}`
    const body = `Hi ${project?.customers?.name||''},\n\nPlease find your invoice ${inv.invoice_number} for ${project?.name} attached as a PDF.\n\n${(inv.invoice_type||'').toUpperCase()} — ${inv.pct_of_total}% of project total\nAmount Due: ${fmt(inv.total_amount||0)}\n\nThank you,\nCustom Elegant Blinds`
    setInvBusy(true)
    try {
      const res = await fetch('/api/emails', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ projectId:id, toEmail:project?.customers?.email||project?.email, subject, body, invoiceId: inv.id }) })
      const text = await res.text()
      let data: any = {}
      try { data = text ? JSON.parse(text) : {} } catch { showToast('Server returned an unexpected response (not JSON). Status '+res.status,'err'); return }
      if (!res.ok) { showToast(data.error||'Could not send email','err'); return }
      setEmails(prev=>[data, ...prev])
      if (data.delivered) showToast('Invoice emailed to customer (PDF attached)','ok')
      else showToast('Logged, but not actually delivered: '+(data.deliveryError||'unknown error'),'err')
    } catch (err:any) {
      showToast('Network/JS error emailing invoice: '+err.message,'err')
    } finally { setInvBusy(false) }
  }
  // Uses a Blob + object URL instead of window.open('')+document.write()+print() —
  // that combination is documented (in this project's own notes) to freeze the parent
  // tab. Opening a real blob: URL avoids that entirely, and the Print button below
  // runs window.print() from INSIDE the new tab's own context, not the opener's.
  const printInvoice = (inv:Invoice) => {
    const itemsRows = dataRows.map(r=>`<tr><td>${r.location||'—'}</td><td>${r.blind_type||''}</td><td>${r.control||''}</td><td style="text-align:center">${r.qty}</td></tr>`).join('')
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${inv.invoice_number}</title><style>
      body{font-family:Arial,sans-serif;padding:32px;max-width:720px;margin:0 auto;color:#1C1C1E;}
      .hdr{display:flex;align-items:center;gap:16px;border-bottom:3px solid #8B6914;padding-bottom:14px;margin-bottom:18px;}
      .hdr img{height:60px;width:auto;object-fit:contain;}
      .co{font-family:Georgia,serif;font-size:20px;color:#8B6914;font-weight:700;}
      .tag{font-size:11px;color:#718096;}
      .meta{display:flex;justify-content:space-between;margin-bottom:18px;font-size:12px;gap:20px;}
      .status{display:inline-block;padding:3px 10px;border-radius:10px;font-weight:700;font-size:10px;}
      .paid{background:#D1FAE5;color:#065F46;} .due{background:#FEF3C7;color:#92400E;}
      h4{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#9AA5B4;margin:0 0 10px;}
      table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:18px;}
      th{background:#1C1C1E;color:#fff;padding:7px 8px;text-align:left;font-size:10px;}
      td{padding:6px 8px;border-bottom:1px solid #eee;}
      .total-row td{font-weight:700;font-size:15px;color:#8B6914;border-top:2px solid #8B6914;}
      .print-btn{background:#1C1C1E;color:#fff;border:none;padding:9px 18px;border-radius:7px;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:20px;}
      @media print { .print-btn{display:none;} }
    </style></head><body>
      <button class="print-btn" onclick="window.print()">🖨 Print this page</button>
      <div class="hdr"><img src="${window.location.origin}/ceb-logo.jpg" alt="CEB"><div><div class="co">Custom Elegant Blinds</div><div class="tag">Zebra Blinds · Honey Comb · Dream Curtain</div></div></div>
      <div class="meta">
        <div><strong>Invoice:</strong> ${inv.invoice_number}<br/><strong>Date:</strong> ${new Date(inv.created_at).toLocaleDateString()}<br/><span class="status ${inv.status==='paid'?'paid':'due'}">${inv.status==='paid'?'PAID':inv.status.toUpperCase()}</span></div>
        <div style="text-align:right"><strong>Bill To:</strong><br/>${project?.customers?.name||''}<br/>${project?.customers?.email||''}<br/>${project?.address||''}</div>
      </div>
      <h4>Items in this project (${dataRows.length})</h4>
      <table><thead><tr><th>Location</th><th>Blind Type</th><th>Control</th><th style="text-align:center">Qty</th></tr></thead><tbody>${itemsRows}</tbody></table>
      <h4>Invoice Summary</h4>
      <table><thead><tr><th>Description</th><th style="text-align:right">% of Total</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>
        <tr><td>${inv.invoice_type} — ${project?.name} (Project Total ${fmt(project?.grand_total||0)})</td><td style="text-align:right">${inv.pct_of_total}%</td><td style="text-align:right">${fmt(inv.total_amount||0)}</td></tr>
        ${(inv.square_surcharge||0)>0?`<tr><td>💳 Square processing surcharge</td><td></td><td style="text-align:right">${fmt(inv.square_surcharge||0)}</td></tr>`:''}
        <tr class="total-row"><td colspan="2">Amount Due</td><td style="text-align:right">${fmt(inv.total_amount||0)}</td></tr>
      </tbody></table>
      <p style="font-size:10px;color:#999">Custom Elegant Blinds · Monroe, WA</p>
    </body></html>`
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    setTimeout(()=>URL.revokeObjectURL(url), 30000)
  }
  const previewInvoiceAmount = (pct:number, method:string) => {
    const base = (project?.grand_total||0) * (pct/100)
    const surcharge = method==='square' ? Math.round((((base+0.30)/(1-0.029))-base)*100)/100 : 0
    return { base, surcharge, total: base+surcharge }
  }

  // ── NEW: GRIEVANCES ──────────────────────────────────────
  const openGrievCount = grievances.filter(g=>g.status!=='resolved').length
  const addGrievance = async () => {
    if (!newGrievTitle.trim()) return showToast('Title required','err')
    setGrievBusy(true)
    try {
      const fd = new FormData()
      fd.set('projectId', String(id)); fd.set('title', newGrievTitle); fd.set('description', newGrievDesc)
      if (newGrievFile) fd.set('file', newGrievFile)
      const res = await fetch('/api/grievances', { method:'POST', body: fd })
      const text = await res.text()
      let data: any = {}
      try { data = text ? JSON.parse(text) : {} } catch { showToast('Server returned an unexpected response (not JSON). Status '+res.status,'err'); return }
      if (!res.ok) { showToast(data.error||'Could not log grievance','err'); return }
      setGrievances(prev=>[data, ...prev])
      setShowAddGrievance(false); setNewGrievTitle(''); setNewGrievDesc(''); setNewGrievFile(null)
    } catch (err:any) {
      showToast('Network/JS error logging grievance: '+err.message,'err')
    } finally { setGrievBusy(false) }
  }
  const createCustomer = async () => {
    if (!newCustName.trim()) return showToast('Name required','err')
    if (!newCustEmail.trim()) return showToast('Email required','err')
    setNewCustBusy(true)
    try {
      const res = await fetch('/api/customers/create', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ name:newCustName, email:newCustEmail, phone:newCustPhone }) })
      const text = await res.text()
      let data: any = {}
      try { data = text ? JSON.parse(text) : {} } catch { showToast('Server returned an unexpected response. Status '+res.status,'err'); return }
      if (!res.ok) { showToast(data.error||'Could not create customer','err'); return }
      setCustomers(prev=>[...prev, { ...data, projects: [] }])
      setShowNewCustomer(false); setNewCustName(''); setNewCustEmail(''); setNewCustPhone('')
      showToast('Customer created','ok')
    } catch (err:any) {
      showToast('Network/JS error creating customer: '+err.message,'err')
    } finally { setNewCustBusy(false) }
  }

  const openResolveForm = (grievId:string) => { setResolvingGriev(grievId); setResolveNote('') }
  const openAddUpdateForm = (grievId:string) => { setAddingUpdateFor(grievId); setNewUpdateNote('') }
  const addGrievanceUpdate = async (grievId:string) => {
    if (!newUpdateNote.trim()) return showToast('Note required','err')
    setUpdateBusy(true)
    try {
      const res = await fetch(`/api/grievances/${grievId}/updates`, { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ note:newUpdateNote }) })
      const text = await res.text()
      let data: any = {}
      try { data = text ? JSON.parse(text) : {} } catch { showToast('Server returned an unexpected response. Status '+res.status,'err'); return }
      if (!res.ok) { showToast(data.error||'Could not add update','err'); return }
      setGrievances(prev=>prev.map(g=>g.id===grievId?data:g))
      setAddingUpdateFor(null); setNewUpdateNote('')
      showToast('Update logged','ok')
    } catch (err:any) {
      showToast('Network/JS error adding update: '+err.message,'err')
    } finally { setUpdateBusy(false) }
  }
  const resolveGrievance = async (grievId:string) => {
    setGrievBusy(true)
    try {
      const res = await fetch(`/api/grievances/${grievId}`, { method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ resolutionNote: resolveNote || 'Resolved' }) })
      const text = await res.text()
      let data: any = {}
      try { data = text ? JSON.parse(text) : {} } catch { showToast('Server returned an unexpected response (not JSON). Status '+res.status,'err'); return }
      if (!res.ok) { showToast(data.error||'Could not resolve','err'); return }
      setGrievances(prev=>prev.map(g=>g.id===grievId?data:g))
      setResolvingGriev(null)
      showToast('Grievance resolved','ok')
    } catch (err:any) {
      showToast('Network/JS error resolving grievance: '+err.message,'err')
    } finally { setGrievBusy(false) }
  }

  // ── NEW: EMAIL ────────────────────────────────────────────
  const EMAIL_TEMPLATES = [
    { label:'Quote Ready', subject:()=>`Your quote for ${project?.name} is ready`, body:()=>`Hi ${project?.customers?.name||''},\n\nYour quote for ${project?.name} is ready to view.\n\nThank you,\nCustom Elegant Blinds` },
    { label:'Invoice Due Reminder', subject:()=>`Reminder: invoice due for ${project?.name}`, body:()=>`Hi ${project?.customers?.name||''},\n\nThis is a reminder that you have an invoice due for ${project?.name}.\n\nThank you,\nCustom Elegant Blinds` },
    { label:'Payment Received', subject:()=>`Payment received — ${project?.name}`, body:()=>`Hi ${project?.customers?.name||''},\n\nWe've received your payment for ${project?.name}. Thank you!\n\nCustom Elegant Blinds` },
    { label:'Grievance Update', subject:()=>`Update on your ${project?.name} project`, body:()=>`Hi ${project?.customers?.name||''},\n\nWe wanted to give you an update regarding your recent concern on ${project?.name}.\n\nCustom Elegant Blinds` },
    { label:'Project Complete', subject:()=>`${project?.name} is complete!`, body:()=>`Hi ${project?.customers?.name||''},\n\nYour project ${project?.name} is now complete. Thank you for choosing Custom Elegant Blinds!` },
  ]
  const pickEmailTemplate = (idx:number) => {
    setEmailTemplateIdx(idx)
    setEmailSubject(EMAIL_TEMPLATES[idx].subject())
    setEmailBody(EMAIL_TEMPLATES[idx].body())
  }
  const openSendEmail = () => { pickEmailTemplate(0); setShowSendEmail(true) }
  const sendCustomEmail = async () => {
    setEmailBusy(true)
    try {
      const res = await fetch('/api/emails', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ projectId:id, toEmail:project?.customers?.email||project?.email, subject:emailSubject, body:emailBody }) })
      const text = await res.text()
      let data: any = {}
      try { data = text ? JSON.parse(text) : {} } catch { showToast('Server returned an unexpected response (not JSON). Status '+res.status,'err'); return }
      if (!res.ok) { showToast(data.error||'Could not send','err'); return }
      setEmails(prev=>[data, ...prev])
      setShowSendEmail(false)
    } catch (err:any) {
      showToast('Network/JS error sending email: '+err.message,'err')
    } finally { setEmailBusy(false) }
  }

  // ── EXCEL IMPORT ──────────────────────────────────────────
  const importExcel = async (file: File) => {
    setImportStatus({ msg:`Reading "${file.name}"…`, type:'info' })
    try {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(new Uint8Array(buf), { type:'array' })
      if (!wb.SheetNames.length) { setImportStatus({msg:'No sheets found', type:'error'}); return }
      const sheetName = wb.SheetNames.includes('Sheet1') ? 'Sheet1' : wb.SheetNames[0]
      const ws = wb.Sheets[sheetName]
      const json: any[] = XLSX.utils.sheet_to_json(ws, { defval:'', raw:false })
      if (!json.length) { setImportStatus({msg:`Sheet "${sheetName}" is empty`, type:'error'}); return }

      const match = (row:any, candidates:string[]) => {
        for (const key of Object.keys(row)) {
          const k = key.toLowerCase().replace(/[\s_\-\(\)\/]/g,'')
          for (const c of candidates) {
            const cv = c.toLowerCase().replace(/[\s_\-\(\)\/]/g,'')
            if (k===cv || k.includes(cv) || cv.includes(k)) return String(row[key]).trim()
          }
        }
        return ''
      }

      const newRows: Row[] = []
      let added = 0, skipped = 0
      json.forEach(row => {
        const vals = Object.values(row).map(v=>String(v||'').trim()).filter(Boolean)
        if (!vals.length) return
        const w = parseFloat(match(row,['width','w','wd']))
        const h = parseFloat(match(row,['height','h','ht']))
        const loc = match(row,['location','description','window','item','name','blind','room'])
        if (!w && !h && vals.length<=3 && loc) {
          const upper = loc.toUpperCase()
          if (['FLOOR','LEVEL','ROOM','SECTION','GROUND','FIRST','SECOND','UPPER','LOWER'].some(k=>upper.includes(k))) {
            newRows.push({ id:newLocalId(), is_section:true, section_name:upper, blind_type:'', control:'', location:'', fabric:'', valance:'', bottom_rail:'', mount:'', width_in:'', height_in:'', qty:1, remark:'' })
            return
          }
        }
        if (!loc && !w && !h) { skipped++; return }
        const type = match(row,['blind type','blindtype','type','product']) || products[0]?.name || 'HoneyComb'
        const ctrl = match(row,['control','motor','ctrl','control system']) || motors[0]?.name || 'Cordless'
        const fabric = match(row,['fabric','color','colour','material','fabric color']) || FABRICS_DEFAULT[0]
        const mount = match(row,['mount','mounting','mount type']) || 'Inside'
        const valance = match(row,['valance','pelmet']) || '—'
        const bottomRail = match(row,['bottom rail','bottomrail','rail']) || '—'
        const qty = parseInt(match(row,['qty','quantity','count'])) || 1
        const remark = match(row,['remark','remarks','note','notes','comment'])
        newRows.push({ id:newLocalId(), is_section:false, blind_type:type, control:ctrl, location:loc||`Window ${added+1}`, fabric, valance, bottom_rail:bottomRail, mount, width_in:w||'', height_in:h||'', qty, remark })
        added++
      })
      setRows(prev=>[...prev, ...newRows])
      setImportStatus({ msg:`✅ Imported ${added} rows from "${file.name}" (sheet: "${sheetName}")${skipped?` — ${skipped} blank rows skipped`:''}`, type:'ok' })
      markDirty()
    } catch (err:any) {
      setImportStatus({ msg:'❌ Error: '+err.message, type:'error' })
    }
  }

  if (loadError) return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',fontFamily:'Inter,sans-serif',background:'#F7F4EF',gap:14}}>
      <div style={{fontSize:40}}>⚠️</div>
      <div style={{fontSize:16,fontWeight:600,color:'#1C1C1E'}}>This project couldn't be loaded</div>
      <div style={{fontSize:12,color:'#9AA5B4'}}>It may still be saving, or the link is incorrect.</div>
      <div style={{display:'flex',gap:10}}>
        <button onClick={loadAll} style={{background:'#C9A84C',color:'#1C1C1E',border:'none',padding:'9px 18px',borderRadius:7,fontWeight:700,fontSize:13,cursor:'pointer'}}>Try Again</button>
        <button onClick={()=>router.push('/admin')} style={{background:'#1C1C1E',color:'#fff',border:'none',padding:'9px 18px',borderRadius:7,fontWeight:700,fontSize:13,cursor:'pointer'}}>← Back to Admin</button>
      </div>
    </div>
  )
  if (!project) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontFamily:'Inter,sans-serif',color:'#9AA5B4'}}>Loading project…</div>

  const inp: React.CSSProperties = { width:'100%',border:'none',background:'transparent',fontFamily:'Inter,sans-serif',fontSize:12,padding:'6px',outline:'none',height:34 }
  const cv: React.CSSProperties = { padding:'6px',fontSize:12,height:34,display:'flex',alignItems:'center',fontVariantNumeric:'tabular-nums' }
  const th: React.CSSProperties = { background:'#EDEBE6',color:'#4A5568',fontSize:10,fontWeight:700,padding:'7px 6px',textAlign:'left',borderRight:'1px solid #E2DDD6',borderBottom:'2px solid #E2DDD6',position:'sticky',top:0,zIndex:10,whiteSpace:'nowrap' }
  const thCust: React.CSSProperties = { ...th, background:'#EAF6EE' }
  const td: React.CSSProperties = { padding:0,borderRight:'1px solid #E2DDD6',verticalAlign:'middle',fontSize:12 }

  // Handle Enter key on the last editable field of a row -- adds a new row
  // right after THIS row, regardless of which row you're on (previously only
  // worked when you were on the very last row in the sheet).
  const handleKeyDown = (e: React.KeyboardEvent, isLastCol: boolean, rowId?: string) => {
    if (e.key === 'Enter' && isLastCol) {
      e.preventDefault()
      if (rowId) addRowAfter(rowId); else addRow()
    }
  }

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',fontFamily:'Inter,sans-serif',background:'#F7F4EF',color:'#1C1C1E'}}>
      {/* HEADER */}
      <header style={{height:56,background:'#1C1C1E',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 18px',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <a href="/admin" title="Home"><img src="/ceb-logo.jpg" alt="CEB" style={{width:36,height:36,objectFit:'contain',flexShrink:0,cursor:'pointer'}}/></a>
          <button style={{border:'none',padding:'5px 12px',borderRadius:6,fontSize:12,fontFamily:'Inter,sans-serif',fontWeight:600,cursor:'pointer',background:'rgba(255,255,255,.1)',color:'#fff'}} onClick={()=>router.push('/admin/home')}>← Project Home</button>
          <span style={{color:'#fff',fontFamily:'Playfair Display,serif',fontSize:15}}>{project.name}</span>
          <span style={{color:'#9AA5B4',fontSize:11}}>{project.customers?.name} · {project.address||project.email}</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          {project.confirmed_at ? (
            <span style={{fontSize:11,color:'#6EE7A0'}}>✓ Accepted {new Date(project.confirmed_at).toLocaleDateString()}</span>
          ) : !['confirmed','invoiced','completed','cancelled'].includes(project.status) && (
            <button disabled={accepting} onClick={acceptOnBehalf} title="Use if the customer confirmed verbally or by text instead of clicking Accept themselves"
              style={{border:'none',padding:'5px 12px',borderRadius:6,fontSize:11,fontWeight:700,cursor:'pointer',background:'#27AE60',color:'#fff'}}>
              {accepting?'…':'✓ Accept on Customer\'s Behalf'}
            </button>
          )}
          <select value={project.status} onChange={async e=>{
            await fetch(`/api/projects/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:e.target.value})})
            setProject((p:any)=>({...p,status:e.target.value}))
          }} style={{fontSize:12,padding:'4px 8px',borderRadius:6,border:'1px solid #555',background:'#333',color:'#fff',cursor:'pointer'}}>
            {['draft','sent','viewed','confirmed','invoiced','completed','cancelled'].map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </header>

      {/* BODY */}
      <div style={{display:'flex',flex:1,overflow:'hidden'}}>
        {/* SIDEBAR */}
        <aside style={{width:256,background:'#1C1C1E',display:'flex',flexDirection:'column',flexShrink:0,overflowY:'auto'}}>
          <div style={{padding:'14px 12px 6px'}}>
            <div style={{fontSize:11,fontWeight:700,letterSpacing:'1.2px',textTransform:'uppercase',color:'#9AA5B4',marginBottom:9}}>Customers</div>
            {customers.map(c=>{
              const isExp = !!expandedCust[c.id]
              return (
                <div key={c.id} style={{marginBottom:2}}>
                  <div onClick={()=>setExpandedCust(prev=>({...prev,[c.id]:!prev[c.id]}))}
                    className="sidebar-cust-row"
                    style={{display:'flex',alignItems:'center',gap:7,padding:'8px 10px',borderRadius:6,cursor:'pointer',color:'rgba(255,255,255,.65)',fontSize:14}}>
                    <span style={{fontSize:11,color:'#9AA5B4',transform:isExp?'rotate(90deg)':'none',display:'inline-block',transition:'.15s',flexShrink:0}}>▶</span>
                    <span style={{fontSize:14}}>👤</span>
                    <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontWeight:500}}>{c.name}</span>
                    <span style={{fontSize:10,background:'rgba(255,255,255,.1)',color:'#9AA5B4',padding:'2px 6px',borderRadius:8,flexShrink:0}}>{c.projects?.length||0}</span>
                    <button onClick={e=>{e.stopPropagation();openAddProjectForm(c.id)}} title="Add project"
                      style={{background:'none',border:'none',color:'#C9A84C',cursor:'pointer',fontSize:15,padding:'0 3px',flexShrink:0}}>＋</button>
                    <button onClick={e=>{e.stopPropagation();confirmOrAsk('cust:'+c.id,()=>deleteCustomerFromSidebar(c.id,e))}} title="Delete customer"
                      style={{background:pendingDelete==='cust:'+c.id?'#E53E3E':'none',border:'none',color:pendingDelete==='cust:'+c.id?'#fff':'#E53E3E',cursor:'pointer',fontSize:pendingDelete==='cust:'+c.id?10:13,fontWeight:pendingDelete==='cust:'+c.id?700:400,padding:pendingDelete==='cust:'+c.id?'2px 6px':'0 3px',borderRadius:4,opacity:1,flexShrink:0,whiteSpace:'nowrap'}}>{pendingDelete==='cust:'+c.id?'Confirm?':'✕'}</button>
                  </div>
                  {isExp && (
                    <div style={{paddingLeft:18}}>
                      {c.projects?.map((p:any)=>(
                        <div key={p.id} onClick={()=>router.push(`/admin/project/${p.id}`)}
                          className="sidebar-proj-row"
                          style={{display:'flex',alignItems:'center',gap:6,padding:'7px 10px',borderRadius:5,cursor:'pointer',
                            color: p.id===id ? '#C9A84C' : 'rgba(255,255,255,.55)',
                            background: p.id===id ? 'rgba(201,168,76,.15)' : 'transparent',
                            fontSize:13,marginBottom:2}}>
                          <span style={{fontSize:13}}>📋</span>
                          <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}</span>
                          <span style={{fontSize:9,fontWeight:700,padding:'2px 6px',borderRadius:7,background:'rgba(255,255,255,.08)',color:SIDEBAR_STATUS_COLOR[p.status]||'#E8C96B',flexShrink:0}}>{p.status}</span>
                          <button onClick={e=>{e.stopPropagation();confirmOrAsk('proj:'+p.id,()=>deleteProjectFromSidebar(p.id,c.id,e))}} title="Delete project"
                            style={{background:pendingDelete==='proj:'+p.id?'#E53E3E':'none',border:'none',color:pendingDelete==='proj:'+p.id?'#fff':'#E53E3E',cursor:'pointer',fontSize:pendingDelete==='proj:'+p.id?9:12,fontWeight:pendingDelete==='proj:'+p.id?700:400,padding:pendingDelete==='proj:'+p.id?'1px 5px':'0 2px',borderRadius:4,opacity:1,flexShrink:0,whiteSpace:'nowrap'}}>{pendingDelete==='proj:'+p.id?'Confirm?':'✕'}</button>
                        </div>
                      ))}
                      {!c.projects?.length && <div style={{padding:'5px 10px',fontSize:11,color:'#9AA5B4'}}>No projects</div>}
                      {addingProjectFor===c.id ? (
                        <div style={{background:'rgba(201,168,76,.08)',border:'1px dashed rgba(201,168,76,.4)',borderRadius:6,padding:8,margin:'4px 0'}}>
                          <input value={newProjName} onChange={e=>setNewProjName(e.target.value)} placeholder="Project name" autoFocus
                            style={{width:'100%',padding:'5px 7px',border:'1px solid rgba(255,255,255,.2)',borderRadius:4,fontSize:12,marginBottom:5,background:'rgba(255,255,255,.05)',color:'#fff'}}/>
                          <input value={newProjEmail} onChange={e=>setNewProjEmail(e.target.value)} placeholder="Project email"
                            style={{width:'100%',padding:'5px 7px',border:'1px solid rgba(255,255,255,.2)',borderRadius:4,fontSize:12,marginBottom:5,background:'rgba(255,255,255,.05)',color:'#fff'}}/>
                          <input value={newProjAddress} onChange={e=>setNewProjAddress(e.target.value)} placeholder="Mailing address"
                            style={{width:'100%',padding:'5px 7px',border:'1px solid rgba(255,255,255,.2)',borderRadius:4,fontSize:12,marginBottom:6,background:'rgba(255,255,255,.05)',color:'#fff'}}/>
                          <div style={{display:'flex',gap:6}}>
                            <button onClick={()=>createProjectFor(c.id)} style={{background:'#C9A84C',color:'#1C1C1E',border:'none',padding:'5px 10px',borderRadius:4,fontSize:11,fontWeight:700,cursor:'pointer'}}>Create</button>
                            <button onClick={()=>setAddingProjectFor(null)} style={{background:'none',border:'1px solid rgba(255,255,255,.2)',color:'rgba(255,255,255,.6)',padding:'5px 10px',borderRadius:4,fontSize:11,cursor:'pointer'}}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={()=>openAddProjectForm(c.id)} style={{display:'flex',alignItems:'center',gap:5,padding:'6px 10px',background:'none',border:'none',color:'rgba(201,168,76,.6)',fontSize:12,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>＋ Add project</button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            {!customers.length && <div style={{fontSize:12,color:'#9AA5B4',padding:'4px 0'}}>No customers yet</div>}
          </div>
          <button onClick={()=>setShowNewCustomer(true)}
            style={{margin:'4px 12px 10px',background:'rgba(201,168,76,.1)',border:'1px dashed rgba(201,168,76,.3)',color:'#C9A84C',padding:8,borderRadius:7,fontSize:12,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
            ＋ New Customer
          </button>
          <hr style={{border:'none',borderTop:'1px solid rgba(255,255,255,.06)',margin:'5px 12px'}}/>
          <div style={{margin:'0 12px 10px',padding:'8px 10px',borderRadius:6,fontSize:10,lineHeight:1.6, background: isPushed?'rgba(39,174,96,.12)':'rgba(245,158,11,.12)', color: isPushed?'#6EE7A0':'#FCD34D', border: `1px solid ${isPushed?'rgba(39,174,96,.2)':'rgba(245,158,11,.2)'}`}}>
            {isPushed ? '✓ Pushed — customer view up to date' : '⚠ Unpushed changes'}
          </div>
          <hr style={{border:'none',borderTop:'1px solid rgba(255,255,255,.06)',margin:'5px 12px'}}/>
          <div style={{padding:'11px 13px',borderTop:'1px solid rgba(255,255,255,.08)',background:'rgba(201,168,76,.07)'}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',color:'#C9A84C',marginBottom:8}}>Current Project</div>
            <div style={{display:'flex',gap:6,fontSize:12,color:'rgba(255,255,255,.72)',marginBottom:5}}><span style={{width:14,flexShrink:0}}>📧</span><span>{project.email||'—'}</span></div>
            <div style={{display:'flex',gap:6,fontSize:12,color:'rgba(255,255,255,.72)',marginBottom:5}}><span style={{width:14,flexShrink:0}}>📞</span><span>{project.phone||'—'}</span></div>
            <div style={{display:'flex',gap:6,fontSize:12,color:'rgba(255,255,255,.72)'}}><span style={{width:14,flexShrink:0}}>📍</span><span style={{lineHeight:1.4}}>{project.address||'—'}</span></div>
          </div>
          <hr style={{border:'none',borderTop:'1px solid rgba(255,255,255,.06)',margin:'5px 12px'}}/>
          <div style={{padding:'10px 12px'}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:'1.2px',textTransform:'uppercase',color:'#9AA5B4',marginBottom:7}}>Project Totals</div>
            {[['Items',dataRows.length.toString()],['Blinds',fmt(totB*(1-config.discount_pct/100))],['Motors',fmt(totM*(1-config.discount_pct/100))],
              ...(config.discount_pct>0?[['Discount','-'+fmt((totB+totM)*config.discount_pct/100)]]:[]),
              [`Tax (${config.tax_pct}%)`,fmt(tax)],['Shipping',fmt(ship)],['Installation',fmt(config.installation)],
              ...fees.map(f=>[f.label,fmt(f.fee_type==='pct'?sub*(f.value/100):f.value)])
            ].map(([l,v])=>(
              <div key={l} style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                <span style={{color:'#9AA5B4',fontSize:11}}>{l}</span>
                <span style={{color: String(l).includes('Discount')?'#6EE7A0':'#C9A84C',fontSize:11,fontWeight:700,fontVariantNumeric:'tabular-nums'}}>{v}</span>
              </div>
            ))}
            <div style={{borderTop:'1px solid rgba(255,255,255,.08)',paddingTop:6,marginTop:3,display:'flex',justifyContent:'space-between'}}>
              <span style={{color:'rgba(255,255,255,.85)',fontWeight:600,fontSize:12}}>Grand Total</span>
              <span style={{color:'#C9A84C',fontSize:13,fontWeight:700}}>{fmt(grand)}</span>
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
          {/* TABS */}
          <div style={{display:'flex',background:'#fff',borderBottom:'2px solid #E2DDD6',padding:'0 14px',flexShrink:0,overflowX:'auto'}}>
            {(['sheet','purchase','summary','invoices','grievances','email'] as const).map(t=>{
              const activeColor = t==='purchase'?'#7C3AED':t==='grievances'?'#E53E3E':t==='invoices'?'#8B6914':t==='email'?'#0D9488':'#C9A84C'
              const label = t==='sheet'?'📋 Project Sheet':t==='purchase'?'🔧 My Purchase':t==='summary'?'📊 Quote Summary':t==='invoices'?'📄 Invoices':t==='grievances'?'⚠️ Grievances':'✉️ Email'
              return (
                <div key={t} onClick={()=>setTab(t)} style={{padding:'10px 16px',fontSize:12,fontWeight:tab===t?600:500,color:tab===t?(t==='purchase'?'#7C3AED':'#1C1C1E'):'#9AA5B4',cursor:'pointer',borderBottom:`2px solid ${tab===t?activeColor:'transparent'}`,marginBottom:-2,whiteSpace:'nowrap'}}>
                  {label}
                  {t==='purchase' && !isPushed && <span style={{width:6,height:6,background:'#F59E0B',borderRadius:'50%',display:'inline-block',marginLeft:4}}/>}
                  {t==='invoices' && invoices.length>0 && <span style={{fontSize:9,fontWeight:700,background:'#F7F4EF',border:'1px solid #E2DDD6',padding:'1px 6px',borderRadius:8,marginLeft:5}}>{invoices.length}</span>}
                  {t==='grievances' && openGrievCount>0 && <span style={{fontSize:9,fontWeight:700,background:'#FEE2E2',color:'#E53E3E',padding:'1px 6px',borderRadius:8,marginLeft:5}}>{openGrievCount}</span>}
                </div>
              )
            })}
          </div>

          {/* SHEET TAB */}
          {tab==='sheet' && <>
            <div style={{height:42,background:'#fff',borderBottom:'1px solid #E2DDD6',display:'flex',alignItems:'center',padding:'0 10px',gap:4,flexShrink:0,overflowX:'auto'}}>
              <button onClick={addRow} style={{display:'flex',alignItems:'center',gap:3,padding:'5px 9px',border:'none',background:'#C9A84C',color:'#1C1C1E',borderRadius:5,fontSize:11,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>＋ Add Window</button>
              {addingSection ? (
                <span style={{display:'flex',alignItems:'center',gap:4}}>
                  <input value={newSectionName} onChange={e=>setNewSectionName(e.target.value)} placeholder="GROUND FLOOR" autoFocus
                    onKeyDown={e=>{if(e.key==='Enter')confirmAddSection(); if(e.key==='Escape'){setAddingSection(false);setNewSectionName('')}}}
                    style={{padding:'5px 8px',border:'1px solid #C9A84C',borderRadius:5,fontSize:11,width:130}}/>
                  <button onClick={confirmAddSection} style={{background:'#27AE60',color:'#fff',border:'none',padding:'5px 9px',borderRadius:5,fontSize:11,fontWeight:700,cursor:'pointer'}}>✓</button>
                  <button onClick={()=>{setAddingSection(false);setNewSectionName('')}} style={{background:'none',border:'1px solid #E2DDD6',padding:'5px 9px',borderRadius:5,fontSize:11,cursor:'pointer'}}>✕</button>
                </span>
              ) : (
                <button onClick={()=>setAddingSection(true)} style={{display:'flex',alignItems:'center',gap:4,padding:'5px 10px',border:'1px solid #C9A84C',background:'#FFFBF0',color:'#8B6914',borderRadius:5,fontSize:11,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>📑 Add Heading / Section</button>
              )}
              <span style={{width:1,height:20,background:'#E2DDD6',margin:'0 4px'}}/>
              <button onClick={delRow} style={{display:'flex',alignItems:'center',gap:3,padding:'5px 9px',border:'none',background:'transparent',color:'#E53E3E',borderRadius:5,fontSize:11,cursor:'pointer',whiteSpace:'nowrap'}}>🗑 Delete</button>
              <button onClick={dupRow} style={{display:'flex',alignItems:'center',gap:3,padding:'5px 9px',border:'none',background:'transparent',color:'#4A5568',borderRadius:5,fontSize:11,cursor:'pointer',whiteSpace:'nowrap'}}>⎘ Duplicate</button>
              <span style={{width:1,height:20,background:'#E2DDD6',margin:'0 4px'}}/>
              <span style={{position:'relative'}}>
                <button onClick={()=>setShowColsMenu(v=>!v)} style={{display:'flex',alignItems:'center',gap:3,padding:'5px 9px',border:'1px solid #E2DDD6',background:'#fff',color:'#4A5568',borderRadius:5,fontSize:11,cursor:'pointer',whiteSpace:'nowrap'}}>🔧 Columns</button>
                {showColsMenu && (
                  <div style={{position:'absolute',top:32,left:0,background:'#fff',border:'1px solid #E2DDD6',borderRadius:7,boxShadow:'0 8px 24px rgba(0,0,0,.15)',padding:8,zIndex:50,minWidth:150}}>
                    {OPTIONAL_COLS.map(c=>(
                      <label key={c.key} style={{display:'flex',alignItems:'center',gap:7,padding:'5px 6px',fontSize:12,cursor:'pointer',borderRadius:4}}>
                        <input type="checkbox" checked={colVisible(c.key)} onChange={()=>toggleColumn(c.key)}/>{c.label}
                      </label>
                    ))}
                  </div>
                )}
              </span>
              <span style={{width:1,height:20,background:'#E2DDD6',margin:'0 4px'}}/>
              <button onClick={doPush} disabled={pushing} style={{display:'flex',alignItems:'center',gap:3,padding:'5px 9px',border:'none',background:'#27AE60',color:'#fff',borderRadius:5,fontSize:11,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>{pushing?'Pushing…':'⬆ Push to Customer'}</button>
              <span style={{marginLeft:'auto',fontSize:11,color:'#8B6914',background:'#F7F4EF',border:'1px solid #E2DDD6',borderRadius:4,padding:'3px 10px',whiteSpace:'nowrap'}}>Total: <strong>{fmt(grand)}</strong></span>
            </div>
            <div className="sheet-scroll" style={{flex:1,overflow:'auto'}}>
              <table style={{borderCollapse:'collapse',minWidth:'100%',fontSize:12}}>
                <thead>
                  <tr>
                    <th style={{...th,width:48,background:'#E5E2DB',textAlign:'center'}}>#</th>
                    <th style={thCust}>Blind Type ✏</th>
                    <th style={thCust}>Control ✏</th>
                    <th style={th}>Location</th>
                    {colVisible('fabric') && <th style={thCust}>Fabric ✏</th>}
                    {colVisible('valance') && <th style={thCust}>Valance ✏</th>}
                    {colVisible('bottom_rail') && <th style={thCust}>Bottom Rail ✏</th>}
                    {colVisible('mount') && <th style={thCust}>Mount ✏</th>}
                    <th style={th}>W (in)</th>
                    <th style={th}>H (in)</th>
                    <th style={th}>Qty</th>
                    <th style={th}>Sq.M</th>
                    {colVisible('remark') && <th style={thCust}>Remarks ✏</th>}
                    <th style={th}>Blinds $</th>
                    <th style={th}>Motors $</th>
                    <th style={th}>Line Total</th>
                    <th style={{...th,width:34,textAlign:'center'}}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r,idx) => {
                    if (r.is_section) return (
                      <tr key={r.id}
                        onDragOver={e=>{e.preventDefault(); if(dragRowId && dragOverRowId!==r.id) setDragOverRowId(r.id)}}
                        onDragLeave={()=>setDragOverRowId(prev=>prev===r.id?null:prev)}
                        onDrop={()=>{ if (dragRowId) reorderRow(dragRowId, r.id); setDragRowId(null); setDragOverRowId(null) }}
                        style={dragOverRowId===r.id?{boxShadow:'inset 0 2px 0 #C9A84C, inset 0 -2px 0 #C9A84C'}:undefined}>
                        <td colSpan={16-hiddenCols.size} style={{background:'#2A2826',color:'rgba(255,255,255,.75)',fontSize:10,fontWeight:700,letterSpacing:'1.2px',padding:'5px 12px'}}>▸ {r.section_name}</td>
                        <td style={{background:'#2A2826',textAlign:'center',padding:'5px 4px'}}>
                          <button tabIndex={-1} onClick={()=>deleteSection(r.id)} title="Delete this section heading"
                            style={{background:'none',border:'none',color:'rgba(255,255,255,.4)',cursor:'pointer',fontSize:12}}>✕</button>
                        </td>
                      </tr>
                    )
                    const vi = rows.slice(0,idx).filter(x=>!x.is_section).length + 1
                    const sel = r.id===selId
                    const bq=blindsQ(r), mq=motorQ(r), lt=lineTotal(r), sq=sqm(r.width_in,r.height_in)
                    const sel_ = (field:string, val:any, opts:string[], isLast=false) => (
                      <select value={val} onChange={e=>upd(r.id,field,e.target.value)} onKeyDown={e=>handleKeyDown(e,isLast,r.id)} style={{...inp,cursor:'pointer'}}>
                        {opts.map(o=><option key={o} value={o}>{o}</option>)}
                      </select>
                    )
                    const txt_ = (field:string, val:any, isLast=false) => (
                      <input type="text" value={val} onChange={e=>upd(r.id,field,e.target.value)} onKeyDown={e=>handleKeyDown(e,isLast,r.id)} style={inp}/>
                    )
                    const num_ = (field:string, val:any) => (
                      <input type="number" value={val} onChange={e=>upd(r.id,field,e.target.value)} step="0.01" style={{...inp,textAlign:'center'}}/>
                    )
                    return (
                      <tr key={r.id}
                        onDragOver={e=>{e.preventDefault(); if(dragRowId && dragOverRowId!==r.id) setDragOverRowId(r.id)}}
                        onDragLeave={()=>setDragOverRowId(prev=>prev===r.id?null:prev)}
                        onDrop={()=>{ if (dragRowId) reorderRow(dragRowId, r.id); setDragRowId(null); setDragOverRowId(null) }}
                        onDragEnd={()=>{ setDragRowId(null); setDragOverRowId(null) }}
                        style={{borderBottom:'1px solid #E2DDD6',borderTop:dragOverRowId===r.id?'2px solid #C9A84C':undefined,background:sel?'#FEF9EC':idx%2===0?'#fff':'#FAF8F5',cursor:'pointer'}} onClick={()=>setSelId(r.id)}>
                        <td style={{...td,width:48,textAlign:'center',fontSize:10,color:sel?'#1C1C1E':'#9AA5B4',background:sel?'#C9A84C':'#F5F2EB',borderRight:'2px solid #E2DDD6'}}>
                          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:4}}>
                            <span
                              draggable
                              onDragStart={e=>{ setDragRowId(r.id); e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain', r.id) }}
                              title="Drag to reorder"
                              style={{cursor:'grab',color:sel?'#1C1C1E':'#9AA5B4',fontSize:13,lineHeight:1,letterSpacing:'-1px',padding:'2px 3px'}}
                              onClick={e=>e.stopPropagation()}
                            >☰</span>
                            <span>{vi}</span>
                          </div>
                        </td>
                        <td style={{...td,background:'rgba(39,174,96,.03)'}}>{sel_('blind_type',r.blind_type,products.map(p=>p.name))}</td>
                        <td style={{...td,background:'rgba(39,174,96,.03)'}}>{sel_('control',r.control,motors.map(m=>m.name))}</td>
                        <td style={td}>{txt_('location',r.location)}</td>
                        {colVisible('fabric') && <td style={{...td,background:'rgba(39,174,96,.03)'}}>{sel_('fabric',r.fabric,FABRICS_DEFAULT)}</td>}
                        {colVisible('valance') && <td style={{...td,background:'rgba(39,174,96,.03)'}}>{sel_('valance',r.valance,VALANCES)}</td>}
                        {colVisible('bottom_rail') && <td style={{...td,background:'rgba(39,174,96,.03)'}}>{sel_('bottom_rail',r.bottom_rail,BRAILS)}</td>}
                        {colVisible('mount') && <td style={{...td,background:'rgba(39,174,96,.03)'}}>{sel_('mount',r.mount,MOUNTS)}</td>}
                        <td style={td}>{num_('width_in',r.width_in)}</td>
                        <td style={td}>{num_('height_in',r.height_in)}</td>
                        <td style={td}><input type="number" value={r.qty} onChange={e=>upd(r.id,'qty',e.target.value as any)} onBlur={e=>upd(r.id,'qty',(parseInt(e.target.value)||1) as any)} style={{...inp,textAlign:'center'}}/></td>
                        <td style={td}><div style={cv}>{sq>0?sq.toFixed(2):'—'}</div></td>
                        {colVisible('remark') && <td style={{...td,background:'rgba(39,174,96,.03)'}}>{txt_('remark',r.remark,true)}</td>}
                        <td style={td}><div style={{...cv,fontWeight:500}}>{bq>0?fmt(bq):'—'}</div></td>
                        <td style={td}><div style={{...cv,fontWeight:500}}>{mq>0?fmt(mq):'—'}</div></td>
                        <td style={td}><div style={{...cv,color:'#8B6914',fontWeight:700}}>{lt>0?fmt(lt):'—'}</div></td>
                        <td style={{...td,textAlign:'center',borderRight:'none',whiteSpace:'nowrap'}}>
                          <button tabIndex={-1} onClick={ev=>{ev.stopPropagation(); delRowById(r.id)}} title="Delete this row"
                            style={{background:'none',border:'none',color:'#9AA5B4',cursor:'pointer',fontSize:13,padding:'4px 4px',borderRadius:4}}
                            onMouseEnter={ev=>{(ev.target as HTMLElement).style.background='#FEE2E2';(ev.target as HTMLElement).style.color='#E53E3E'}}
                            onMouseLeave={ev=>{(ev.target as HTMLElement).style.background='none';(ev.target as HTMLElement).style.color='#9AA5B4'}}>✕</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{borderTop:'2px solid #C9A84C',background:'#EDEBE6'}}>
                    <td style={{padding:'6px',fontWeight:700,fontSize:11,textAlign:'center'}}>Σ</td>
                    <td colSpan={10-(['fabric','valance','bottom_rail','mount'].filter(k=>hiddenCols.has(k)).length)} style={{padding:'6px 10px',fontWeight:700,fontSize:11,color:'#4A5568'}}>TOTALS</td>
                    <td style={{padding:'6px',fontWeight:700,color:'#8B6914',fontSize:13}} title="Sum of each row's Sq.M × Qty">{totSqm.toFixed(2)}</td>
                    {colVisible('remark') && <td></td>}
                    <td style={{padding:'6px',fontWeight:700,color:'#8B6914',fontSize:13}}>{fmt(totB*(1-config.discount_pct/100))}</td>
                    <td style={{padding:'6px',fontWeight:700,color:'#8B6914',fontSize:13}}>{fmt(totM*(1-config.discount_pct/100))}</td>
                    <td style={{padding:'6px',fontWeight:700,color:'#8B6914',fontSize:13}}>{fmt(sub)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div style={{height:26,background:'#1C1C1E',display:'flex',alignItems:'center',padding:'0 14px',gap:16}}>
              <span style={{fontSize:10,color:'#9AA5B4'}}>Rows: <span style={{color:'#C9A84C',fontWeight:600}}>{dataRows.length}</span></span>
              <span style={{fontSize:10,color:'#9AA5B4'}}>Press Enter in Remarks to add a new row</span>
              <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:8}}>
                <span style={{color:'rgba(255,255,255,.3)',fontSize:10}}>TOTAL</span>
                <span style={{color:'#C9A84C',fontSize:14,fontWeight:700}}>{fmt(grand)}</span>
              </div>
            </div>
          </>}

          {/* PURCHASE TAB */}
          {tab==='purchase' && (
            <div style={{flex:1,overflow:'auto',padding:18}}>
              <div style={{maxWidth:1100}}>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:14,gap:14}}>
                  <div>
                    <div style={{fontFamily:'Playfair Display,serif',fontSize:18}}>My Purchase Costs</div>
                    <div style={{fontSize:11,color:'#9AA5B4',marginTop:2}}>Cost × Factor = Quote Price. Push to publish to customer.</div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <div style={{background:'#D1FAE5',border:'1px solid #A7F3D0',borderRadius:8,padding:'7px 14px',textAlign:'right'}}>
                      <div style={{fontSize:9,fontWeight:700,letterSpacing:'.6px',textTransform:'uppercase',color:'#065F46'}}>In-Pocket (admin only)</div>
                      <div style={{fontSize:16,fontWeight:700,color:'#27AE60'}}>{fmt(inPocket)}</div>
                      <div style={{fontSize:9,color:'#065F46',opacity:.8,marginTop:1}}>Goods revenue − goods cost (excl. tax/shipping)</div>
                    </div>
                    <button onClick={doPush} disabled={pushing} style={{display:'flex',alignItems:'center',gap:6,background:'#27AE60',color:'#fff',border:'none',padding:'10px 18px',borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>⬆ Push to Customer Sheet</button>
                  </div>
                </div>
                <div style={{background:'#FEF3C7',border:'1px solid rgba(245,158,11,.3)',borderRadius:8,padding:'11px 15px',fontSize:12,color:'#92400E',marginBottom:16,lineHeight:1.7}}>
                  Enter your actual purchase cost and a multiplication factor. Quote = Cost × Factor. Motors have their own factors. Hit <strong>Push</strong> to publish to the project sheet and customer view.
                </div>

                {/* BLIND PRODUCTS */}
                <div style={{background:'#fff',borderRadius:10,border:'1px solid #E2DDD6',marginBottom:16,overflow:'hidden'}}>
                  <div style={{padding:'12px 16px',borderBottom:'1px solid #E2DDD6',fontWeight:700,fontSize:13}}>Blind Products <span style={{background:'#EDE9FF',color:'#7C3AED',fontSize:10,padding:'2px 8px',borderRadius:10,fontWeight:700,marginLeft:6}}>Linked to "Blind Type" column</span></div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:10,padding:'14px 16px'}}>
                    {products.map(p=>(
                      <div key={p.id} style={{border:'1px solid #E2DDD6',borderRadius:8,overflow:'hidden'}}>
                        <div style={{background:'#F7F4EF',padding:'8px 11px',fontSize:11,fontWeight:700,borderBottom:'1px solid #E2DDD6',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                          {p.name}
                          <button onClick={()=>confirmOrAsk('prod:'+p.id,()=>delProduct(p.id))} style={{background:pendingDelete==='prod:'+p.id?'#E53E3E':'none',border:'none',color:pendingDelete==='prod:'+p.id?'#fff':'#E53E3E',cursor:'pointer',fontSize:pendingDelete==='prod:'+p.id?10:12,fontWeight:pendingDelete==='prod:'+p.id?700:400,opacity:1,padding:pendingDelete==='prod:'+p.id?'2px 6px':0,borderRadius:4}}>{pendingDelete==='prod:'+p.id?'Confirm?':'✕'}</button>
                        </div>
                        <div style={{padding:'9px 11px'}}>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                            <label style={{fontSize:10,color:'#4A5568'}}>My Cost/m²</label>
                            <input type="number" value={p.my_cost_per_sqm} step={0.5} onChange={e=>updProduct(p.id,'my_cost_per_sqm',parseFloat(e.target.value)||0)} onBlur={e=>saveProductField(p.id,'my_cost_per_sqm',parseFloat(e.target.value)||0)} style={{width:68,padding:'3px 6px',border:'1px solid #E2DDD6',borderRadius:4,fontSize:11,textAlign:'right'}}/>
                          </div>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                            <label style={{fontSize:10,color:'#4A5568'}}>× Factor</label>
                            <input type="number" value={p.factor} step={0.1} onChange={e=>updProduct(p.id,'factor',parseFloat(e.target.value)||0)} onBlur={e=>saveProductField(p.id,'factor',parseFloat(e.target.value)||0)} style={{width:68,padding:'3px 6px',border:'1px solid #E2DDD6',borderRadius:4,fontSize:11,textAlign:'right'}}/>
                          </div>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                            <label style={{fontSize:10,color:'#4A5568'}}>→ Quote/m²</label>
                            <span style={{fontSize:11,color:'#7C3AED',fontWeight:600}}>${(p.my_cost_per_sqm*p.factor).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{margin:'0 16px 14px',padding:10,border:'1px dashed #0D9488',borderRadius:7,background:'#CCFBF115'}}>
                    <div style={{fontSize:11,fontWeight:700,marginBottom:8,color:'#0D9488'}}>＋ Add New Blind Product Type</div>
                    <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
                      <input placeholder="Product name" value={newProdName} onChange={e=>setNewProdName(e.target.value)} style={{flex:1,minWidth:140,padding:'6px 9px',border:'1px solid #E2DDD6',borderRadius:5,fontSize:12}}/>
                      <input type="number" placeholder="Cost/m²" value={newProdCost} onChange={e=>setNewProdCost(parseFloat(e.target.value)||0)} style={{width:90,padding:'6px 9px',border:'1px solid #E2DDD6',borderRadius:5,fontSize:12}}/>
                      <input type="number" placeholder="Factor" value={newProdFactor} onChange={e=>setNewProdFactor(parseFloat(e.target.value)||0)} style={{width:80,padding:'6px 9px',border:'1px solid #E2DDD6',borderRadius:5,fontSize:12}}/>
                      <button onClick={addProduct} style={{background:'#0D9488',color:'#fff',border:'none',padding:'7px 14px',borderRadius:6,fontSize:12,fontWeight:700,cursor:'pointer'}}>＋ Add</button>
                    </div>
                  </div>
                </div>

                {/* MOTORS */}
                <div style={{background:'#fff',borderRadius:10,border:'1px solid #E2DDD6',marginBottom:16,overflow:'hidden'}}>
                  <div style={{padding:'12px 16px',borderBottom:'1px solid #E2DDD6',fontWeight:700,fontSize:13}}>Motors & Controls <span style={{background:'#EDE9FF',color:'#7C3AED',fontSize:10,padding:'2px 8px',borderRadius:10,fontWeight:700,marginLeft:6}}>Linked to "Control" column</span></div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:10,padding:'14px 16px'}}>
                    {motors.map(m=>(
                      <div key={m.id} style={{border:'1px solid #E2DDD6',borderRadius:8,overflow:'hidden'}}>
                        <div style={{background:'#F5F0FF',padding:'8px 11px',fontSize:11,fontWeight:700,borderBottom:'1px solid #E2DDD6',color:'#7C3AED',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                          {m.name}
                          <button onClick={()=>confirmOrAsk('motor:'+m.id,()=>delMotor(m.id))} style={{background:pendingDelete==='motor:'+m.id?'#E53E3E':'none',border:'none',color:pendingDelete==='motor:'+m.id?'#fff':'#E53E3E',cursor:'pointer',fontSize:pendingDelete==='motor:'+m.id?10:12,fontWeight:pendingDelete==='motor:'+m.id?700:400,opacity:1,padding:pendingDelete==='motor:'+m.id?'2px 6px':0,borderRadius:4}}>{pendingDelete==='motor:'+m.id?'Confirm?':'✕'}</button>
                        </div>
                        <div style={{padding:'9px 11px'}}>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                            <label style={{fontSize:10,color:'#4A5568'}}>My Cost/unit</label>
                            <input type="number" value={m.my_cost_per_unit} step={1} onChange={e=>updMotor(m.id,'my_cost_per_unit',parseFloat(e.target.value)||0)} onBlur={e=>saveMotorField(m.id,'my_cost_per_unit',parseFloat(e.target.value)||0)} style={{width:68,padding:'3px 6px',border:'1px solid #E2DDD6',borderRadius:4,fontSize:11,textAlign:'right'}}/>
                          </div>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                            <label style={{fontSize:10,color:'#4A5568'}}>× Factor</label>
                            <input type="number" value={m.factor} step={0.1} onChange={e=>updMotor(m.id,'factor',parseFloat(e.target.value)||0)} onBlur={e=>saveMotorField(m.id,'factor',parseFloat(e.target.value)||0)} style={{width:68,padding:'3px 6px',border:'1px solid #E2DDD6',borderRadius:4,fontSize:11,textAlign:'right'}}/>
                          </div>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                            <label style={{fontSize:10,color:'#4A5568'}}>→ Quote/unit</label>
                            <span style={{fontSize:11,color:'#7C3AED',fontWeight:600}}>${(m.my_cost_per_unit*m.factor).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{margin:'0 16px 14px',padding:10,border:'1px dashed #7C3AED',borderRadius:7,background:'#EDE9FF40'}}>
                    <div style={{fontSize:11,fontWeight:700,marginBottom:8,color:'#7C3AED'}}>＋ Add Motor / Control Type</div>
                    <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
                      <input placeholder="e.g. Outdoor Motor" value={newMotorName} onChange={e=>setNewMotorName(e.target.value)} style={{flex:1,minWidth:140,padding:'6px 9px',border:'1px solid #E2DDD6',borderRadius:5,fontSize:12}}/>
                      <input type="number" placeholder="Cost/unit" value={newMotorCost} onChange={e=>setNewMotorCost(parseFloat(e.target.value)||0)} style={{width:90,padding:'6px 9px',border:'1px solid #E2DDD6',borderRadius:5,fontSize:12}}/>
                      <input type="number" placeholder="Factor" value={newMotorFactor} onChange={e=>setNewMotorFactor(parseFloat(e.target.value)||0)} style={{width:80,padding:'6px 9px',border:'1px solid #E2DDD6',borderRadius:5,fontSize:12}}/>
                      <button onClick={addMotor} style={{background:'#7C3AED',color:'#fff',border:'none',padding:'7px 14px',borderRadius:6,fontSize:12,fontWeight:700,cursor:'pointer'}}>＋ Add</button>
                    </div>
                  </div>
                </div>

                {/* SETTINGS */}
                <div style={{background:'#fff',borderRadius:10,border:'1px solid #E2DDD6',marginBottom:16,overflow:'hidden'}}>
                  <div style={{padding:'12px 16px',borderBottom:'1px solid #E2DDD6',fontWeight:700,fontSize:13}}>Shipping, Tax, Discount & Fees</div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:10,padding:'14px 16px'}}>
                    <div style={{border:'1px solid #E2DDD6',borderRadius:8,padding:'11px 13px'}}>
                      <div style={{fontSize:11,fontWeight:700,color:'#4A5568',marginBottom:9}}>🚚 Shipping</div>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <label style={{fontSize:11,color:'#4A5568'}}>Rate</label>
                        <div><input type="number" value={config.shipping_pct} step={0.5} onChange={e=>{setConfig(c=>({...c,shipping_pct:parseFloat(e.target.value)||0})); markDirty()}} style={{width:84,padding:'4px 7px',border:'1px solid #E2DDD6',borderRadius:4,fontSize:12,textAlign:'right'}}/> <span style={{fontSize:10,color:'#9AA5B4'}}>% of subtotal</span></div>
                      </div>
                      <div style={{fontSize:10,color:'#9AA5B4',marginTop:5}}>Preview: <strong>{fmt(ship)}</strong></div>
                    </div>
                    <div style={{border:'1px solid #E2DDD6',borderRadius:8,padding:'11px 13px'}}>
                      <div style={{fontSize:11,fontWeight:700,color:'#4A5568',marginBottom:9}}>💰 Tax</div>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <label style={{fontSize:11,color:'#4A5568'}}>Rate</label>
                        <div><input type="number" value={config.tax_pct} step={0.5} onChange={e=>{setConfig(c=>({...c,tax_pct:parseFloat(e.target.value)||0})); markDirty()}} style={{width:84,padding:'4px 7px',border:'1px solid #E2DDD6',borderRadius:4,fontSize:12,textAlign:'right'}}/> <span style={{fontSize:10,color:'#9AA5B4'}}>%</span></div>
                      </div>
                    </div>
                    <div style={{border:'1px solid #E2DDD6',borderRadius:8,padding:'11px 13px'}}>
                      <div style={{fontSize:11,fontWeight:700,color:'#4A5568',marginBottom:9}}>🏷 Discount</div>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:7}}>
                        <label style={{fontSize:11,color:'#4A5568'}}>%</label>
                        <input type="number" value={config.discount_pct} step={1} onChange={e=>{setConfig(c=>({...c,discount_pct:parseFloat(e.target.value)||0})); markDirty()}} style={{width:84,padding:'4px 7px',border:'1px solid #E2DDD6',borderRadius:4,fontSize:12,textAlign:'right'}}/>
                      </div>
                      <input placeholder="Reason…" value={config.discount_reason||''} onChange={e=>{setConfig(c=>({...c,discount_reason:e.target.value})); markDirty()}} style={{width:'100%',padding:'4px 7px',border:'1px solid #E2DDD6',borderRadius:4,fontSize:11}}/>
                    </div>
                    <div style={{border:'1px solid #E2DDD6',borderRadius:8,padding:'11px 13px'}}>
                      <div style={{fontSize:11,fontWeight:700,color:'#4A5568',marginBottom:9}}>🔧 Installation</div>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <label style={{fontSize:11,color:'#4A5568'}}>Flat Fee</label>
                        <div><span style={{fontSize:10,color:'#9AA5B4'}}>$</span> <input type="number" value={config.installation} step={50} onChange={e=>{setConfig(c=>({...c,installation:parseFloat(e.target.value)||0})); markDirty()}} style={{width:84,padding:'4px 7px',border:'1px solid #E2DDD6',borderRadius:4,fontSize:12,textAlign:'right'}}/></div>
                      </div>
                    </div>
                  </div>
                  <div style={{padding:'4px 16px 8px',borderTop:'1px solid #E2DDD6'}}>
                    <div style={{fontSize:11,fontWeight:700,color:'#4A5568',margin:'8px 0'}}>Custom Fee / Charge Lines</div>
                    {fees.map((f,i)=>(
                      <div key={i} style={{display:'flex',alignItems:'center',gap:8,marginBottom:7}}>
                        <input value={f.label} onChange={e=>updFee(i,'label',e.target.value)} placeholder="Label" style={{flex:1,padding:'5px 8px',border:'1px solid #E2DDD6',borderRadius:5,fontSize:12}}/>
                        <select value={f.fee_type} onChange={e=>updFee(i,'fee_type',e.target.value)} style={{padding:'5px 7px',border:'1px solid #E2DDD6',borderRadius:5,fontSize:11,background:'#F7F4EF'}}>
                          <option value="flat">$ Flat</option><option value="pct">% of subtotal</option>
                        </select>
                        <input type="number" value={f.value} onChange={e=>updFee(i,'value',parseFloat(e.target.value)||0)} style={{width:80,padding:'5px 7px',border:'1px solid #E2DDD6',borderRadius:5,fontSize:12,textAlign:'right'}}/>
                        <button onClick={()=>delFee(i)} style={{background:'none',border:'none',color:'#E53E3E',cursor:'pointer',fontSize:13,opacity:.6}}>✕</button>
                      </div>
                    ))}
                  </div>
                  <button onClick={addFeeLine} style={{margin:'0 16px 14px',padding:'7px 12px',border:'1px dashed #C9A84C',borderRadius:6,background:'rgba(201,168,76,.08)',color:'#8B6914',fontSize:11,cursor:'pointer',fontWeight:600}}>＋ Add Custom Fee / Charge Line</button>
                </div>

                {/* EXCEL IMPORT */}
                <div style={{background:'#fff',borderRadius:10,border:'1px solid #E2DDD6',marginBottom:16,overflow:'hidden'}}>
                  <div style={{padding:'12px 16px',borderBottom:'1px solid #E2DDD6',fontWeight:700,fontSize:13}}>📥 Import from Excel <span style={{background:'#CCFBF1',color:'#0D9488',fontSize:10,padding:'2px 8px',borderRadius:10,fontWeight:700,marginLeft:6}}>Upload .xlsx to auto-populate rows</span></div>
                  <div style={{padding:'14px 16px',display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
                    <label style={{display:'flex',alignItems:'center',gap:8,background:'#CCFBF1',border:'1px solid #0D9488',borderRadius:7,padding:'9px 16px',cursor:'pointer',fontSize:12,color:'#0D9488',fontWeight:600}}>
                      📂 Choose Excel File
                      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{display:'none'}} onChange={e=>{ const f=e.target.files?.[0]; if(f) importExcel(f); e.target.value='' }}/>
                    </label>
                    <div style={{fontSize:11,color:'#9AA5B4',lineHeight:1.7}}>Upload your project .xlsx — auto-matches: <em>Location, Blind Type, Width, Height, Qty, Control, Fabric, Mount, Remarks</em></div>
                  </div>
                  {importStatus && (
                    <div style={{margin:'0 16px 12px',padding:'9px 12px',borderRadius:5,fontSize:11,
                      background: importStatus.type==='ok'?'#D1FAE5':importStatus.type==='error'?'#FEE2E2':'#FEF3C7',
                      color: importStatus.type==='ok'?'#065F46':importStatus.type==='error'?'#E53E3E':'#92400E',
                      border: `1px solid ${importStatus.type==='ok'?'#A7F3D0':importStatus.type==='error'?'#FECACA':'#FCD34D'}`}}>
                      {importStatus.msg}
                    </div>
                  )}
                </div>

                <div style={{background:'#fff',borderRadius:10,border:'1px solid #E2DDD6',marginBottom:16,overflow:'hidden'}}>
                  <div style={{padding:'14px 16px',borderBottom:'1px solid #E2DDD6'}}>
                    <div style={{fontWeight:700,fontSize:13,marginBottom:8}}>Per-Window Cost / Sell / In-Pocket <span style={{background:'#D1FAE5',color:'#065F46',fontSize:10,padding:'2px 8px',borderRadius:10,fontWeight:700,marginLeft:6}}>Admin only</span></div>
                    <div style={{background:'#F7F4EF',borderRadius:7,padding:'10px 13px',fontSize:11,color:'#4A5568',lineHeight:1.8}}>
                      <strong>Formula:</strong> In-Pocket = (What you sell it for, after discount) − (What it actually costs you) — excludes tax, shipping &amp; installation, since those are pass-through, not margin.<br/>
                      <strong>This project:</strong> {fmt(sub)} you'll collect for goods − {fmt(totCost)} it costs you = <strong style={{color:'#27AE60'}}>{fmt(inPocket)} In-Pocket</strong>
                    </div>
                  </div>
                  <div style={{overflowX:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:11,minWidth:820}}>
                      <thead><tr style={{background:'#EDEBE6',textAlign:'left'}}>
                        <th style={{padding:'6px 8px',fontSize:9,color:'#4A5568',borderRight:'1px solid #E2DDD6'}}>#</th>
                        <th style={{padding:'6px 8px',fontSize:9,color:'#4A5568',borderRight:'1px solid #E2DDD6'}}>Location</th>
                        <th style={{padding:'6px 8px',fontSize:9,color:'#4A5568',borderRight:'1px solid #E2DDD6'}}>Blind Type / Control</th>
                        <th style={{padding:'6px 8px',fontSize:9,color:'#4A5568',borderRight:'1px solid #E2DDD6',textAlign:'right'}}>My Cost</th>
                        <th style={{padding:'6px 8px',fontSize:9,color:'#4A5568',borderRight:'1px solid #E2DDD6',textAlign:'right'}}>Sell Price</th>
                        <th style={{padding:'6px 8px',fontSize:9,color:'#27AE60',textAlign:'right'}}>In-Pocket</th>
                      </tr></thead>
                      <tbody>
                        {dataRows.map((r,idx)=>{
                          const bCost=blindsCost(r), bSell=blindsQ(r), mCost=motorCost(r), mSell=motorQ(r)
                          const lineCost=bCost+mCost, lineSell=(bSell+mSell)*(1-config.discount_pct/100)
                          const lineInPocket=lineSell-lineCost
                          return (
                            <tr key={r.id} style={{borderBottom:'1px solid #F0EDE8'}}>
                              <td style={{padding:'6px 8px',color:'#9AA5B4',borderRight:'1px solid #F0EDE8'}}>{idx+1}</td>
                              <td style={{padding:'6px 8px',borderRight:'1px solid #F0EDE8'}}>{r.location||'—'}</td>
                              <td style={{padding:'6px 8px',borderRight:'1px solid #F0EDE8'}}>{r.blind_type}{mCost>0 || mSell>0 ? ` + ${r.control}` : ''}</td>
                              <td style={{padding:'6px 8px',textAlign:'right',borderRight:'1px solid #F0EDE8',color:'#E53E3E'}}>{fmt(lineCost)}</td>
                              <td style={{padding:'6px 8px',textAlign:'right',borderRight:'1px solid #F0EDE8'}}>{fmt(lineSell)}</td>
                              <td style={{padding:'6px 8px',textAlign:'right',fontWeight:700,color:lineInPocket>=0?'#27AE60':'#E53E3E'}}>{fmt(lineInPocket)}</td>
                            </tr>
                          )
                        })}
                        {dataRows.length===0 && <tr><td colSpan={6} style={{padding:16,textAlign:'center',color:'#9AA5B4'}}>No rows on the project sheet yet</td></tr>}
                      </tbody>
                      <tfoot><tr style={{background:'#EDEBE6',borderTop:'2px solid #C9A84C'}}>
                        <td colSpan={3} style={{padding:'7px 8px',fontWeight:700,fontSize:11,borderRight:'1px solid #E2DDD6'}}>TOTALS</td>
                        <td style={{padding:'7px 8px',textAlign:'right',fontWeight:700,color:'#E53E3E',borderRight:'1px solid #E2DDD6'}}>{fmt(totCost)}</td>
                        <td style={{padding:'7px 8px',textAlign:'right',fontWeight:700,borderRight:'1px solid #E2DDD6'}}>{fmt(sub)}</td>
                        <td style={{padding:'7px 8px',textAlign:'right',fontWeight:700,color:'#27AE60'}}>{fmt(inPocket)}</td>
                      </tr></tfoot>
                    </table>
                  </div>
                  <div style={{padding:'12px 16px',borderTop:'1px solid #E2DDD6',background:'#FAFAFA'}}>
                    <div style={{fontSize:10,fontWeight:700,color:'#9AA5B4',textTransform:'uppercase',marginBottom:8}}>Pass-Through Expenses (not part of In-Pocket margin)</div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:10}}>
                      <div><div style={{fontSize:9,color:'#9AA5B4'}}>Shipping ({config.shipping_pct}%)</div><div style={{fontSize:13,fontWeight:700}}>{fmt(ship)}</div></div>
                      <div><div style={{fontSize:9,color:'#9AA5B4'}}>Tax ({config.tax_pct}%)</div><div style={{fontSize:13,fontWeight:700}}>{fmt(tax)}</div></div>
                      <div><div style={{fontSize:9,color:'#9AA5B4'}}>Installation</div><div style={{fontSize:13,fontWeight:700}}>{fmt(config.installation)}</div></div>
                      {fees.map((f,i)=>(
                        <div key={i}><div style={{fontSize:9,color:'#9AA5B4'}}>{f.label}</div><div style={{fontSize:13,fontWeight:700}}>{fmt(f.fee_type==='pct'?sub*(f.value/100):f.value)}</div></div>
                      ))}
                      <div style={{borderLeft:'2px solid #C9A84C',paddingLeft:10}}><div style={{fontSize:9,color:'#8B6914'}}>Grand Total (all-in)</div><div style={{fontSize:14,fontWeight:700,color:'#8B6914'}}>{fmt(grand)}</div></div>
                    </div>
                  </div>
                </div>

                <div style={{background:'#D1FAE5',borderRadius:8,padding:14,fontSize:13,color:'#065F46'}}>
                  <strong>Preview after Push:</strong><br/>
                  Subtotal: {fmt(sub)} · Shipping ({config.shipping_pct}%): {fmt(ship)} · Tax ({config.tax_pct}%): {fmt(tax)} · Installation: {fmt(config.installation)}{fees.length?` · Extras: ${fmt(extraTotal)}`:''}<br/>
                  <strong>Grand Total: {fmt(grand)}</strong>
                </div>
              </div>
            </div>
          )}

          {/* SUMMARY TAB */}
          {tab==='summary' && (
            <div style={{flex:1,overflow:'auto',padding:24}}>
              <div style={{maxWidth:600}}>
                <div style={{fontFamily:'Playfair Display,serif',fontSize:20,marginBottom:4}}>{project.name} — Quote</div>
                <div style={{fontSize:11,color:'#9AA5B4',marginBottom:18}}>Generated {new Date().toLocaleDateString()} · Valid 30 days</div>
                <div style={{background:'#fff',borderRadius:10,border:'1px solid #E2DDD6',padding:20}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                    <tbody>
                    {[['Blinds',fmt(totB)],['Motors',fmt(totM)],
                      ...(config.discount_pct>0?[[`Discount (${config.discount_pct}%)`,'-'+fmt((totB+totM)*config.discount_pct/100)]]:[]),
                      [`Tax @ ${config.tax_pct}%`,fmt(tax)],[`Shipping (${config.shipping_pct}%)`,fmt(ship)],['Installation',fmt(config.installation)],
                      ...fees.map(f=>[f.label,fmt(f.fee_type==='pct'?sub*(f.value/100):f.value)])
                    ].map(([l,v])=>(
                      <tr key={l} style={{borderBottom:'1px solid #E2DDD6'}}>
                        <td style={{padding:'8px 0',color:'#4A5568'}}>{l}</td>
                        <td style={{textAlign:'right',fontWeight:600,color:String(l).includes('Discount')?'#27AE60':'#1C1C1E'}}>{v}</td>
                      </tr>
                    ))}
                    <tr>
                      <td style={{padding:'12px 0',fontSize:15,fontWeight:700}}>GRAND TOTAL</td>
                      <td style={{textAlign:'right',fontSize:17,fontWeight:700,color:'#8B6914'}}>{fmt(grand)}</td>
                    </tr>
                    </tbody>
                  </table>
                </div>
                <a href={`/quote/${id}`} target="_blank" style={{display:'inline-block',marginTop:14,background:'#1C1C1E',color:'#fff',padding:'10px 20px',borderRadius:8,textDecoration:'none',fontSize:13,fontWeight:700}}>🔗 View Customer Link</a>
              </div>
            </div>
          )}

          {/* INVOICES TAB */}
          {tab==='invoices' && (
            <div style={{flex:1,overflow:'auto',padding:18}}>
              <div style={{maxWidth:900}}>
                <div style={{background:'#fff',borderRadius:10,border:'1px solid #E2DDD6',padding:'14px 16px',marginBottom:14}}>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:10}}>
                    <div style={{background:'#F7F4EF',borderRadius:8,padding:'9px 12px'}}>
                      <div style={{fontSize:9,fontWeight:700,color:'#9AA5B4',textTransform:'uppercase',marginBottom:3}}>Project Total</div>
                      <div style={{fontSize:15,fontWeight:700,color:'#1C1C1E'}}>{fmt(project.grand_total||0)}</div>
                    </div>
                    <div style={{background:'#F0FDF4',borderRadius:8,padding:'9px 12px'}}>
                      <div style={{fontSize:9,fontWeight:700,color:'#27AE60',textTransform:'uppercase',marginBottom:3}}>Paid So Far</div>
                      <div style={{fontSize:15,fontWeight:700,color:'#27AE60'}}>{fmt(paidAmount)}</div>
                    </div>
                    <div style={{background:'#FEF3C7',borderRadius:8,padding:'9px 12px'}}>
                      <div style={{fontSize:9,fontWeight:700,color:'#92400E',textTransform:'uppercase',marginBottom:3}}>Balance Remaining</div>
                      <div style={{fontSize:15,fontWeight:700,color:'#92400E'}}>{fmt(balanceRemaining)}</div>
                    </div>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#4A5568',marginBottom:6}}>
                    <span>Collection Progress</span>
                    <span>{billedPct.toFixed(0)}% invoiced ({fmt(invoicedAmount)}) · {paidPct.toFixed(0)}% paid</span>
                  </div>
                  <div style={{height:8,borderRadius:6,background:'#F7F4EF'}}>
                    <div style={{height:'100%',borderRadius:6,width:`${Math.min(100,paidPct)}%`,background:'linear-gradient(90deg,#C9A84C,#27AE60)'}}/>
                  </div>
                </div>

                <div style={{marginBottom:12}}>
                  <button onClick={()=>{setShowAddInvoice(v=>!v); setNewInvPct(Math.min(30,remainingPct))}} style={{background:'#8B6914',color:'#fff',border:'none',padding:'9px 16px',borderRadius:7,fontSize:12,fontWeight:700,cursor:'pointer'}}>＋ Add Invoice</button>
                </div>

                {showAddInvoice && (
                  <div style={{background:'#FFFBF0',border:'1px dashed #C9A84C',borderRadius:8,padding:14,marginBottom:14}}>
                    <div style={{fontSize:11,color:'#9AA5B4',marginBottom:8}}>Remaining to bill: <strong>{remainingPct}%</strong></div>
                    <div style={{display:'flex',gap:10,alignItems:'flex-end',flexWrap:'wrap'}}>
                      <div>
                        <label style={{display:'block',fontSize:10,fontWeight:700,color:'#4A5568',marginBottom:3}}>% of Total</label>
                        <input type="number" value={newInvPct} min={1} max={remainingPct} onChange={e=>setNewInvPct(parseFloat(e.target.value)||0)} style={{width:80,padding:'6px 8px',border:'1px solid #E2DDD6',borderRadius:5,fontSize:12}}/>
                      </div>
                      <div>
                        <label style={{display:'block',fontSize:10,fontWeight:700,color:'#4A5568',marginBottom:3}}>Payment Method</label>
                        <select value={newInvMethod} onChange={e=>setNewInvMethod(e.target.value as 'cash'|'square')} style={{padding:'6px 8px',border:'1px solid #E2DDD6',borderRadius:5,fontSize:12}}>
                          <option value="cash">💵 Cash</option>
                          <option value="square">💳 Square</option>
                        </select>
                      </div>
                      <div style={{fontSize:12,color:'#4A5568'}}>
                        Amount due: <strong style={{color:'#8B6914'}}>{fmt(previewInvoiceAmount(newInvPct,newInvMethod).total)}</strong>
                        {previewInvoiceAmount(newInvPct,newInvMethod).surcharge>0 && <span style={{fontSize:10,color:'#9AA5B4'}}> (incl. {fmt(previewInvoiceAmount(newInvPct,newInvMethod).surcharge)} surcharge)</span>}
                      </div>
                      <button disabled={invBusy} onClick={createInvoice} style={{background:'#27AE60',color:'#fff',border:'none',padding:'8px 16px',borderRadius:6,fontSize:12,fontWeight:700,cursor:'pointer'}}>{invBusy?'Creating…':'Create Invoice'}</button>
                      <button onClick={()=>setShowAddInvoice(false)} style={{background:'#fff',border:'1px solid #E2DDD6',padding:'8px 16px',borderRadius:6,fontSize:12,cursor:'pointer'}}>Cancel</button>
                    </div>
                  </div>
                )}

                <div style={{background:'#fff',borderRadius:10,border:'1px solid #E2DDD6',overflow:'hidden'}}>
                  {invoices.length===0 && <div style={{padding:20,fontSize:12,color:'#9AA5B4'}}>No invoices yet. Push pricing on the project sheet, then "Add Invoice" to start the chain — a new invoice unlocks only once the prior one is paid.</div>}
                  {invoices.map(inv=>{
                    const isExp = !!expandedInv[inv.id]
                    const editable = inv.status!=='paid'
                    return (
                      <div key={inv.id} style={{borderBottom:'1px solid #E2DDD6',opacity:inv.status==='void'?0.55:1}}>
                        <div style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',flexWrap:'wrap'}}>
                          <div style={{width:28,height:28,borderRadius:'50%',background:'#F7F4EF',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'#8B6914'}}>#{inv.sequence_num}</div>
                          <div style={{flex:1,minWidth:140}}>
                            <div style={{fontSize:13,fontWeight:600,textDecoration:inv.status==='void'?'line-through':'none'}}>{inv.invoice_number} <span style={{fontWeight:400,color:'#9AA5B4',fontSize:11}}>({inv.invoice_type})</span></div>
                            <div style={{fontSize:11,color:'#9AA5B4'}}>{inv.pct_of_total}% of total {inv.status==='paid'?`· paid ${new Date(inv.fully_paid_at||'').toLocaleString()}`:'· '+inv.status}</div>
                          </div>
                          <span style={{fontSize:11,fontWeight:600,padding:'3px 9px',borderRadius:10,background:inv.payment_method==='square'?'#EDE9FF':'#D1FAE5',color:inv.payment_method==='square'?'#7C3AED':'#27AE60'}}>
                            {inv.payment_method==='square'?`💳 Square (+${fmt(inv.square_surcharge||0)})`:'💵 Cash'}
                          </span>
                          <div style={{fontSize:14,fontWeight:700,color:'#8B6914'}}>{fmt(inv.total_amount||0)}</div>
                          {inv.status!=='void' && (
                            <button disabled={invBusy} onClick={()=>markInvoicePaid(inv.id, inv.status!=='paid')} style={{border:'none',padding:'6px 12px',borderRadius:6,fontSize:11,fontWeight:700,cursor:'pointer',background:inv.status==='paid'?'#D1FAE5':'#FEE2E2',color:inv.status==='paid'?'#065F46':'#E53E3E'}}>
                              {inv.status==='paid'?'✓ PAID':'✕ UNPAID'}
                            </button>
                          )}
                          <button onClick={()=>toggleInvExpand(inv.id)} style={{border:'1px solid #E2DDD6',background:'#fff',padding:'6px 12px',borderRadius:6,fontSize:11,cursor:'pointer'}}>{isExp?'Hide':'👁 View / Send'}</button>
                          {inv.status!=='paid' && (
                            <button disabled={invBusy} onClick={()=>voidInvoice(inv.id, inv.status==='void')} title={inv.status==='void'?'Restore this invoice':'Void — keeps the record but removes it from balance owed'}
                              style={{border:'1px solid #E2DDD6',background:'#fff',color:'#92400E',padding:'6px 10px',borderRadius:6,fontSize:11,cursor:'pointer'}}>
                              {inv.status==='void'?'↺ Restore':'🚫 Void'}
                            </button>
                          )}
                          {inv.status!=='paid' && (
                            <button disabled={invBusy} onClick={()=>deleteInvoice(inv.id)} title="Only allowed if this invoice has no payment history"
                              style={{border:'1px solid #FECACA',background:confirmDeleteInv===inv.id?'#E53E3E':'#fff',color:confirmDeleteInv===inv.id?'#fff':'#E53E3E',padding:'6px 10px',borderRadius:6,fontSize:11,cursor:'pointer'}}>
                              {confirmDeleteInv===inv.id?'Confirm?':'🗑 Delete'}
                            </button>
                          )}
                        </div>
                        {isExp && (
                          <div style={{padding:'0 16px 16px'}}>
                            <div style={{border:'1px solid #E2DDD6',borderRadius:8,padding:16,background:'#FAFAFA'}}>
                              <div style={{display:'flex',alignItems:'center',gap:12,borderBottom:'2px solid #8B6914',paddingBottom:12,marginBottom:12}}>
                                <img src="/ceb-logo.jpg" alt="CEB" style={{width:48,height:48,objectFit:'contain'}}/>
                                <div style={{flex:1}}>
                                  <div style={{fontFamily:'Playfair Display,serif',fontSize:14,fontWeight:700,color:'#8B6914'}}>Custom Elegant Blinds</div>
                                  <div style={{fontSize:10,color:'#9AA5B4'}}>Zebra Blinds · Honey Comb · Dream Curtain</div>
                                </div>
                                <div style={{textAlign:'right'}}>
                                  <div style={{fontSize:9,fontWeight:700,color:'#9AA5B4',letterSpacing:'.5px'}}>INVOICE</div>
                                  <div style={{fontSize:13,fontWeight:700}}>{inv.invoice_number}</div>
                                </div>
                              </div>
                              <div style={{display:'grid',gridTemplateColumns:'1.3fr 1fr 0.8fr',gap:12,marginBottom:14,fontSize:12}}>
                                <div>
                                  <div style={{fontSize:9,fontWeight:700,color:'#9AA5B4',textTransform:'uppercase',marginBottom:3}}>Bill To</div>
                                  <div>{project.customers?.name}<br/>{project.customers?.email}<br/>{project.address}</div>
                                </div>
                                <div>
                                  <div style={{fontSize:9,fontWeight:700,color:'#9AA5B4',textTransform:'uppercase',marginBottom:3}}>Project</div>
                                  <div>{project.name}</div>
                                </div>
                                <div>
                                  <div style={{fontSize:9,fontWeight:700,color:'#9AA5B4',textTransform:'uppercase',marginBottom:3}}>Status</div>
                                  <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:9,background:inv.status==='paid'?'#D1FAE5':'#FEF3C7',color:inv.status==='paid'?'#065F46':'#92400E'}}>{inv.status==='paid'?'✓ Paid':'Due'}</span>
                                </div>
                              </div>
                              {dataRows.length>0 && (
                                <div style={{marginBottom:12}}>
                                  <div style={{fontSize:10,fontWeight:700,color:'#9AA5B4',textTransform:'uppercase',marginBottom:6}}>Items in this project ({dataRows.length})</div>
                                  <table style={{width:'100%',fontSize:11,borderCollapse:'collapse'}}>
                                    <thead><tr style={{borderBottom:'1px solid #E2DDD6',textAlign:'left'}}>
                                      <th style={{padding:'0 0 5px',fontSize:9,color:'#9AA5B4'}}>Location</th>
                                      <th style={{padding:'0 0 5px',fontSize:9,color:'#9AA5B4'}}>Blind Type</th>
                                      <th style={{padding:'0 0 5px',fontSize:9,color:'#9AA5B4'}}>Control</th>
                                      <th style={{padding:'0 0 5px',fontSize:9,color:'#9AA5B4',textAlign:'center'}}>Qty</th>
                                    </tr></thead>
                                    <tbody>
                                      {dataRows.map(r=>(
                                        <tr key={r.id} style={{borderBottom:'1px solid #F0EDE8'}}>
                                          <td style={{padding:'4px 0'}}>{r.location||'—'}</td>
                                          <td style={{padding:'4px 0'}}>{r.blind_type}</td>
                                          <td style={{padding:'4px 0'}}>{r.control}</td>
                                          <td style={{padding:'4px 0',textAlign:'center'}}>{r.qty}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                              <table style={{width:'100%',fontSize:12,borderCollapse:'collapse',marginBottom:12}}>
                                <thead><tr style={{borderBottom:'2px solid #E2DDD6',textAlign:'left'}}>
                                  <th style={{padding:'0 0 6px',fontSize:10,color:'#4A5568'}}>Description</th>
                                  <th style={{padding:'0 0 6px',fontSize:10,color:'#4A5568',textAlign:'right'}}>% of Total</th>
                                  <th style={{padding:'0 0 6px',fontSize:10,color:'#4A5568',textAlign:'right'}}>Amount</th>
                                </tr></thead>
                                <tbody>
                                  <tr style={{borderBottom:'1px solid #E2DDD6'}}>
                                    <td style={{padding:'8px 0'}}>{inv.invoice_type} — {project.name}<br/><span style={{fontSize:10,color:'#9AA5B4'}}>Project Total: {fmt(project.grand_total||0)}</span></td>
                                    <td style={{padding:'8px 0',textAlign:'right'}}>
                                      {editable ? <input type="number" value={editInvPct[inv.id]??inv.pct_of_total??0} onChange={e=>setEditInvPct(p=>({...p,[inv.id]:parseFloat(e.target.value)||0}))} style={{width:60,padding:'2px 5px',border:'1px solid #C9A84C',borderRadius:4,textAlign:'right'}}/> : `${inv.pct_of_total}%`}
                                    </td>
                                    <td style={{padding:'8px 0',textAlign:'right'}}>{fmt(inv.total_amount||0)}</td>
                                  </tr>
                                </tbody>
                                <tfoot><tr style={{borderTop:'2px solid #8B6914'}}>
                                  <td colSpan={2} style={{paddingTop:8,fontWeight:700}}>Amount Due</td>
                                  <td style={{paddingTop:8,textAlign:'right',fontWeight:700,fontSize:15,color:'#8B6914'}}>{fmt(inv.total_amount||0)}</td>
                                </tr></tfoot>
                              </table>
                              {editable ? (
                                <div style={{marginBottom:12}}>
                                  <label style={{display:'block',fontSize:10,fontWeight:700,color:'#4A5568',marginBottom:3}}>Payment Method</label>
                                  <select value={editInvMethod[inv.id]??'cash'} onChange={e=>setEditInvMethod(p=>({...p,[inv.id]:e.target.value as 'cash'|'square'}))} style={{padding:'6px 8px',border:'1px solid #E2DDD6',borderRadius:5,fontSize:12}}>
                                    <option value="cash">💵 Cash</option>
                                    <option value="square">💳 Square</option>
                                  </select>
                                </div>
                              ) : <div style={{fontSize:11,color:'#9AA5B4',marginBottom:12}}>This invoice is paid and locked from further edits.</div>}
                              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                                {editable && <button disabled={invBusy} onClick={()=>saveInvoiceEdit(inv.id)} style={{background:'#C9A84C',color:'#1C1C1E',border:'none',padding:'8px 14px',borderRadius:6,fontSize:12,fontWeight:700,cursor:'pointer'}}>💾 Save Changes</button>}
                                <button disabled={invBusy} onClick={()=>emailInvoice(inv)} style={{background:'#7C3AED',color:'#fff',border:'none',padding:'8px 14px',borderRadius:6,fontSize:12,fontWeight:700,cursor:'pointer'}}>✉ Email to Customer</button>
                                <button onClick={()=>printInvoice(inv)} style={{background:'#fff',border:'1px solid #E2DDD6',padding:'8px 14px',borderRadius:6,fontSize:12,cursor:'pointer'}}>🖨 Print / PDF</button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* GRIEVANCES TAB */}
          {tab==='grievances' && (
            <div style={{flex:1,overflow:'auto',padding:18}}>
              <div style={{maxWidth:900}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                  <button onClick={()=>setShowAddGrievance(v=>!v)} style={{background:'#FEE2E2',color:'#E53E3E',border:'1px solid #FECACA',padding:'9px 16px',borderRadius:7,fontSize:12,fontWeight:700,cursor:'pointer'}}>＋ Log Grievance</button>
                  <div style={{fontSize:12,color:'#4A5568'}}>{openGrievCount} open</div>
                </div>

                {showAddGrievance && (
                  <div style={{background:'#FFF5F5',border:'1px dashed #E53E3E',borderRadius:8,padding:14,marginBottom:14}}>
                    <label style={{display:'block',fontSize:10,fontWeight:700,color:'#4A5568',marginBottom:3}}>Title *</label>
                    <input value={newGrievTitle} onChange={e=>setNewGrievTitle(e.target.value)} placeholder="What went wrong?" style={{width:'100%',padding:'7px 9px',border:'1px solid #E2DDD6',borderRadius:5,fontSize:12,marginBottom:10}}/>
                    <label style={{display:'block',fontSize:10,fontWeight:700,color:'#4A5568',marginBottom:3}}>Description</label>
                    <textarea value={newGrievDesc} onChange={e=>setNewGrievDesc(e.target.value)} rows={3} style={{width:'100%',padding:'7px 9px',border:'1px solid #E2DDD6',borderRadius:5,fontSize:12,marginBottom:10,fontFamily:'Inter,sans-serif'}}/>
                    <label style={{display:'block',fontSize:10,fontWeight:700,color:'#4A5568',marginBottom:3}}>Photo (optional)</label>
                    <input type="file" accept="image/*" onChange={e=>setNewGrievFile(e.target.files?.[0]||null)} style={{marginBottom:10,fontSize:12}}/>
                    <div style={{display:'flex',gap:8}}>
                      <button disabled={grievBusy} onClick={addGrievance} style={{background:'#E53E3E',color:'#fff',border:'none',padding:'8px 16px',borderRadius:6,fontSize:12,fontWeight:700,cursor:'pointer'}}>{grievBusy?'Logging…':'Log Grievance'}</button>
                      <button onClick={()=>setShowAddGrievance(false)} style={{background:'#fff',border:'1px solid #E2DDD6',padding:'8px 16px',borderRadius:6,fontSize:12,cursor:'pointer'}}>Cancel</button>
                    </div>
                  </div>
                )}

                {grievances.length===0 && <div style={{background:'#fff',border:'1px solid #E2DDD6',borderRadius:10,padding:20,fontSize:12,color:'#9AA5B4'}}>No grievances logged.</div>}
                {grievances.map(g=>{
                  const gExp = !!expandedGriev[g.id]
                  return (
                  <div key={g.id} style={{background:'#fff',border:'1px solid #E2DDD6',borderLeft:`4px solid ${g.status==='resolved'?'#27AE60':g.status==='in_progress'?'#F59E0B':'#E53E3E'}`,borderRadius:8,padding:14,marginBottom:10}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,gap:8}}>
                      <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:9,background:g.status==='resolved'?'#D1FAE5':g.status==='in_progress'?'#FEF3C7':'#FEE2E2',color:g.status==='resolved'?'#065F46':g.status==='in_progress'?'#92400E':'#E53E3E'}}>{g.status.replace('_',' ').toUpperCase()}</span>
                      <div style={{display:'flex',gap:6,marginLeft:'auto',flexWrap:'wrap'}}>
                        {g.status!=='resolved' && <button disabled={grievBusy} onClick={()=>openAddUpdateForm(g.id)} style={{background:'#fff',color:'#4A5568',border:'1px solid #E2DDD6',padding:'5px 12px',borderRadius:6,fontSize:11,fontWeight:600,cursor:'pointer'}}>＋ Add Update</button>}
                        {g.status!=='resolved' && <button disabled={grievBusy} onClick={()=>openResolveForm(g.id)} style={{background:'#27AE60',color:'#fff',border:'none',padding:'5px 12px',borderRadius:6,fontSize:11,fontWeight:700,cursor:'pointer'}}>Mark Resolved</button>}
                        <button onClick={()=>setExpandedGriev(prev=>({...prev,[g.id]:!prev[g.id]}))} style={{border:'1px solid #E2DDD6',background:'#fff',padding:'5px 12px',borderRadius:6,fontSize:11,cursor:'pointer'}}>{gExp?'Hide':`👁 View (${g.grievance_updates?.length||0})`}</button>
                      </div>
                    </div>
                    <div style={{fontSize:13,fontWeight:600,marginBottom:4}}>{g.title}</div>
                    <div style={{fontSize:10,color:'#9AA5B4'}}>Logged {new Date(g.created_at).toLocaleString()}</div>
                    {addingUpdateFor===g.id && (
                      <div style={{marginTop:10,background:'#F7F4EF',border:'1px dashed #9AA5B4',borderRadius:6,padding:10}}>
                        <label style={{display:'block',fontSize:10,fontWeight:700,color:'#4A5568',marginBottom:4}}>Update note</label>
                        <textarea value={newUpdateNote} onChange={e=>setNewUpdateNote(e.target.value)} rows={2} autoFocus placeholder="e.g. Called customer, part ordered, installer scheduled…"
                          style={{width:'100%',padding:'6px 8px',border:'1px solid #E2DDD6',borderRadius:5,fontSize:12,marginBottom:8,fontFamily:'Inter,sans-serif'}}/>
                        <div style={{display:'flex',gap:6}}>
                          <button disabled={updateBusy} onClick={()=>addGrievanceUpdate(g.id)} style={{background:'#4A5568',color:'#fff',border:'none',padding:'6px 14px',borderRadius:5,fontSize:11,fontWeight:700,cursor:'pointer'}}>{updateBusy?'Saving…':'Log Update'}</button>
                          <button onClick={()=>setAddingUpdateFor(null)} style={{background:'#fff',border:'1px solid #E2DDD6',padding:'6px 14px',borderRadius:5,fontSize:11,cursor:'pointer'}}>Cancel</button>
                        </div>
                      </div>
                    )}
                    {resolvingGriev===g.id && (
                      <div style={{marginTop:10,background:'#F0FDF4',border:'1px dashed #27AE60',borderRadius:6,padding:10}}>
                        <label style={{display:'block',fontSize:10,fontWeight:700,color:'#065F46',marginBottom:4}}>Final resolution note</label>
                        <textarea value={resolveNote} onChange={e=>setResolveNote(e.target.value)} rows={2} autoFocus placeholder="How was this ultimately resolved?"
                          style={{width:'100%',padding:'6px 8px',border:'1px solid #A7F3D0',borderRadius:5,fontSize:12,marginBottom:8,fontFamily:'Inter,sans-serif'}}/>
                        <div style={{display:'flex',gap:6}}>
                          <button disabled={grievBusy} onClick={()=>resolveGrievance(g.id)} style={{background:'#27AE60',color:'#fff',border:'none',padding:'6px 14px',borderRadius:5,fontSize:11,fontWeight:700,cursor:'pointer'}}>{grievBusy?'Saving…':'Confirm Resolved'}</button>
                          <button onClick={()=>setResolvingGriev(null)} style={{background:'#fff',border:'1px solid #E2DDD6',padding:'6px 14px',borderRadius:5,fontSize:11,cursor:'pointer'}}>Cancel</button>
                        </div>
                      </div>
                    )}
                    {gExp && (
                      <div style={{marginTop:10,paddingTop:10,borderTop:'1px dashed #E2DDD6'}}>
                        {g.description ? <div style={{fontSize:12,color:'#4A5568',marginBottom:10,lineHeight:1.6}}>{g.description}</div> : <div style={{fontSize:11,color:'#9AA5B4',marginBottom:10}}>No description provided.</div>}
                        {g.grievance_photos?.length>0 ? (
                          <div style={{display:'flex',gap:8,marginBottom:10,flexWrap:'wrap'}}>
                            {g.grievance_photos.map(p=>(
                              <a key={p.id} href={p.photo_url} target="_blank" rel="noreferrer"><img src={p.photo_url} alt="" style={{width:90,height:90,borderRadius:6,objectFit:'cover',border:'1px solid #E2DDD6'}}/></a>
                            ))}
                          </div>
                        ) : <div style={{fontSize:11,color:'#9AA5B4',marginBottom:10}}>No photos attached.</div>}
                        {g.grievance_updates?.length>0 && (
                          <div style={{marginBottom:10}}>
                            <div style={{fontSize:10,fontWeight:700,color:'#9AA5B4',textTransform:'uppercase',marginBottom:6}}>Update Log</div>
                            {g.grievance_updates.map(u=>(
                              <div key={u.id} style={{display:'flex',gap:8,padding:'6px 0',borderBottom:'1px dashed #F0EDE8',fontSize:11}}>
                                <span style={{color:'#9AA5B4',whiteSpace:'nowrap',flexShrink:0}}>{new Date(u.created_at).toLocaleString()}</span>
                                <span style={{color:'#4A5568'}}>{u.note}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {g.status==='resolved' && (
                          <div style={{background:'#F0FDF4',border:'1px solid #D1FAE5',borderRadius:6,padding:'8px 10px',fontSize:11,color:'#065F46'}}>
                            <strong>Resolved {g.resolved_at?new Date(g.resolved_at).toLocaleString():''}:</strong> {g.resolution_note||'—'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* EMAIL TAB */}
          {tab==='email' && (
            <div style={{flex:1,overflow:'auto',padding:18}}>
              <div style={{maxWidth:900}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                  <button onClick={openSendEmail} style={{background:'#0D9488',color:'#fff',border:'none',padding:'9px 16px',borderRadius:7,fontSize:12,fontWeight:700,cursor:'pointer'}}>＋ Send Email</button>
                  <div style={{fontSize:12,color:'#4A5568'}}>{emails.length} sent</div>
                </div>

                {showSendEmail && (
                  <div style={{background:'#F0FDFA',border:'1px dashed #0D9488',borderRadius:8,padding:14,marginBottom:14}}>
                    <label style={{display:'block',fontSize:10,fontWeight:700,color:'#4A5568',marginBottom:3}}>To</label>
                    <div style={{fontSize:12,color:'#4A5568',marginBottom:10}}>{project.customers?.email||project.email}</div>
                    <label style={{display:'block',fontSize:10,fontWeight:700,color:'#4A5568',marginBottom:3}}>Template</label>
                    <select value={emailTemplateIdx} onChange={e=>pickEmailTemplate(parseInt(e.target.value))} style={{width:'100%',padding:'7px 9px',border:'1px solid #E2DDD6',borderRadius:5,fontSize:12,marginBottom:10}}>
                      {EMAIL_TEMPLATES.map((t,i)=><option key={t.label} value={i}>{t.label}</option>)}
                    </select>
                    <label style={{display:'block',fontSize:10,fontWeight:700,color:'#4A5568',marginBottom:3}}>Subject</label>
                    <input value={emailSubject} onChange={e=>setEmailSubject(e.target.value)} style={{width:'100%',padding:'7px 9px',border:'1px solid #E2DDD6',borderRadius:5,fontSize:12,marginBottom:10}}/>
                    <label style={{display:'block',fontSize:10,fontWeight:700,color:'#4A5568',marginBottom:3}}>Body</label>
                    <textarea value={emailBody} onChange={e=>setEmailBody(e.target.value)} rows={6} style={{width:'100%',padding:'7px 9px',border:'1px solid #E2DDD6',borderRadius:5,fontSize:12,marginBottom:10,fontFamily:'Inter,sans-serif'}}/>
                    <div style={{fontSize:10,color:'#9AA5B4',marginBottom:10}}>Actual delivery via Resend isn't wired up yet — this logs the send for now.</div>
                    <div style={{display:'flex',gap:8}}>
                      <button disabled={emailBusy} onClick={sendCustomEmail} style={{background:'#0D9488',color:'#fff',border:'none',padding:'8px 16px',borderRadius:6,fontSize:12,fontWeight:700,cursor:'pointer'}}>{emailBusy?'Sending…':'Send'}</button>
                      <button onClick={()=>setShowSendEmail(false)} style={{background:'#fff',border:'1px solid #E2DDD6',padding:'8px 16px',borderRadius:6,fontSize:12,cursor:'pointer'}}>Cancel</button>
                    </div>
                  </div>
                )}

                <div style={{background:'#fff',borderRadius:10,border:'1px solid #E2DDD6',overflow:'hidden'}}>
                  {emails.length===0 && <div style={{padding:20,fontSize:12,color:'#9AA5B4'}}>No emails sent yet.</div>}
                  {emails.map(e=>{
                    const eExp = !!expandedEmail[e.id]
                    return (
                    <div key={e.id} style={{borderBottom:'1px solid #E2DDD6'}}>
                      <div onClick={()=>setExpandedEmail(prev=>({...prev,[e.id]:!prev[e.id]}))} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 16px',fontSize:12,cursor:'pointer',gap:10}}>
                        <span style={{fontSize:10,color:'#9AA5B4',transform:eExp?'rotate(90deg)':'none',display:'inline-block',transition:'.15s',flexShrink:0}}>▶</span>
                        <span style={{flex:1}}><strong>{e.subject}</strong> → {e.to_email}</span>
                        <span style={{color:'#9AA5B4',whiteSpace:'nowrap'}}>{new Date(e.sent_at).toLocaleString()}</span>
                      </div>
                      {eExp && (
                        <div style={{padding:'0 16px 14px 36px'}}>
                          <div style={{background:'#F7F4EF',borderRadius:6,padding:'10px 12px',fontSize:12,color:'#4A5568',whiteSpace:'pre-wrap',lineHeight:1.6}}>{e.body || '(no body content)'}</div>
                        </div>
                      )}
                    </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showNewCustomer && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:998}} onClick={()=>setShowNewCustomer(false)}>
          <div style={{background:'#fff',borderRadius:12,padding:24,width:380,maxWidth:'90vw',boxShadow:'0 24px 64px rgba(0,0,0,.25)'}} onClick={e=>e.stopPropagation()}>
            <div style={{fontFamily:'Playfair Display,serif',fontSize:17,marginBottom:16}}>New Customer</div>
            <label style={{display:'block',fontSize:11,fontWeight:700,color:'#4A5568',marginBottom:4}}>Name *</label>
            <input value={newCustName} onChange={e=>setNewCustName(e.target.value)} autoFocus
              style={{width:'100%',padding:'8px 10px',border:'1px solid #E2DDD6',borderRadius:6,fontSize:13,marginBottom:12}}/>
            <label style={{display:'block',fontSize:11,fontWeight:700,color:'#4A5568',marginBottom:4}}>Email *</label>
            <input value={newCustEmail} onChange={e=>setNewCustEmail(e.target.value)} type="email"
              style={{width:'100%',padding:'8px 10px',border:'1px solid #E2DDD6',borderRadius:6,fontSize:13,marginBottom:12}}/>
            <label style={{display:'block',fontSize:11,fontWeight:700,color:'#4A5568',marginBottom:4}}>Phone</label>
            <input value={newCustPhone} onChange={e=>setNewCustPhone(e.target.value)}
              style={{width:'100%',padding:'8px 10px',border:'1px solid #E2DDD6',borderRadius:6,fontSize:13,marginBottom:18}}/>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={()=>setShowNewCustomer(false)} style={{background:'#F7F4EF',border:'1px solid #E2DDD6',color:'#4A5568',padding:'8px 16px',borderRadius:6,fontSize:12,cursor:'pointer'}}>Cancel</button>
              <button disabled={newCustBusy} onClick={createCustomer} style={{background:'#C9A84C',color:'#1C1C1E',border:'none',padding:'8px 16px',borderRadius:6,fontSize:12,fontWeight:700,cursor:'pointer'}}>{newCustBusy?'Creating…':'Create Customer'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',background:toast.type==='err'?'#E53E3E':'#1C1C1E',color:'#fff',padding:'10px 18px',borderRadius:8,fontSize:12,fontWeight:500,boxShadow:'0 8px 24px rgba(0,0,0,.25)',zIndex:999,maxWidth:'80vw',borderLeft:`3px solid ${toast.type==='err'?'#fff':'#C9A84C'}`}}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
