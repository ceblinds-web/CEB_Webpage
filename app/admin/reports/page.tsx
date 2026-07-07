'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminNavLinks from '@/components/AdminNavLinks'

export default function ReportsPage() {
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [newExpDesc, setNewExpDesc] = useState('')
  const [newExpCost, setNewExpCost] = useState<number|''>('')
  const [newExpCat, setNewExpCat] = useState('MISC_OVERHEAD')
  const [newExpDate, setNewExpDate] = useState(new Date().toISOString().slice(0,10))
  const [busy, setBusy] = useState(false)
  const [customers, setCustomers] = useState<any[]>([])
  const [expandedCust, setExpandedCust] = useState<Record<string,boolean>>({})
  const [expandedProj, setExpandedProj] = useState<Record<string,boolean>>({})

  const load = () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    fetch(`/api/reports?${params.toString()}`, { cache:'no-store' })
      .then(r=>r.json()).then(setData).catch(()=>setData(null)).finally(()=>setLoading(false))
    fetch('/api/customers', { cache:'no-store' }).then(r=>r.json()).then(setCustomers).catch(()=>setCustomers([]))
  }
  useEffect(load, [])
  const statusColors: Record<string,{bg:string,fg:string}> = {
    draft:{bg:'#FEF3C7',fg:'#92400E'},sent:{bg:'#DBEAFE',fg:'#1E40AF'},viewed:{bg:'#EDE9FE',fg:'#5B21B6'},
    confirmed:{bg:'#CCFBF1',fg:'#0F766E'},invoiced:{bg:'#FEF3C7',fg:'#92400E'},completed:{bg:'#D1FAE5',fg:'#065F46'},cancelled:{bg:'#FEE2E2',fg:'#991B1B'}
  }

  const applyPreset = (kind:'month'|'year'|'all') => {
    const now = new Date()
    if (kind==='month') { setFrom(new Date(now.getFullYear(),now.getMonth(),1).toISOString().slice(0,10)); setTo(new Date(now.getFullYear(),now.getMonth()+1,0).toISOString().slice(0,10)) }
    else if (kind==='year') { setFrom(new Date(now.getFullYear(),0,1).toISOString().slice(0,10)); setTo(new Date(now.getFullYear(),11,31).toISOString().slice(0,10)) }
    else { setFrom(''); setTo('') }
  }
  useEffect(()=>{ load() }, [from, to])

  const fmt = (n:number) => '$'+Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})

  const addExpense = async () => {
    if (!newExpDesc.trim() || !newExpCost) return alert('Description and cost required')
    setBusy(true)
    try {
      const res = await fetch('/api/expenses', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ category:newExpCat, description:newExpDesc, cost:newExpCost, expense_date:newExpDate }) })
      const text = await res.text()
      let d:any = {}
      try { d = text?JSON.parse(text):{} } catch { alert('❌ Unexpected response, status '+res.status); return }
      if (!res.ok) { alert('❌ '+(d.error||'Could not add expense')); return }
      setNewExpDesc(''); setNewExpCost('')
      load()
    } catch (err:any) { alert('❌ '+err.message) } finally { setBusy(false) }
  }

  const KPI = ({label,value,color}:{label:string,value:string,color:string}) => (
    <div style={{background:'#fff',borderRadius:12,padding:'16px 18px',border:'1px solid #E2DDD6',borderTop:`3px solid ${color}`}}>
      <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.6px',color:'#9AA5B4',marginBottom:8}}>{label}</div>
      <div style={{fontSize:22,fontWeight:700,color:'#1C1C1E'}}>{value}</div>
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
        <div style={{display:'flex',gap:10,alignItems:'flex-end',flexWrap:'wrap',marginBottom:18,background:'#fff',border:'1px solid #E2DDD6',borderRadius:10,padding:14}}>
          <div><label style={{display:'block',fontSize:10,fontWeight:700,color:'#4A5568',marginBottom:3}}>From</label><input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={{padding:'6px 8px',border:'1px solid #E2DDD6',borderRadius:5,fontSize:12}}/></div>
          <div><label style={{display:'block',fontSize:10,fontWeight:700,color:'#4A5568',marginBottom:3}}>To</label><input type="date" value={to} onChange={e=>setTo(e.target.value)} style={{padding:'6px 8px',border:'1px solid #E2DDD6',borderRadius:5,fontSize:12}}/></div>
          <button onClick={()=>applyPreset('month')} style={{padding:'7px 12px',border:'1px solid #E2DDD6',borderRadius:5,background:'#fff',fontSize:11,cursor:'pointer'}}>This Month</button>
          <button onClick={()=>applyPreset('year')} style={{padding:'7px 12px',border:'1px solid #E2DDD6',borderRadius:5,background:'#fff',fontSize:11,cursor:'pointer'}}>This Year</button>
          <button onClick={()=>applyPreset('all')} style={{padding:'7px 12px',border:'1px solid #E2DDD6',borderRadius:5,background:'#fff',fontSize:11,cursor:'pointer'}}>All Time</button>
        </div>

        {loading && <div style={{textAlign:'center',color:'#9AA5B4',padding:40}}>Loading…</div>}

        {data && !loading && <>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:22}}>
            <KPI label="Total Quoted (Pipeline)" value={fmt(data.totalQuoted)} color="#C9A84C"/>
            <KPI label="Collected in Period" value={fmt(data.totalCollected)} color="#27AE60"/>
            <KPI label="Tax Collected in Period (est.)" value={fmt(data.taxCollected)} color="#7C3AED"/>
            <KPI label="Discounts Given in Period" value={fmt(data.totalDiscounts)} color="#E53E3E"/>
            <KPI label="Op. Expenses in Period" value={fmt(data.totalExpenses)} color="#4A5568"/>
            <KPI label="Net Profit in Period" value={fmt(data.netProfit)} color="#27AE60"/>
          </div>

          <div style={{background:'#fff',borderRadius:12,border:'1px solid #E2DDD6',padding:18,marginBottom:18}}>
            <div style={{fontWeight:700,fontSize:14,marginBottom:10}}>Operational Expenses</div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'flex-end',marginBottom:14,background:'#F7F4EF',padding:12,borderRadius:8}}>
              <div><label style={{display:'block',fontSize:10,fontWeight:700,color:'#4A5568',marginBottom:3}}>Category</label>
                <select value={newExpCat} onChange={e=>setNewExpCat(e.target.value)} style={{padding:'6px 8px',border:'1px solid #E2DDD6',borderRadius:5,fontSize:12}}>
                  {['GAS_TRAVEL','WEB_HOSTING_SOFTWARE','TOOLS_EQUIPMENT','MISC_OVERHEAD','BLINDS_STOCK','MOTORS'].map(c=><option key={c} value={c}>{c}</option>)}
                </select>
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
              </tr></thead>
              <tbody>
                {(data.expenses||[]).length===0 && <tr><td colSpan={4} style={{padding:14,color:'#9AA5B4',textAlign:'center'}}>No expenses in this period</td></tr>}
                {(data.expenses||[]).map((e:any)=>(
                  <tr key={e.id} style={{borderBottom:'1px solid #F0EDE8'}}>
                    <td style={{padding:'7px 0'}}>{e.expense_date}</td><td style={{padding:'7px 0'}}>{e.category}</td>
                    <td style={{padding:'7px 0'}}>{e.description}</td><td style={{padding:'7px 0',textAlign:'right',color:'#E53E3E'}}>{fmt(e.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{background:'#fff',borderRadius:12,border:'1px solid #E2DDD6',padding:18,marginBottom:18}}>
            <div style={{fontWeight:700,fontSize:14,marginBottom:10}}>All Invoices</div>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead><tr style={{borderBottom:'2px solid #E2DDD6',textAlign:'left'}}>
                <th style={{padding:'0 0 6px',fontSize:10,color:'#4A5568'}}>Invoice #</th><th style={{padding:'0 0 6px',fontSize:10,color:'#4A5568'}}>Customer</th>
                <th style={{padding:'0 0 6px',fontSize:10,color:'#4A5568'}}>Project</th><th style={{padding:'0 0 6px',fontSize:10,color:'#4A5568',textAlign:'right'}}>Amount</th>
                <th style={{padding:'0 0 6px',fontSize:10,color:'#4A5568'}}>Status</th>
              </tr></thead>
              <tbody>
                {(data.invoices||[]).map((i:any)=>(
                  <tr key={i.id} style={{borderBottom:'1px solid #F0EDE8',cursor:'pointer'}} onClick={()=>router.push(`/admin/project/${i.project_id}`)}>
                    <td style={{padding:'7px 0'}}>{i.invoice_number}</td><td style={{padding:'7px 0'}}>{i.customer_name}</td>
                    <td style={{padding:'7px 0'}}>{i.project_name}</td><td style={{padding:'7px 0',textAlign:'right',fontWeight:700,color:'#8B6914'}}>{fmt(i.total_amount)}</td>
                    <td style={{padding:'7px 0'}}><span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:8,background:i.status==='paid'?'#D1FAE5':'#FEF3C7',color:i.status==='paid'?'#065F46':'#92400E'}}>{i.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{background:'#fff',borderRadius:12,border:'1px solid #E2DDD6',padding:18}}>
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
    </div>
  )
}
