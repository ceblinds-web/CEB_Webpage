'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'

const CONV = 0.00064516
const MOUNTS = ['Inside','Outside']
const VALANCES = ['—','Standard','Deluxe','Hidden','Corniced']
const BRAILS = ['—','Standard','Weighted','Decorative']
const FABRICS_DEFAULT = ['YX2501','YX2501 + YX2509','M1001-1','Standard','Blackout','Solar 3%','Solar 5%','Natural','Custom']

type Row = { id:string; is_section:boolean; section_name?:string; blind_type:string; control:string; location:string; fabric:string; valance:string; bottom_rail:string; mount:string; width_in:number|''; height_in:number|''; qty:number; remark:string }
type Config = { tax_pct:number; shipping_pct:number; discount_pct:number; discount_reason:string; installation:number }
type Product = { id:string; name:string; my_cost_per_sqm:number; factor:number }
type Motor = { id:string; name:string; my_cost_per_unit:number; factor:number }
type Fee = { id?:string; label:string; fee_type:'flat'|'pct'; value:number }

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
  const [tab, setTab] = useState<'sheet'|'purchase'|'summary'>('sheet')
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
  }
  useEffect(loadAll, [id])

  const sqm = (w:any,h:any) => parseFloat(w||0)*parseFloat(h||0)*CONV
  const getProd = (type:string) => products.find(p=>p.name===type)||{my_cost_per_sqm:16, factor:5}
  const getMtr = (ctrl:string) => motors.find(m=>m.name===ctrl)||{my_cost_per_unit:0, factor:1}
  const blindsQ = (r:Row) => { const p=getProd(r.blind_type); return Math.round(sqm(r.width_in,r.height_in)*p.my_cost_per_sqm*p.factor*100)/100*(r.qty||1) }
  const motorQ = (r:Row) => { const m=getMtr(r.control); return m.my_cost_per_unit*m.factor*(r.qty||1) }
  const lineTotal = (r:Row) => (blindsQ(r)+motorQ(r))*(1-config.discount_pct/100)
  const fmt = (n:number) => (n<0?'-':'')+'$'+Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',')

  const dataRows = rows.filter(r=>!r.is_section)
  const totB = dataRows.reduce((s,r)=>s+blindsQ(r),0)
  const totM = dataRows.reduce((s,r)=>s+motorQ(r),0)
  const sub = (totB+totM)*(1-config.discount_pct/100)
  const ship = sub*(config.shipping_pct/100)
  const tax = sub*(config.tax_pct/100)
  const extraTotal = fees.reduce((s,f)=>s+(f.fee_type==='pct'?sub*(f.value/100):f.value),0)
  const grand = sub+tax+ship+config.installation+extraTotal

  // ── ROW OPERATIONS ──────────────────────────────────────
  let localIdCounter = useRef(1)
  const newLocalId = () => `new_${Date.now()}_${localIdCounter.current++}`

  const addRow = () => {
    const lid = newLocalId()
    setRows(prev=>[...prev, { id:lid, is_section:false, blind_type:products[0]?.name||'HoneyComb', control:motors[0]?.name||'Cordless', location:'', fabric:FABRICS_DEFAULT[0], valance:'—', bottom_rail:'—', mount:'Inside', width_in:'', height_in:'', qty:1, remark:'' }])
    setSelId(lid)
    setTimeout(()=>{ document.querySelector('.sheet-scroll')?.scrollTo({top:99999, behavior:'smooth'}) }, 50)
  }
  const addSection = () => {
    const name = prompt('Section / floor name:','GROUND FLOOR')
    if (!name) return
    setRows(prev=>[...prev, { id:newLocalId(), is_section:true, section_name:name.toUpperCase(), blind_type:'', control:'', location:'', fabric:'', valance:'', bottom_rail:'', mount:'', width_in:'', height_in:'', qty:1, remark:'' }])
  }
  const delRow = () => { if (!selId) return alert('Select a row first'); setRows(prev=>prev.filter(r=>r.id!==selId)); setSelId(null) }
  const dupRow = () => {
    if (!selId) return alert('Select a row first')
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
  const addProduct = async () => {
    if (!newProdName.trim()) return alert('Enter a product name')
    const res = await fetch('/api/products', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name:newProdName.trim(), my_cost_per_sqm:newProdCost, factor:newProdFactor }) })
    if (res.ok) {
      const p = await res.json()
      setProducts(prev=>[...prev, p])
      setNewProdName(''); setNewProdCost(15); setNewProdFactor(5)
      markDirty()
    } else alert('Could not add product — it may already exist')
  }
  const delProduct = async (pid: string) => {
    if (products.length<=1) return alert('Keep at least one product')
    if (!confirm('Remove this product?')) return
    await fetch(`/api/products/${pid}`, { method:'DELETE' })
    setProducts(prev=>prev.filter(p=>p.id!==pid))
    markDirty()
  }
  const updMotor = (mid: string, field: string, val: number) => {
    setMotors(prev=>prev.map(m=>m.id===mid?{...m,[field]:val}:m))
    markDirty()
  }
  const addMotor = async () => {
    if (!newMotorName.trim()) return alert('Enter a name')
    const res = await fetch('/api/motors', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name:newMotorName.trim(), my_cost_per_unit:newMotorCost, factor:newMotorFactor }) })
    if (res.ok) {
      const m = await res.json()
      setMotors(prev=>[...prev, m])
      setNewMotorName(''); setNewMotorCost(30); setNewMotorFactor(3)
      markDirty()
    } else alert('Could not add motor — it may already exist')
  }
  const delMotor = async (mid: string) => {
    if (!confirm('Remove this motor/control?')) return
    await fetch(`/api/motors/${mid}`, { method:'DELETE' })
    setMotors(prev=>prev.filter(m=>m.id!==mid))
    markDirty()
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
    await fetch('/api/push', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ projectId:id, config, fees, rows:toSave, products, motors, grandTotal: grand }) })
    setPushing(false)
    setIsPushed(true)
    alert('✅ Pushed to customer view!')
  }

  const sendEmail = async () => {
    setSendingEmail(true)
    const res = await fetch('/api/email/send-quote', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ projectId:id }) })
    const data = await res.json()
    setSendingEmail(false)
    if (data.success) alert(`✅ Quote email sent!\nView link: ${data.viewUrl}`)
    else alert('❌ Email failed: '+JSON.stringify(data.error))
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

  // Handle Enter key on last input field to add new row
  const handleKeyDown = (e: React.KeyboardEvent, isLastCol: boolean) => {
    if (e.key === 'Enter' && isLastCol) {
      e.preventDefault()
      addRow()
    }
  }

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',fontFamily:'Inter,sans-serif',background:'#F7F4EF',color:'#1C1C1E'}}>
      {/* HEADER */}
      <header style={{height:56,background:'#1C1C1E',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 18px',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <button style={{border:'none',padding:'5px 12px',borderRadius:6,fontSize:12,fontFamily:'Inter,sans-serif',fontWeight:600,cursor:'pointer',background:'rgba(255,255,255,.1)',color:'#fff'}} onClick={()=>router.push('/admin')}>← Admin</button>
          <span style={{color:'#fff',fontFamily:'Playfair Display,serif',fontSize:15}}>{project.name}</span>
          <span style={{color:'#9AA5B4',fontSize:11}}>{project.customers?.name} · {project.address||project.email}</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <select value={project.status} onChange={async e=>{
            await fetch(`/api/projects/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:e.target.value})})
            setProject((p:any)=>({...p,status:e.target.value}))
          }} style={{fontSize:12,padding:'4px 8px',borderRadius:6,border:'1px solid #555',background:'#333',color:'#fff',cursor:'pointer'}}>
            {['draft','sent','viewed','confirmed','invoiced','completed','cancelled'].map(s=><option key={s} value={s}>{s}</option>)}
          </select>
          <button style={{border:'none',padding:'5px 12px',borderRadius:6,fontSize:12,fontWeight:600,cursor:'pointer',background:'rgba(124,58,237,.25)',color:'#C084FC'}} onClick={()=>router.push(`/admin/panel/project/${id}`)}>
            🛡 Invoice & Admin
          </button>
        </div>
      </header>

      {/* BODY */}
      <div style={{display:'flex',flex:1,overflow:'hidden'}}>
        {/* SIDEBAR */}
        <aside style={{width:256,background:'#1C1C1E',display:'flex',flexDirection:'column',flexShrink:0,overflowY:'auto'}}>
          <div style={{padding:'14px 12px 6px'}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:'1.2px',textTransform:'uppercase',color:'#9AA5B4',marginBottom:8}}>Customers</div>
            {customers.map(c=>{
              const isExp = !!expandedCust[c.id]
              return (
                <div key={c.id} style={{marginBottom:1}}>
                  <div onClick={()=>setExpandedCust(prev=>({...prev,[c.id]:!prev[c.id]}))}
                    style={{display:'flex',alignItems:'center',gap:6,padding:'7px 10px',borderRadius:6,cursor:'pointer',color:'rgba(255,255,255,.55)',fontSize:12}}>
                    <span style={{fontSize:10,color:'#9AA5B4',transform:isExp?'rotate(90deg)':'none',display:'inline-block',transition:'.15s'}}>▶</span>
                    <span style={{fontSize:12}}>👤</span>
                    <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.name}</span>
                    <span style={{fontSize:9,background:'rgba(255,255,255,.1)',color:'#9AA5B4',padding:'1px 5px',borderRadius:8}}>{c.projects?.length||0}</span>
                  </div>
                  {isExp && (
                    <div style={{paddingLeft:16}}>
                      {c.projects?.map((p:any)=>(
                        <div key={p.id} onClick={()=>router.push(`/admin/project/${p.id}`)}
                          style={{display:'flex',alignItems:'center',gap:5,padding:'6px 10px',borderRadius:5,cursor:'pointer',
                            color: p.id===id ? '#C9A84C' : 'rgba(255,255,255,.45)',
                            background: p.id===id ? 'rgba(201,168,76,.15)' : 'transparent',
                            fontSize:11,marginBottom:1}}>
                          <span style={{fontSize:11}}>📋</span>
                          <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}</span>
                          <span style={{fontSize:8,fontWeight:700,padding:'1px 5px',borderRadius:7,background:'rgba(201,168,76,.2)',color:'#E8C96B'}}>{p.status}</span>
                        </div>
                      ))}
                      {!c.projects?.length && <div style={{padding:'4px 10px',fontSize:10,color:'#9AA5B4'}}>No projects</div>}
                    </div>
                  )}
                </div>
              )
            })}
            {!customers.length && <div style={{fontSize:11,color:'#9AA5B4',padding:'4px 0'}}>No customers yet</div>}
          </div>
          <button onClick={()=>router.push('/admin/customers')}
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
          <div style={{display:'flex',background:'#fff',borderBottom:'2px solid #E2DDD6',padding:'0 14px',flexShrink:0}}>
            {(['sheet','purchase','summary'] as const).map(t=>(
              <div key={t} onClick={()=>setTab(t)} style={{padding:'10px 16px',fontSize:12,fontWeight:tab===t?600:500,color:tab===t?(t==='purchase'?'#7C3AED':'#1C1C1E'):'#9AA5B4',cursor:'pointer',borderBottom:`2px solid ${tab===t?(t==='purchase'?'#7C3AED':'#C9A84C'):'transparent'}`,marginBottom:-2}}>
                {t==='sheet'?'📋 Project Sheet':t==='purchase'?'🔧 My Purchase':'📊 Quote Summary'}
                {t==='purchase' && !isPushed && <span style={{width:6,height:6,background:'#F59E0B',borderRadius:'50%',display:'inline-block',marginLeft:4}}/>}
              </div>
            ))}
          </div>

          {/* SHEET TAB */}
          {tab==='sheet' && <>
            <div style={{height:42,background:'#fff',borderBottom:'1px solid #E2DDD6',display:'flex',alignItems:'center',padding:'0 10px',gap:4,flexShrink:0,overflowX:'auto'}}>
              <button onClick={addRow} style={{display:'flex',alignItems:'center',gap:3,padding:'5px 9px',border:'none',background:'#C9A84C',color:'#1C1C1E',borderRadius:5,fontSize:11,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>＋ Add Window</button>
              <button onClick={addSection} style={{display:'flex',alignItems:'center',gap:4,padding:'5px 10px',border:'1px solid #C9A84C',background:'#FFFBF0',color:'#8B6914',borderRadius:5,fontSize:11,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>📑 Add Heading / Section</button>
              <span style={{width:1,height:20,background:'#E2DDD6',margin:'0 4px'}}/>
              <button onClick={delRow} style={{display:'flex',alignItems:'center',gap:3,padding:'5px 9px',border:'none',background:'transparent',color:'#E53E3E',borderRadius:5,fontSize:11,cursor:'pointer',whiteSpace:'nowrap'}}>🗑 Delete</button>
              <button onClick={dupRow} style={{display:'flex',alignItems:'center',gap:3,padding:'5px 9px',border:'none',background:'transparent',color:'#4A5568',borderRadius:5,fontSize:11,cursor:'pointer',whiteSpace:'nowrap'}}>⎘ Duplicate</button>
              <span style={{width:1,height:20,background:'#E2DDD6',margin:'0 4px'}}/>
              <button onClick={doPush} disabled={pushing} style={{display:'flex',alignItems:'center',gap:3,padding:'5px 9px',border:'none',background:'#27AE60',color:'#fff',borderRadius:5,fontSize:11,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>{pushing?'Pushing…':'⬆ Push to Customer'}</button>
              <span style={{marginLeft:'auto',fontSize:11,color:'#8B6914',background:'#F7F4EF',border:'1px solid #E2DDD6',borderRadius:4,padding:'3px 10px',whiteSpace:'nowrap'}}>Total: <strong>{fmt(grand)}</strong></span>
            </div>
            <div className="sheet-scroll" style={{flex:1,overflow:'auto'}}>
              <table style={{borderCollapse:'collapse',minWidth:'100%',fontSize:12}}>
                <thead>
                  <tr>
                    <th style={{...th,width:34,background:'#E5E2DB',textAlign:'center'}}>#</th>
                    <th style={thCust}>Blind Type ✏</th>
                    <th style={thCust}>Control ✏</th>
                    <th style={th}>Location</th>
                    <th style={thCust}>Fabric ✏</th>
                    <th style={thCust}>Valance ✏</th>
                    <th style={thCust}>Bottom Rail ✏</th>
                    <th style={thCust}>Mount ✏</th>
                    <th style={th}>W (in)</th>
                    <th style={th}>H (in)</th>
                    <th style={th}>Qty</th>
                    <th style={th}>Sq.M</th>
                    <th style={thCust}>Remarks ✏</th>
                    <th style={th}>Blinds $</th>
                    <th style={th}>Motors $</th>
                    <th style={th}>Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r,idx) => {
                    if (r.is_section) return (
                      <tr key={r.id}><td colSpan={16} style={{background:'#2A2826',color:'rgba(255,255,255,.75)',fontSize:10,fontWeight:700,letterSpacing:'1.2px',padding:'5px 12px'}}>▸ {r.section_name}</td></tr>
                    )
                    const vi = rows.slice(0,idx).filter(x=>!x.is_section).length + 1
                    const sel = r.id===selId
                    const isLastRow = idx === rows.length - 1
                    const bq=blindsQ(r), mq=motorQ(r), lt=lineTotal(r), sq=sqm(r.width_in,r.height_in)
                    const sel_ = (field:string, val:any, opts:string[], isLast=false) => (
                      <select value={val} onChange={e=>upd(r.id,field,e.target.value)} onKeyDown={e=>handleKeyDown(e,isLast&&isLastRow)} style={{...inp,cursor:'pointer'}}>
                        {opts.map(o=><option key={o} value={o}>{o}</option>)}
                      </select>
                    )
                    const txt_ = (field:string, val:any, isLast=false) => (
                      <input type="text" value={val} onChange={e=>upd(r.id,field,e.target.value)} onKeyDown={e=>handleKeyDown(e,isLast&&isLastRow)} style={inp}/>
                    )
                    const num_ = (field:string, val:any) => (
                      <input type="number" value={val} onChange={e=>upd(r.id,field,e.target.value)} step="0.01" style={{...inp,textAlign:'center'}}/>
                    )
                    return (
                      <tr key={r.id} style={{borderBottom:'1px solid #E2DDD6',background:sel?'#FEF9EC':idx%2===0?'#fff':'#FAF8F5',cursor:'pointer'}} onClick={()=>setSelId(r.id)}>
                        <td style={{...td,width:34,textAlign:'center',fontSize:10,color:sel?'#1C1C1E':'#9AA5B4',background:sel?'#C9A84C':'#F5F2EB',borderRight:'2px solid #E2DDD6'}}>{vi}</td>
                        <td style={{...td,background:'rgba(39,174,96,.03)'}}>{sel_('blind_type',r.blind_type,products.map(p=>p.name))}</td>
                        <td style={{...td,background:'rgba(39,174,96,.03)'}}>{sel_('control',r.control,motors.map(m=>m.name))}</td>
                        <td style={td}>{txt_('location',r.location)}</td>
                        <td style={{...td,background:'rgba(39,174,96,.03)'}}>{sel_('fabric',r.fabric,FABRICS_DEFAULT)}</td>
                        <td style={{...td,background:'rgba(39,174,96,.03)'}}>{sel_('valance',r.valance,VALANCES)}</td>
                        <td style={{...td,background:'rgba(39,174,96,.03)'}}>{sel_('bottom_rail',r.bottom_rail,BRAILS)}</td>
                        <td style={{...td,background:'rgba(39,174,96,.03)'}}>{sel_('mount',r.mount,MOUNTS)}</td>
                        <td style={td}>{num_('width_in',r.width_in)}</td>
                        <td style={td}>{num_('height_in',r.height_in)}</td>
                        <td style={td}><input type="number" value={r.qty} onChange={e=>upd(r.id,'qty',parseInt(e.target.value)||1)} min={1} style={{...inp,textAlign:'center'}}/></td>
                        <td style={td}><div style={cv}>{sq>0?sq.toFixed(2):'—'}</div></td>
                        <td style={{...td,background:'rgba(39,174,96,.03)'}}>{txt_('remark',r.remark,true)}</td>
                        <td style={td}><div style={{...cv,fontWeight:500}}>{bq>0?fmt(bq):'—'}</div></td>
                        <td style={td}><div style={{...cv,fontWeight:500}}>{mq>0?fmt(mq):'—'}</div></td>
                        <td style={td}><div style={{...cv,color:'#8B6914',fontWeight:700}}>{lt>0?fmt(lt):'—'}</div></td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{borderTop:'2px solid #C9A84C',background:'#EDEBE6'}}>
                    <td style={{padding:'6px',fontWeight:700,fontSize:11,textAlign:'center'}}>Σ</td>
                    <td colSpan={12} style={{padding:'6px 10px',fontWeight:700,fontSize:11,color:'#4A5568'}}>TOTALS</td>
                    <td style={{padding:'6px',fontWeight:700,color:'#8B6914',fontSize:13}}>{fmt(totB*(1-config.discount_pct/100))}</td>
                    <td style={{padding:'6px',fontWeight:700,color:'#8B6914',fontSize:13}}>{fmt(totM*(1-config.discount_pct/100))}</td>
                    <td style={{padding:'6px',fontWeight:700,color:'#8B6914',fontSize:13}}>{fmt(sub)}</td>
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
                  <button onClick={doPush} disabled={pushing} style={{display:'flex',alignItems:'center',gap:6,background:'#27AE60',color:'#fff',border:'none',padding:'10px 18px',borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>⬆ Push to Customer Sheet</button>
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
                          <button onClick={()=>delProduct(p.id)} style={{background:'none',border:'none',color:'#E53E3E',cursor:'pointer',fontSize:12,opacity:.6}}>✕</button>
                        </div>
                        <div style={{padding:'9px 11px'}}>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                            <label style={{fontSize:10,color:'#4A5568'}}>My Cost/m²</label>
                            <input type="number" value={p.my_cost_per_sqm} step={0.5} onChange={e=>updProduct(p.id,'my_cost_per_sqm',parseFloat(e.target.value)||0)} style={{width:68,padding:'3px 6px',border:'1px solid #E2DDD6',borderRadius:4,fontSize:11,textAlign:'right'}}/>
                          </div>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                            <label style={{fontSize:10,color:'#4A5568'}}>× Factor</label>
                            <input type="number" value={p.factor} step={0.1} onChange={e=>updProduct(p.id,'factor',parseFloat(e.target.value)||0)} style={{width:68,padding:'3px 6px',border:'1px solid #E2DDD6',borderRadius:4,fontSize:11,textAlign:'right'}}/>
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
                          <button onClick={()=>delMotor(m.id)} style={{background:'none',border:'none',color:'#E53E3E',cursor:'pointer',fontSize:12,opacity:.5}}>✕</button>
                        </div>
                        <div style={{padding:'9px 11px'}}>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                            <label style={{fontSize:10,color:'#4A5568'}}>My Cost/unit</label>
                            <input type="number" value={m.my_cost_per_unit} step={1} onChange={e=>updMotor(m.id,'my_cost_per_unit',parseFloat(e.target.value)||0)} style={{width:68,padding:'3px 6px',border:'1px solid #E2DDD6',borderRadius:4,fontSize:11,textAlign:'right'}}/>
                          </div>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                            <label style={{fontSize:10,color:'#4A5568'}}>× Factor</label>
                            <input type="number" value={m.factor} step={0.1} onChange={e=>updMotor(m.id,'factor',parseFloat(e.target.value)||0)} style={{width:68,padding:'3px 6px',border:'1px solid #E2DDD6',borderRadius:4,fontSize:11,textAlign:'right'}}/>
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
        </div>
      </div>
    </div>
  )
}
