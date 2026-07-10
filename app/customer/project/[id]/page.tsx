'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

const CONV = 0.00064516
const MOUNTS = ['Inside','Outside']
const VALANCES = ['—','Standard','Deluxe','Hidden','Corniced']
const BRAILS = ['—','Standard','Weighted','Decorative']
const FABRICS_DEFAULT = ['YX2501','YX2501 + YX2509','M1001-1','Standard','Blackout','Solar 3%','Solar 5%','Natural','Custom']

type Row = { id:string; is_section:boolean; section_name?:string; blind_type:string; control:string; location:string; fabric:string; valance:string; bottom_rail:string; mount:string; width_in:number|''; height_in:number|''; qty:number; remark:string }
type Invoice = { id:string; invoice_number:string; status:string; total_amount:number|null; sequence_num:number|null; invoice_type:string|null; pct_of_total:number|null; payment_method:string|null; square_surcharge:number|null; fully_paid_at:string|null }

const statusColor: Record<string,string> = { draft:'#E8C96B', sent:'#93C5FD', viewed:'#D8B4FE', confirmed:'#5EEAD4', invoiced:'#FCD34D', completed:'#6EE7A0', cancelled:'#FCA5A5' }

export default function CustomerProjectPage() {
  const { id } = useParams()
  const router = useRouter()
  const [project, setProject] = useState<any>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [pricing, setPricing] = useState<{priceLookup:{name:string,quotePerSqm:number}[], motorLookup:{name:string,quotePerUnit:number}[], fabricQuoteLookup:{fabricCode:string,blindType:string,quotePerSqmCordless:number,quotePerSqmBeadchain:number}[]}>({priceLookup:[],motorLookup:[],fabricQuoteLookup:[]})
  const [products, setProducts] = useState<string[]>([])
  const [motors, setMotors] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [toast, setToast] = useState<{msg:string,type:'ok'|'err'}|null>(null)
  const [accepting, setAccepting] = useState(false)
  const [savingRow, setSavingRow] = useState<string|null>(null)
  const [pendingMethod, setPendingMethod] = useState<Record<string,'cash'|'square'>>({})
  const [savingInvoice, setSavingInvoice] = useState<string|null>(null)

  const showToast = (msg:string, type:'ok'|'err'='ok') => { setToast({msg,type}); setTimeout(()=>setToast(null), type==='err'?6000:3000) }

  const load = () => {
    setLoading(true)
    fetch(`/api/customer/projects/${id}`, { cache:'no-store' })
      .then(r=>{ if(!r.ok) throw new Error('not-found'); return r.json() })
      .then(d=>{
        setProject(d)
        const rawRows = (d.project_rows||[]).sort((a:any,b:any)=>a.sort_order-b.sort_order)
        setRows(rawRows)
        setInvoices(d.invoices||[])
        setPricing(d._pricing || {priceLookup:[],motorLookup:[],fabricQuoteLookup:[]})
        setProducts((d._pricing?.priceLookup||[]).map((p:any)=>p.name))
        setMotors((d._pricing?.motorLookup||[]).map((m:any)=>m.name))
        setLoadError(false)
      }).catch(()=>setLoadError(true)).finally(()=>setLoading(false))
  }
  useEffect(load, [id])

  const squareSurcharge = (base:number, method:string) => method==='square' ? Math.round((((base+0.30)/(1-0.029))-base)*100)/100 : 0
  const fmtMoney = (n:number) => '$'+Math.abs(n||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',')

  const selectPayment = async (inv:Invoice) => {
    const method = pendingMethod[inv.id] || (inv.payment_method as 'cash'|'square') || 'cash'
    setSavingInvoice(inv.id)
    try {
      const res = await fetch(`/api/customer/invoices/${inv.id}/select-payment`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ method }) })
      const text = await res.text()
      let data:any = {}
      try { data = text?JSON.parse(text):{} } catch { showToast('Server returned an unexpected response','err'); return }
      if (!res.ok) { showToast(data.error||'Could not save your selection','err'); return }
      setInvoices(prev=>prev.map(i=>i.id===inv.id?data:i))
      showToast(method==='cash' ? 'Saved — pay in cash, CEB will confirm once received' : 'Saved — pay via Square, CEB will confirm once verified','ok')
    } catch (err:any) {
      showToast('Network error: '+err.message,'err')
    } finally { setSavingInvoice(null) }
  }

  const sqm = (w:any,h:any) => parseFloat(w||0)*parseFloat(h||0)*CONV
  const fabricOptions = Array.from(new Set([...pricing.fabricQuoteLookup.map(f=>f.fabricCode), ...FABRICS_DEFAULT]))
  const blindsPrice = (r:Row) => {
    const fabQuote = pricing.fabricQuoteLookup.find(x=>x.fabricCode===r.fabric && x.blindType===r.blind_type)
    if (fabQuote) {
      const perSqm = /chain/i.test(r.control||'') ? fabQuote.quotePerSqmBeadchain : fabQuote.quotePerSqmCordless
      return Math.round(sqm(r.width_in,r.height_in)*perSqm*100)/100*(r.qty||1)
    }
    const p = pricing.priceLookup.find(x=>x.name===r.blind_type)
    return p ? Math.round(sqm(r.width_in,r.height_in)*p.quotePerSqm*100)/100*(r.qty||1) : 0
  }
  const motorPrice = (r:Row) => { const m=pricing.motorLookup.find(x=>x.name===r.control); return m ? m.quotePerUnit*(r.qty||1) : 0 }
  const fmt = (n:number) => '$'+Math.abs(n||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',')

  const dataRows = rows.filter(r=>!r.is_section)
  const cfg = project?.project_config || { tax_pct:10, shipping_pct:18, discount_pct:0, installation:500 }
  const fees = project?.project_fees || []
  const totBlind = dataRows.reduce((s,r)=>s+blindsPrice(r),0)
  const totMotor = dataRows.reduce((s,r)=>s+motorPrice(r),0)
  const sub = (totBlind+totMotor)*(1-cfg.discount_pct/100)
  const tax = sub*(cfg.tax_pct/100)
  const ship = sub*(cfg.shipping_pct/100)
  const extraTotal = fees.reduce((s:number,f:any)=>s+(f.fee_type==='pct'?sub*(f.value/100):f.value),0)
  const grand = sub+tax+ship+cfg.installation+extraTotal

  const editable = project && !['confirmed','invoiced','completed','cancelled'].includes(project.status)

  const updRowField = (rowId:string, field:string, val:string) => {
    setRows(prev=>prev.map(r=>r.id===rowId?{...r,[field]:val}:r))
  }
  const saveRowField = async (rowId:string, field:string, val:string) => {
    setSavingRow(rowId)
    try {
      const res = await fetch(`/api/customer/rows/${rowId}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ [field]: val }) })
      const text = await res.text()
      let data:any = {}
      try { data = text?JSON.parse(text):{} } catch { showToast('Server returned an unexpected response','err'); return }
      if (!res.ok) { showToast(data.error||'Could not save change','err'); return }
      showToast('Saved','ok')
    } catch (err:any) {
      showToast('Network error: '+err.message,'err')
    } finally { setSavingRow(null) }
  }

  const acceptProject = async () => {
    setAccepting(true)
    try {
      const res = await fetch(`/api/projects/${id}/accept`, { method:'POST' })
      const text = await res.text()
      let data:any = {}
      try { data = text?JSON.parse(text):{} } catch { showToast('Server returned an unexpected response','err'); return }
      if (!res.ok) { showToast(data.error||'Could not accept','err'); return }
      setProject((p:any)=>p?{...p, status:'confirmed', confirmed_at:data.confirmed_at}:p)
      showToast('Project accepted — thank you!','ok')
    } catch (err:any) {
      showToast('Network error: '+err.message,'err')
    } finally { setAccepting(false) }
  }

  if (loadError) return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',fontFamily:'Inter,sans-serif',background:'#F7F4EF',gap:14}}>
      <div style={{fontSize:40}}>⚠️</div>
      <div style={{fontSize:16,fontWeight:600,color:'#1C1C1E'}}>This project couldn't be loaded</div>
      <button onClick={()=>router.push('/customer')} style={{background:'#1C1C1E',color:'#fff',border:'none',padding:'9px 18px',borderRadius:7,fontWeight:700,fontSize:13,cursor:'pointer'}}>← My Projects</button>
    </div>
  )
  if (loading || !project) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontFamily:'Inter,sans-serif',color:'#9AA5B4'}}>Loading project…</div>

  const sel_ = (r:Row, field:string, val:string, opts:string[]) => editable ? (
    <select value={val} disabled={savingRow===r.id} onChange={e=>{updRowField(r.id,field,e.target.value); saveRowField(r.id,field,e.target.value)}}
      style={{width:'100%',border:'1px solid #E2DDD6',borderRadius:4,background:'#FFFDF7',fontFamily:'Inter,sans-serif',fontSize:11,padding:'5px 4px',cursor:'pointer'}}>
      {opts.map(o=><option key={o} value={o}>{o}</option>)}
    </select>
  ) : <span>{val||'—'}</span>

  return (
    <div style={{minHeight:'100vh',background:'#F7F4EF',fontFamily:'Inter,sans-serif'}}>
      <header style={{height:56,background:'#1C1C1E',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 20px'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <a href="/customer"><img src="/ceb-logo.jpg" alt="CEB" style={{width:30,height:30,objectFit:'contain',cursor:'pointer'}}/></a>
          <span style={{fontFamily:'Playfair Display,serif',fontSize:15,color:'#fff'}}>Custom <span style={{color:'#C9A84C'}}>Elegant</span> Blinds</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{background:statusColor[project.status]||'#E8C96B',color:'#1C1C1E',padding:'2px 10px',borderRadius:10,fontSize:10,fontWeight:700}}>{project.status?.toUpperCase()}</span>
          <a href="/customer" style={{fontSize:11,color:'rgba(255,255,255,.5)',textDecoration:'none'}}>← My Projects</a>
          <a href="/auth/logout" style={{fontSize:11,color:'rgba(255,255,255,.5)',textDecoration:'none'}}>Sign Out</a>
        </div>
      </header>
      <main style={{maxWidth:1150,margin:'0 auto',padding:'24px 20px'}}>
        <div style={{marginBottom:20}}>
          <h1 style={{fontFamily:'Playfair Display,serif',fontSize:24,marginBottom:4}}>{project.name}</h1>
          <p style={{fontSize:12,color:'#9AA5B4'}}>{project.address} · {project.email}</p>
          {!project.is_pushed && <div style={{background:'#FEF3C7',border:'1px solid rgba(245,158,11,.3)',borderRadius:7,padding:'10px 14px',fontSize:12,color:'#92400E',marginTop:12}}>⚠ Pricing is being finalized by your advisor — prices shown are estimates. Final pricing will appear after confirmation.</div>}
          {editable && project.is_pushed && (
            <div style={{background:'#F0EBFF',border:'1px solid #DDD6FE',borderRadius:7,padding:'10px 14px',fontSize:12,color:'#5B21B6',marginTop:12}}>
              ✏️ You can edit Blind Type, Control, Fabric, Valance, Bottom Rail, and Mount below. Location, dimensions, and quantity are set by CEB. When everything looks right, click <strong>Accept Project</strong>.
            </div>
          )}
          {project.confirmed_at && (
            <div style={{background:'#D1FAE5',border:'1px solid #A7F3D0',borderRadius:7,padding:'10px 14px',fontSize:12,color:'#065F46',marginTop:12}}>
              ✓ Accepted on {new Date(project.confirmed_at).toLocaleString()}
            </div>
          )}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:20,alignItems:'start'}}>
          <div style={{background:'#fff',borderRadius:10,border:'1px solid #E2DDD6',overflow:'hidden',overflowX:'auto'}}>
            <table style={{borderCollapse:'collapse',width:'100%',fontSize:12,minWidth:900}}>
              <thead>
                <tr>
                  {['#','Blind Type ✏','Control ✏','Location','Fabric ✏','Valance ✏','Bottom Rail ✏','Mount ✏','W"','H"','Qty','Sq.M','Remarks ✏','Blinds $','Motors $','Line Total'].map(h=>(
                    <th key={h} style={{background:'#EDEBE6',color:'#4A5568',fontSize:10,fontWeight:700,padding:'8px 7px',textAlign:'left',borderRight:'1px solid #E2DDD6',borderBottom:'2px solid #E2DDD6',whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r,idx)=>{
                  if (r.is_section) return (
                    <tr key={r.id}><td colSpan={16} style={{background:'#2A2826',color:'rgba(255,255,255,.75)',fontSize:10,fontWeight:700,letterSpacing:'1.2px',padding:'5px 10px'}}>▸ {r.section_name}</td></tr>
                  )
                  const vi = rows.slice(0,idx).filter(x=>!x.is_section).length + 1
                  const bp = blindsPrice(r), mp = motorPrice(r)
                  return (
                    <tr key={r.id} style={{borderBottom:'1px solid #E2DDD6',background:idx%2===0?'#fff':'#FAF8F5'}}>
                      <td style={{padding:'8px 7px',color:'#9AA5B4',fontSize:10,borderRight:'1px solid #E2DDD6'}}>{vi}</td>
                      <td style={{padding:'6px',borderRight:'1px solid #E2DDD6',background:'rgba(124,58,237,.04)'}}>{sel_(r,'blind_type',r.blind_type,products.length?products:[r.blind_type])}</td>
                      <td style={{padding:'6px',borderRight:'1px solid #E2DDD6',background:'rgba(124,58,237,.04)'}}>{sel_(r,'control',r.control,motors.length?motors:[r.control])}</td>
                      <td style={{padding:'8px 7px',borderRight:'1px solid #E2DDD6',fontSize:11}}>{r.location||'—'}</td>
                      <td style={{padding:'6px',borderRight:'1px solid #E2DDD6',background:'rgba(124,58,237,.04)'}}>{sel_(r,'fabric',r.fabric,fabricOptions)}</td>
                      <td style={{padding:'6px',borderRight:'1px solid #E2DDD6',background:'rgba(124,58,237,.04)'}}>{sel_(r,'valance',r.valance,VALANCES)}</td>
                      <td style={{padding:'6px',borderRight:'1px solid #E2DDD6',background:'rgba(124,58,237,.04)'}}>{sel_(r,'bottom_rail',r.bottom_rail,BRAILS)}</td>
                      <td style={{padding:'6px',borderRight:'1px solid #E2DDD6',background:'rgba(124,58,237,.04)'}}>{sel_(r,'mount',r.mount,MOUNTS)}</td>
                      <td style={{padding:'8px 7px',borderRight:'1px solid #E2DDD6',textAlign:'center'}}>{r.width_in||'—'}</td>
                      <td style={{padding:'8px 7px',borderRight:'1px solid #E2DDD6',textAlign:'center'}}>{r.height_in||'—'}</td>
                      <td style={{padding:'8px 7px',borderRight:'1px solid #E2DDD6',textAlign:'center'}}>{r.qty||1}</td>
                      <td style={{padding:'8px 7px',borderRight:'1px solid #E2DDD6'}}>{r.width_in&&r.height_in?sqm(r.width_in,r.height_in).toFixed(2):'—'}</td>
                      <td style={{padding:'6px',borderRight:'1px solid #E2DDD6',background:'rgba(124,58,237,.04)',fontSize:11}}>
                        {editable ? <input type="text" defaultValue={r.remark} onBlur={e=>{updRowField(r.id,'remark',e.target.value); saveRowField(r.id,'remark',e.target.value)}} style={{width:'100%',border:'1px solid #E2DDD6',borderRadius:4,padding:'5px 6px',fontSize:11,fontFamily:'Inter,sans-serif'}}/> : (r.remark||'—')}
                      </td>
                      <td style={{padding:'8px 7px',borderRight:'1px solid #E2DDD6'}}>{bp>0?fmt(bp):'—'}</td>
                      <td style={{padding:'8px 7px',borderRight:'1px solid #E2DDD6'}}>{mp>0?fmt(mp):'—'}</td>
                      <td style={{padding:'8px 7px',fontWeight:700,color:'#8B6914'}}>{(bp+mp)>0?fmt((bp+mp)*(1-cfg.discount_pct/100)):'—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div>
            <div style={{background:'#1C1C1E',borderRadius:10,padding:'16px',color:'#fff',marginBottom:12}}>
              <div style={{fontSize:10,fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',color:'#9AA5B4',marginBottom:12}}>Project Totals</div>
              {[['Items',String(dataRows.length)],['Blinds',fmt(totBlind)],['Motors',fmt(totMotor)],
                ...(cfg.discount_pct>0?[[`Discount (${cfg.discount_pct}%)`,'-'+fmt((totBlind+totMotor)*cfg.discount_pct/100)]]:[]),
                [`Tax (${cfg.tax_pct}%)`,fmt(tax)],['Shipping',fmt(ship)],['Installation',fmt(cfg.installation)],
                ...fees.map((f:any)=>[f.label,fmt(f.fee_type==='pct'?sub*(f.value/100):f.value)])
              ].map(([l,v])=>(
                <div key={l} style={{display:'flex',justifyContent:'space-between',marginBottom:7}}>
                  <span style={{fontSize:11,color:'#9AA5B4'}}>{l}</span>
                  <span style={{fontSize:11,fontWeight:700,color:'#C9A84C',fontVariantNumeric:'tabular-nums'}}>{v}</span>
                </div>
              ))}
              <div style={{borderTop:'1px solid rgba(255,255,255,.08)',paddingTop:8,marginTop:4,display:'flex',justifyContent:'space-between'}}>
                <span style={{fontSize:13,fontWeight:600,color:'rgba(255,255,255,.85)'}}>Grand Total</span>
                <span style={{fontSize:15,fontWeight:700,color:'#C9A84C',fontVariantNumeric:'tabular-nums'}}>{fmt(grand)}</span>
              </div>
            </div>
            {cfg.discount_pct > 0 && (
              <div style={{background:'#D1FAE5',borderRadius:8,padding:'10px 14px',fontSize:12,color:'#065F46',marginBottom:12}}>
                ✅ {cfg.discount_pct}% discount applied{cfg.discount_reason?` — ${cfg.discount_reason}`:''}
              </div>
            )}
            {editable && project.is_pushed && (
              <button disabled={accepting} onClick={acceptProject} style={{width:'100%',background:'linear-gradient(135deg,#8B1A1A,#C9A84C)',color:'#fff',border:'none',padding:'13px',borderRadius:9,fontSize:14,fontWeight:700,cursor:'pointer',boxShadow:'0 6px 20px rgba(139,26,26,.25)'}}>
                {accepting?'Accepting…':'✓ Accept Project'}
              </button>
            )}
          </div>
        </div>

        {invoices.length > 0 && (
          <div style={{marginTop:24}}>
            <h2 style={{fontFamily:'Playfair Display,serif',fontSize:18,marginBottom:12}}>Invoices</h2>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {invoices.map(inv=>{
                const method = pendingMethod[inv.id] || (inv.payment_method as 'cash'|'square') || 'cash'
                const base = Number(inv.total_amount||0) - Number(inv.square_surcharge||0)
                const previewSurcharge = squareSurcharge(base, method)
                const isPaid = inv.status==='paid'
                return (
                  <div key={inv.id} style={{background:'#fff',borderRadius:10,border:'1px solid #E2DDD6',padding:16}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10,flexWrap:'wrap',gap:8}}>
                      <div>
                        <div style={{fontWeight:700,fontSize:14}}>{inv.invoice_number} <span style={{fontWeight:400,color:'#9AA5B4',fontSize:12}}>({inv.invoice_type}, {inv.pct_of_total}% of total)</span></div>
                        <div style={{fontSize:12,color:'#9AA5B4'}}>{isPaid?`Paid ${inv.fully_paid_at?new Date(inv.fully_paid_at).toLocaleDateString():''}`:'Awaiting payment'}</div>
                      </div>
                      <div style={{fontSize:16,fontWeight:700,color:'#8B6914'}}>{fmtMoney(inv.total_amount||0)}</div>
                    </div>
                    {isPaid ? (
                      <div style={{background:'#D1FAE5',borderRadius:7,padding:'8px 12px',fontSize:12,color:'#065F46'}}>✓ This invoice has been paid.</div>
                    ) : (
                      <>
                        <div style={{display:'flex',gap:10,marginBottom:10,flexWrap:'wrap'}}>
                          <label style={{display:'flex',alignItems:'center',gap:6,fontSize:13,cursor:'pointer'}}>
                            <input type="radio" checked={method==='cash'} onChange={()=>setPendingMethod(p=>({...p,[inv.id]:'cash'}))}/>
                            💵 Cash
                          </label>
                          <label style={{display:'flex',alignItems:'center',gap:6,fontSize:13,cursor:'pointer'}}>
                            <input type="radio" checked={method==='square'} onChange={()=>setPendingMethod(p=>({...p,[inv.id]:'square'}))}/>
                            💳 Card (Square)
                          </label>
                        </div>
                        {method==='square' && (
                          <div style={{background:'#F0EBFF',borderRadius:7,padding:'8px 12px',fontSize:12,color:'#5B21B6',marginBottom:10}}>
                            Card payments include a processing fee (~2.9% + $0.30): total would be <strong>{fmtMoney(base+previewSurcharge)}</strong> instead of {fmtMoney(base)}.
                          </div>
                        )}
                        <button disabled={savingInvoice===inv.id} onClick={()=>selectPayment(inv)}
                          style={{background:'#1C1C1E',color:'#fff',border:'none',padding:'9px 18px',borderRadius:7,fontSize:12,fontWeight:700,cursor:'pointer'}}>
                          {savingInvoice===inv.id?'Saving…':'Save Payment Choice'}
                        </button>
                        <div style={{fontSize:10,color:'#9AA5B4',marginTop:8,lineHeight:1.5}}>
                          This records your choice for CEB — it doesn't charge you here. Pay CEB directly (cash in person, or your Square link) and they'll confirm once received.
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>

      {toast && (
        <div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',background:toast.type==='err'?'#E53E3E':'#1C1C1E',color:'#fff',padding:'10px 18px',borderRadius:8,fontSize:12,fontWeight:500,boxShadow:'0 8px 24px rgba(0,0,0,.25)',zIndex:999,borderLeft:`3px solid ${toast.type==='err'?'#fff':'#C9A84C'}`}}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
