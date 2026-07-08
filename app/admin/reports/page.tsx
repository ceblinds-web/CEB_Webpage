'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminNavLinks from '@/components/AdminNavLinks'

const PRESET_CATEGORIES = ['GAS_TRAVEL','WEB_HOSTING_SOFTWARE','TOOLS_EQUIPMENT','MISC_OVERHEAD','BLINDS_STOCK','MOTORS']

function thisYearRange() {
  const now = new Date()
  return {
    from: new Date(now.getFullYear(),0,1).toISOString().slice(0,10),
    to: new Date(now.getFullYear(),11,31).toISOString().slice(0,10),
  }
}

export default function ReportsPage() {
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const initialRange = thisYearRange()
  const [from, setFrom] = useState(initialRange.from)
  const [to, setTo] = useState(initialRange.to)
  const [activePreset, setActivePreset] = useState<'month'|'year'|'all'>('year')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{msg:string,type:'ok'|'err'}|null>(null)

  const [newExpDesc, setNewExpDesc] = useState('')
  const [newExpCost, setNewExpCost] = useState<number|''>('')
  const [newExpCat, setNewExpCat] = useState('MISC_OVERHEAD')
  const [customCatMode, setCustomCatMode] = useState(false)
  const [customCatValue, setCustomCatValue] = useState('')
  const [newExpDate, setNewExpDate] = useState(new Date().toISOString().slice(0,10))
  const [busy, setBusy] = useState(false)
  const [allCategories, setAllCategories] = useState<string[]>(PRESET_CATEGORIES)
  const [editingExpId, setEditingExpId] = useState<string|null>(null)
  const [editExpForm, setEditExpForm] = useState<{category:string,description:string,cost:number,expense_date:string}|null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string|null>(null)

  const [customers, setCustomers] = useState<any[]>([])
  const [expandedCust, setExpandedCust] = useState<Record<string,boolean>>({})

  const [viewingInvoice, setViewingInvoice] = useState<any>(null)
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set())

  const showToast = (msg:string, type:'ok'|'err'='ok') => { setToast({msg,type}); setTimeout(()=>setToast(null), type==='err'?6000:3000) }

  const load = () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    fetch(`/api/reports?${params.toString()}`, { cache:'no-store' })
      .then(r=>r.json()).then(d=>{
        setData(d)
        const catsFromExpenses = (d.expenses||[]).map((e:any)=>e.category)
        setAllCategories(prev=>Array.from(new Set([...prev, ...catsFromExpenses])))
      }).catch(()=>setData(null)).finally(()=>setLoading(false))
    fetch('/api/customers', { cache:'no-store' }).then(r=>r.json()).then(setCustomers).catch(()=>setCustomers([]))
  }
  useEffect(load, [])
  const statusColors: Record<string,{bg:string,fg:string}> = {
    draft:{bg:'#FEF3C7',fg:'#92400E'},sent:{bg:'#DBEAFE',fg:'#1E40AF'},viewed:{bg:'#EDE9FE',fg:'#5B21B6'},
    confirmed:{bg:'#CCFBF1',fg:'#0F766E'},invoiced:{bg:'#FEF3C7',fg:'#92400E'},completed:{bg:'#D1FAE5',fg:'#065F46'},cancelled:{bg:'#FEE2E2',fg:'#991B1B'}
  }

  const applyPreset = (kind:'month'|'year'|'all') => {
    setActivePreset(kind)
    const now = new Date()
    if (kind==='month') { setFrom(new Date(now.getFullYear(),now.getMonth(),1).toISOString().slice(0,10)); setTo(new Date(now.getFullYear(),now.getMonth()+1,0).toISOString().slice(0,10)) }
    else if (kind==='year') { setFrom(new Date(now.getFullYear(),0,1).toISOString().slice(0,10)); setTo(new Date(now.getFullYear(),11,31).toISOString().slice(0,10)) }
    else { setFrom(''); setTo('') }
  }
  useEffect(()=>{ load() }, [from, to])

  const fmt = (n:number) => '$'+Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})

  const addExpense = async () => {
    const category = customCatMode ? customCatValue.trim().toUpperCase().replace(/\s+/g,'_') : newExpCat
    if (!category) return showToast('Category required','err')
    if (!newExpDesc.trim() || !newExpCost) return showToast('Description and cost required','err')
    setBusy(true)
    try {
      const res = await fetch('/api/expenses', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ category, description:newExpDesc, cost:newExpCost, expense_date:newExpDate }) })
      const text = await res.text()
      let d:any = {}
      try { d = text?JSON.parse(text):{} } catch { showToast('Unexpected response, status '+res.status,'err'); return }
      if (!res.ok) { showToast(d.error||'Could not add expense','err'); return }
      setNewExpDesc(''); setNewExpCost(''); setCustomCatMode(false); setCustomCatValue('')
      load()
      showToast('Expense logged','ok')
    } catch (err:any) { showToast(err.message,'err') } finally { setBusy(false) }
  }

  const startEditExpense = (e:any) => {
    setEditingExpId(e.id)
    setEditExpForm({ category:e.category, description:e.description, cost:Number(e.cost), expense_date:e.expense_date })
  }
  const saveEditExpense = async (id:string) => {
    if (!editExpForm) return
    setBusy(true)
    try {
      const res = await fetch(`/api/expenses/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(editExpForm) })
      const text = await res.text()
      let d:any = {}
      try { d = text?JSON.parse(text):{} } catch { showToast('Unexpected response','err'); return }
      if (!res.ok) { showToast(d.error||'Could not save','err'); return }
      setEditingExpId(null); setEditExpForm(null)
      load()
      showToast('Expense updated','ok')
    } catch (err:any) { showToast(err.message,'err') } finally { setBusy(false) }
  }
  const deleteExpense = async (id:string) => {
    if (deleteConfirmId!==id) { setDeleteConfirmId(id); setTimeout(()=>setDeleteConfirmId(p=>p===id?null:p),3000); return }
    setDeleteConfirmId(null)
    try {
      const res = await fetch(`/api/expenses/${id}`, { method:'DELETE' })
      if (!res.ok) { showToast('Could not delete','err'); return }
      load()
      showToast('Expense deleted','ok')
    } catch (err:any) { showToast(err.message,'err') }
  }
  const downloadExpensesCsv = () => {
    const rows = data?.expenses || []
    const lines = [['Date','Category','Description','Cost'].join(','), ...rows.map((e:any)=>[e.expense_date,e.category,`"${(e.description||'').replace(/"/g,'""')}"`,e.cost].join(','))]
    const blob = new Blob([lines.join('\n')], { type:'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `CEB_Expenses_${from||'all'}_to_${to||'all'}.csv`; a.click()
    setTimeout(()=>URL.revokeObjectURL(url), 5000)
  }

  const toggleInvoiceSelected = (id:string) => {
    setSelectedInvoiceIds(prev=>{ const next=new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }
  const downloadSelectedInvoices = () => {
    const selected = (data?.invoices||[]).filter((i:any)=>selectedInvoiceIds.has(i.id))
    if (!selected.length) return showToast('Select at least one invoice first','err')
    const pages = selected.map((i:any)=>`
      <div style="page-break-after:always;padding:24px 0">
        <div style="display:flex;align-items:center;gap:14px;border-bottom:3px solid #8B6914;padding-bottom:10px;margin-bottom:14px">
          <img src="${window.location.origin}/ceb-logo.jpg" style="height:48px">
          <div><div style="font-family:Georgia,serif;font-size:18px;color:#8B6914;font-weight:700">Custom Elegant Blinds</div><div style="font-size:10px;color:#888">Zebra Blinds · Honey Comb · Dream Curtain</div></div>
        </div>
        <p><strong>Invoice:</strong> ${i.invoice_number} &nbsp; <strong>Status:</strong> ${String(i.status).toUpperCase()}</p>
        <p><strong>Customer:</strong> ${i.customer_name||'—'} &nbsp; <strong>Project:</strong> ${i.project_name||'—'}</p>
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:10px">
          <thead><tr><th style="background:#1C1C1E;color:#fff;padding:8px;text-align:left">Description</th><th style="background:#1C1C1E;color:#fff;padding:8px;text-align:right">%</th><th style="background:#1C1C1E;color:#fff;padding:8px;text-align:right">Amount</th></tr></thead>
          <tbody><tr><td style="padding:8px;border-bottom:1px solid #eee">${i.invoice_type||''}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${i.pct_of_total||0}%</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;font-weight:700;color:#8B6914">${fmt(i.total_amount)}</td></tr></tbody>
        </table>
      </div>`).join('')
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoices</title></head><body style="font-family:Arial,sans-serif;max-width:720px;margin:0 auto;color:#1C1C1E">
      <button onclick="window.print()" style="margin:16px 0;background:#1C1C1E;color:#fff;border:none;padding:9px 18px;border-radius:7px;font-size:13px;font-weight:700;cursor:pointer" class="no-print">🖨 Print / Save PDF</button>
      <style>@media print{.no-print{display:none}}</style>
      ${pages}
    </body></html>`
    const blob = new Blob([html], { type:'text/html' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    setTimeout(()=>URL.revokeObjectURL(url), 30000)
  }

  const KPI = ({label,value,color,hint}:{label:string,value:string,color:string,hint?:string}) => (
    <div style={{background:'#fff',borderRadius:12,padding:'16px 18px',border:'1px solid #E2DDD6',borderTop:`3px solid ${color}`}}>
      <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.6px',color:'#9AA5B4',marginBottom:8}}>{label}</div>
      <div style={{fontSize:22,fontWeight:700,color:'#1C1C1E'}}>{value}</div>
      {hint && <div style={{fontSize:10,color:'#9AA5B4',marginTop:4}}>{hint}</div>}
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:'#F7F4EF',fontFamily:'Inter,sans-serif'}}>
      <header style={{height:56,background:'#1C1C1E',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 22px'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <a href="/admin" title="Home"><img src="/ceb-logo.jpg" alt="CEB" style={{width:32,height:32,objectFit:'contain',cursor:'pointer'}}/></a>
          <span style={{fontFamily:'Playfair Display,serif',fontSize:16,color:'#fff'}}>📈 Reports</span>
        </div>
        <AdminNavLinks active="reports"/>
      </header>

      <main style={{maxWidth:1100,margin:'0 auto',padding:'24px 20px'}}>
        <div style={{display:'flex',gap:10,alignItems:'flex-end',flexWrap:'wrap',marginBottom:8,background:'#fff',border:'1px solid #E2DDD6',borderRadius:10,padding:14}}>
          <div><label style={{display:'block',fontSize:10,fontWeight:700,color:'#4A5568',marginBottom:3}}>From</label><input type="date" value={from} onChange={e=>{setFrom(e.target.value);setActivePreset('month')}} style={{padding:'6px 8px',border:'1px solid #E2DDD6',borderRadius:5,fontSize:12}}/></div>
          <div><label style={{display:'block',fontSize:10,fontWeight:700,color:'#4A5568',marginBottom:3}}>To</label><input type="date" value={to} onChange={e=>{setTo(e.target.value);setActivePreset('month')}} style={{padding:'6px 8px',border:'1px solid #E2DDD6',borderRadius:5,fontSize:12}}/></div>
          <button onClick={()=>applyPreset('month')} style={{padding:'7px 12px',border:`1px solid ${activePreset==='month'?'#C9A84C':'#E2DDD6'}`,borderRadius:5,background:activePreset==='month'?'#FFFBF0':'#fff',fontSize:11,cursor:'pointer',fontWeight:activePreset==='month'?700:400}}>This Month</button>
          <button onClick={()=>applyPreset('year')} style={{padding:'7px 12px',border:`1px solid ${activePreset==='year'?'#C9A84C':'#E2DDD6'}`,borderRadius:5,background:activePreset==='year'?'#FFFBF0':'#fff',fontSize:11,cursor:'pointer',fontWeight:activePreset==='year'?700:400}}>This Year</button>
          <button onClick={()=>applyPreset('all')} style={{padding:'7px 12px',border:`1px solid ${activePreset==='all'?'#C9A84C':'#E2DDD6'}`,borderRadius:5,background:activePreset==='all'?'#FFFBF0':'#fff',fontSize:11,cursor:'pointer',fontWeight:activePreset==='all'?700:400}}>All Time</button>
        </div>
        <div style={{fontSize:11,color:'#9AA5B4',marginBottom:18,paddingLeft:2}}>
          Showing: {activePreset==='all' ? 'All time' : `${from} to ${to}`} {activePreset==='year' && '(current calendar year — matches CEB\'s fiscal year, Jan 1–Dec 31)'}
        </div>

        {loading && <div style={{textAlign:'center',color:'#9AA5B4',padding:40}}>Loading…</div>}

        {data && !loading && <>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:22}}>
            <KPI label="Pipeline (Draft / Unconfirmed)" value={fmt(data.pipelineTotal)} color="#C9A84C" hint="Open quotes not yet invoiced"/>
            <KPI label="Collected in Period" value={fmt(data.totalCollected)} color="#27AE60"/>
            <KPI label="Cost of Goods (Period)" value={fmt(data.cogsInPeriod)} color="#E53E3E" hint="What you paid suppliers for goods sold"/>
            <KPI label="Tax Collected (est.)" value={fmt(data.taxCollected)} color="#7C3AED" hint="Pass-through, not profit"/>
            <KPI label="Shipping Collected (est.)" value={fmt(data.shippingCollected)} color="#0D9488" hint="Pass-through, not profit"/>
            <KPI label="Discounts Given" value={fmt(data.totalDiscounts)} color="#F59E0B"/>
            <KPI label="Op. Expenses" value={fmt(data.totalExpenses)} color="#4A5568"/>
            <KPI label="Gross Margin Collected" value={fmt(data.grossMarginCollected)} color="#27AE60" hint="Goods revenue minus goods cost"/>
            <KPI label="Net Profit" value={fmt(data.netProfit)} color={data.netProfit>=0?'#27AE60':'#E53E3E'} hint="Gross margin minus op. expenses"/>
          </div>

          <div style={{background:'#fff',borderRadius:12,border:'1px solid #E2DDD6',padding:18,marginBottom:18}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <div style={{fontWeight:700,fontSize:14}}>Operational Expenses</div>
              <button onClick={downloadExpensesCsv} style={{background:'#fff',border:'1px solid #E2DDD6',padding:'6px 12px',borderRadius:6,fontSize:11,cursor:'pointer'}}>⬇ Download CSV</button>
            </div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'flex-end',marginBottom:14,background:'#F7F4EF',padding:12,borderRadius:8}}>
              <div>
                <label style={{display:'block',fontSize:10,fontWeight:700,color:'#4A5568',marginBottom:3}}>Category</label>
                {customCatMode ? (
                  <div style={{display:'flex',gap:4}}>
                    <input value={customCatValue} onChange={e=>setCustomCatValue(e.target.value)} placeholder="NEW_CATEGORY" style={{padding:'6px 8px',border:'1px solid #C9A84C',borderRadius:5,fontSize:12,width:130}}/>
                    <button onClick={()=>{setCustomCatMode(false);setCustomCatValue('')}} style={{padding:'6px 8px',border:'1px solid #E2DDD6',borderRadius:5,background:'#fff',fontSize:11,cursor:'pointer'}}>✕</button>
                  </div>
                ) : (
                  <select value={newExpCat} onChange={e=>{ if(e.target.value==='__custom__'){setCustomCatMode(true)} else setNewExpCat(e.target.value) }} style={{padding:'6px 8px',border:'1px solid #E2DDD6',borderRadius:5,fontSize:12}}>
                    {allCategories.map(c=><option key={c} value={c}>{c}</option>)}
                    <option value="__custom__">＋ New category…</option>
                  </select>
                )}
              </div>
              <div><label style={{display:'block',fontSize:10,fontWeight:700,color:'#4A5568',marginBottom:3}}>Description</label><input value={newExpDesc} onChange={e=>setNewExpDesc(e.target.value)} style={{padding:'6px 8px',border:'1px solid #E2DDD6',borderRadius:5,fontSize:12,width:180}}/></div>
              <div><label style={{display:'block',fontSize:10,fontWeight:700,color:'#4A5568',marginBottom:3}}>Cost</label><input type="number" value={newExpCost} onChange={e=>setNewExpCost(parseFloat(e.target.value)||'')} style={{padding:'6px 8px',border:'1px solid #E2DDD6',borderRadius:5,fontSize:12,width:90}}/></div>
              <div><label style={{display:'block',fontSize:10,fontWeight:700,color:'#4A5568',marginBottom:3}}>Date</label><input type="date" value={newExpDate} onChange={e=>setNewExpDate(e.target.value)} style={{padding:'6px 8px',border:'1px solid #E2DDD6',borderRadius:5,fontSize:12}}/></div>
              <button disabled={busy} onClick={addExpense} style={{background:'#1C1C1E',color:'#fff',border:'none',padding:'8px 16px',borderRadius:6,fontSize:12,fontWeight:700,cursor:'pointer'}}>＋ Log Expense</button>
            </div>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead><tr style={{borderBottom:'2px solid #E2DDD6',textAlign:'left'}}>
                <th style={{padding:'0 0 6px',fontSize:10,color:'#4A5568'}}>Date</th><th style={{padding:'0 0 6px',fontSize:10,color:'#4A5568'}}>Category</th>
                <th style={{padding:'0 0 6px',fontSize:10,color:'#4A5568'}}>Description</th><th style={{padding:'0 0 6px',fontSize:10,color:'#4A5568',textAlign:'right'}}>Cost</th>
                <th style={{padding:'0 0 6px',fontSize:10,color:'#4A5568'}}></th>
              </tr></thead>
              <tbody>
                {(data.expenses||[]).length===0 && <tr><td colSpan={5} style={{padding:14,color:'#9AA5B4',textAlign:'center'}}>No expenses in this period</td></tr>}
                {(data.expenses||[]).map((e:any)=> editingExpId===e.id ? (
                  <tr key={e.id} style={{borderBottom:'1px solid #F0EDE8',background:'#FFFBF0'}}>
                    <td style={{padding:'7px 0'}}><input type="date" value={editExpForm?.expense_date} onChange={ev=>setEditExpForm(p=>p?{...p,expense_date:ev.target.value}:p)} style={{fontSize:11,padding:'3px 5px',border:'1px solid #E2DDD6',borderRadius:4}}/></td>
                    <td style={{padding:'7px 0'}}><input value={editExpForm?.category} onChange={ev=>setEditExpForm(p=>p?{...p,category:ev.target.value}:p)} style={{fontSize:11,padding:'3px 5px',border:'1px solid #E2DDD6',borderRadius:4,width:100}}/></td>
                    <td style={{padding:'7px 0'}}><input value={editExpForm?.description} onChange={ev=>setEditExpForm(p=>p?{...p,description:ev.target.value}:p)} style={{fontSize:11,padding:'3px 5px',border:'1px solid #E2DDD6',borderRadius:4,width:150}}/></td>
                    <td style={{padding:'7px 0',textAlign:'right'}}><input type="number" value={editExpForm?.cost} onChange={ev=>setEditExpForm(p=>p?{...p,cost:parseFloat(ev.target.value)||0}:p)} style={{fontSize:11,padding:'3px 5px',border:'1px solid #E2DDD6',borderRadius:4,width:70,textAlign:'right'}}/></td>
                    <td style={{padding:'7px 0',textAlign:'right',whiteSpace:'nowrap'}}>
                      <button disabled={busy} onClick={()=>saveEditExpense(e.id)} style={{fontSize:10,background:'#27AE60',color:'#fff',border:'none',padding:'4px 8px',borderRadius:4,cursor:'pointer',marginRight:4}}>Save</button>
                      <button onClick={()=>{setEditingExpId(null);setEditExpForm(null)}} style={{fontSize:10,background:'#fff',border:'1px solid #E2DDD6',padding:'4px 8px',borderRadius:4,cursor:'pointer'}}>Cancel</button>
                    </td>
                  </tr>
                ) : (
                  <tr key={e.id} style={{borderBottom:'1px solid #F0EDE8'}}>
                    <td style={{padding:'7px 0'}}>{e.expense_date}</td><td style={{padding:'7px 0'}}>{e.category}</td>
                    <td style={{padding:'7px 0'}}>{e.description}</td><td style={{padding:'7px 0',textAlign:'right',color:'#E53E3E'}}>{fmt(e.cost)}</td>
                    <td style={{padding:'7px 0',textAlign:'right',whiteSpace:'nowrap'}}>
                      <button onClick={()=>startEditExpense(e)} style={{fontSize:10,background:'#fff',border:'1px solid #E2DDD6',padding:'4px 8px',borderRadius:4,cursor:'pointer',marginRight:4}}>Edit</button>
                      <button onClick={()=>deleteExpense(e.id)} style={{fontSize:10,background:deleteConfirmId===e.id?'#E53E3E':'#fff',color:deleteConfirmId===e.id?'#fff':'#E53E3E',border:'1px solid #FECACA',padding:'4px 8px',borderRadius:4,cursor:'pointer'}}>{deleteConfirmId===e.id?'Confirm?':'Delete'}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{background:'#fff',borderRadius:12,border:'1px solid #E2DDD6',padding:18,marginBottom:18}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <div style={{fontWeight:700,fontSize:14}}>All Invoices</div>
              <button disabled={!selectedInvoiceIds.size} onClick={downloadSelectedInvoices} style={{background:selectedInvoiceIds.size?'#1C1C1E':'#F0EBE6',color:selectedInvoiceIds.size?'#fff':'#9AA5B4',border:'none',padding:'6px 14px',borderRadius:6,fontSize:11,fontWeight:700,cursor:selectedInvoiceIds.size?'pointer':'default'}}>⬇ Download Selected ({selectedInvoiceIds.size})</button>
            </div>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead><tr style={{borderBottom:'2px solid #E2DDD6',textAlign:'left'}}>
                <th style={{padding:'0 0 6px',width:24}}></th>
                <th style={{padding:'0 0 6px',fontSize:10,color:'#4A5568'}}>Invoice #</th><th style={{padding:'0 0 6px',fontSize:10,color:'#4A5568'}}>Customer</th>
                <th style={{padding:'0 0 6px',fontSize:10,color:'#4A5568'}}>Project</th><th style={{padding:'0 0 6px',fontSize:10,color:'#4A5568',textAlign:'right'}}>Amount</th>
                <th style={{padding:'0 0 6px',fontSize:10,color:'#4A5568'}}>Status</th><th style={{padding:'0 0 6px'}}></th>
              </tr></thead>
              <tbody>
                {(data.invoices||[]).map((i:any)=>(
                  <tr key={i.id} style={{borderBottom:'1px solid #F0EDE8'}}>
                    <td style={{padding:'7px 0'}}><input type="checkbox" checked={selectedInvoiceIds.has(i.id)} onChange={()=>toggleInvoiceSelected(i.id)}/></td>
                    <td style={{padding:'7px 0'}}>{i.invoice_number}</td><td style={{padding:'7px 0'}}>{i.customer_name}</td>
                    <td style={{padding:'7px 0'}}>{i.project_name}</td><td style={{padding:'7px 0',textAlign:'right',fontWeight:700,color:'#8B6914'}}>{fmt(i.total_amount)}</td>
                    <td style={{padding:'7px 0'}}><span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:8,background:i.status==='paid'?'#D1FAE5':'#FEF3C7',color:i.status==='paid'?'#065F46':'#92400E'}}>{i.status}</span></td>
                    <td style={{padding:'7px 0',textAlign:'right'}}><button onClick={()=>setViewingInvoice(i)} style={{fontSize:10,background:'#fff',border:'1px solid #E2DDD6',padding:'4px 10px',borderRadius:5,cursor:'pointer'}}>View</button></td>
                  </tr>
                ))}
                {!(data.invoices||[]).length && <tr><td colSpan={7} style={{padding:14,color:'#9AA5B4',textAlign:'center'}}>No invoices yet</td></tr>}
              </tbody>
            </table>
          </div>

          <div style={{background:'#fff',borderRadius:12,border:'1px solid #E2DDD6',padding:18,marginBottom:18}}>
            <div style={{fontWeight:700,fontSize:14,marginBottom:10}}>Discount Log</div>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead><tr style={{borderBottom:'2px solid #E2DDD6',textAlign:'left'}}>
                <th style={{padding:'0 0 6px',fontSize:10,color:'#4A5568'}}>Date</th><th style={{padding:'0 0 6px',fontSize:10,color:'#4A5568'}}>Discount %</th>
                <th style={{padding:'0 0 6px',fontSize:10,color:'#4A5568',textAlign:'right'}}>Amount Saved</th><th style={{padding:'0 0 6px',fontSize:10,color:'#4A5568'}}>Reason</th>
              </tr></thead>
              <tbody>
                {(data.discountLog||[]).length===0 && <tr><td colSpan={4} style={{padding:14,color:'#9AA5B4',textAlign:'center'}}>No discounts in this period</td></tr>}
                {(data.discountLog||[]).map((d:any)=>(
                  <tr key={d.id} style={{borderBottom:'1px solid #F0EDE8'}}>
                    <td style={{padding:'7px 0'}}>{d.applied_at?.slice(0,10)}</td><td style={{padding:'7px 0',color:'#27AE60',fontWeight:700}}>{d.discount_pct}%</td>
                    <td style={{padding:'7px 0',textAlign:'right',color:'#27AE60'}}>{fmt(d.amount_saved)}</td><td style={{padding:'7px 0'}}>{d.reason||'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{background:'#fff',borderRadius:12,border:'1px solid #E2DDD6',padding:18}}>
            <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>All Customers &amp; Projects</div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {customers.map(c=>{
                const isExpC = !!expandedCust[c.id]
                return (
                  <div key={c.id} style={{background:'#F7F4EF',borderRadius:10,border:'1px solid #E2DDD6',overflow:'hidden'}}>
                    <div onClick={()=>setExpandedCust(p=>({...p,[c.id]:!p[c.id]}))}
                      style={{display:'flex',alignItems:'center',gap:10,padding:'12px 16px',cursor:'pointer',background:isExpC?'#F0EBFF':'#fff'}}>
                      <span style={{fontSize:10,color:'#9AA5B4',transform:isExpC?'rotate(90deg)':'none',display:'inline-block',transition:'.15s'}}>▶</span>
                      <span style={{fontSize:16}}>👤</span>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:700,fontSize:13}}>{c.name}</div>
                        <div style={{fontSize:11,color:'#9AA5B4'}}>{c.email} · {c.projects?.length||0} project(s)</div>
                      </div>
                      <span style={{fontSize:10,fontWeight:700,padding:'3px 9px',borderRadius:10,background:c.status==='active'?'#D1FAE5':'#FEF3C7',color:c.status==='active'?'#065F46':'#92400E'}}>{c.status}</span>
                    </div>
                    {isExpC && (c.projects||[]).map((p:any)=>(
                      <div key={p.id} onClick={()=>router.push(`/admin/project/${p.id}`)}
                        style={{display:'flex',alignItems:'center',gap:8,padding:'9px 16px 9px 42px',borderTop:'1px solid #E2DDD6',cursor:'pointer',background:'#fff',fontSize:12}}>
                        <span>📋</span>
                        <span style={{flex:1}}>{p.name}</span>
                        <span style={{fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:8,background:statusColors[p.status]?.bg||'#F0EBE6',color:statusColors[p.status]?.fg||'#4A5568'}}>{p.status}</span>
                      </div>
                    ))}
                    {isExpC && !c.projects?.length && (
                      <div style={{padding:'9px 16px 9px 42px',fontSize:11,color:'#9AA5B4',background:'#fff',borderTop:'1px solid #E2DDD6'}}>No projects yet</div>
                    )}
                  </div>
                )
              })}
              {!customers.length && <div style={{fontSize:12,color:'#9AA5B4',padding:10}}>No customers yet</div>}
            </div>
          </div>
        </>}
      </main>

      {viewingInvoice && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:998}} onClick={()=>setViewingInvoice(null)}>
          <div style={{background:'#fff',borderRadius:12,padding:24,width:440,maxWidth:'90vw',boxShadow:'0 24px 64px rgba(0,0,0,.25)'}} onClick={e=>e.stopPropagation()}>
            <div style={{fontFamily:'Playfair Display,serif',fontSize:17,marginBottom:4}}>{viewingInvoice.invoice_number}</div>
            <div style={{fontSize:12,color:'#9AA5B4',marginBottom:16}}>{viewingInvoice.invoice_type} · {viewingInvoice.pct_of_total}% of project total</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,fontSize:12,marginBottom:16}}>
              <div><div style={{color:'#9AA5B4',fontSize:10,textTransform:'uppercase'}}>Customer</div><div>{viewingInvoice.customer_name||'—'}</div></div>
              <div><div style={{color:'#9AA5B4',fontSize:10,textTransform:'uppercase'}}>Project</div><div>{viewingInvoice.project_name||'—'}</div></div>
              <div><div style={{color:'#9AA5B4',fontSize:10,textTransform:'uppercase'}}>Payment Method</div><div>{viewingInvoice.payment_method==='square'?'💳 Square':'💵 Cash'}</div></div>
              <div><div style={{color:'#9AA5B4',fontSize:10,textTransform:'uppercase'}}>Status</div><span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:8,background:viewingInvoice.status==='paid'?'#D1FAE5':'#FEF3C7',color:viewingInvoice.status==='paid'?'#065F46':'#92400E'}}>{viewingInvoice.status}</span></div>
            </div>
            <div style={{background:'#F7F4EF',borderRadius:8,padding:'12px 14px',fontSize:16,fontWeight:700,color:'#8B6914',marginBottom:16}}>{fmt(viewingInvoice.total_amount)}</div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={()=>router.push(`/admin/project/${viewingInvoice.project_id}`)} style={{background:'#fff',border:'1px solid #E2DDD6',padding:'8px 16px',borderRadius:6,fontSize:12,cursor:'pointer'}}>Open Full Project →</button>
              <button onClick={()=>setViewingInvoice(null)} style={{background:'#1C1C1E',color:'#fff',border:'none',padding:'8px 16px',borderRadius:6,fontSize:12,fontWeight:700,cursor:'pointer'}}>Close</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',background:toast.type==='err'?'#E53E3E':'#1C1C1E',color:'#fff',padding:'10px 18px',borderRadius:8,fontSize:12,fontWeight:500,boxShadow:'0 8px 24px rgba(0,0,0,.25)',zIndex:999,borderLeft:`3px solid ${toast.type==='err'?'#fff':'#C9A84C'}`}}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
