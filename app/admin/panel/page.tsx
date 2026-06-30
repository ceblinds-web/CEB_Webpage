'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminPanel() {
  const router = useRouter()
  const [customers, setCustomers] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [expandedCust, setExpandedCust] = useState<Record<string,boolean>>({})
  const [expandedProj, setExpandedProj] = useState<Record<string,boolean>>({})

  useEffect(()=>{
    fetch('/api/customers',{cache:'no-store'}).then(r=>r.json()).then(d=>{
      setCustomers(d)
      const exp: Record<string,boolean> = {}
      d.forEach((c:any)=>{exp[c.id]=true})
      setExpandedCust(exp)
    })
    fetch('/api/invoices',{cache:'no-store'}).then(r=>r.json()).then(setInvoices).catch(()=>[])
  },[])

  const fmt = (n:number) => '$'+n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',')
  const allProjs = customers.flatMap(c=>(c.projects||[]).map((p:any)=>({...p,customerName:c.name})))
  const depPaid = allProjs.filter(p=>p.deposit_paid).length
  const fullyPaid = allProjs.filter(p=>p.full_payment_paid).length
  const getInvoice = (projId:string) => invoices.find(i=>i.project_id===projId)

  const statusColors: Record<string,{bg:string,fg:string}> = {
    draft:{bg:'#FEF3C7',fg:'#92400E'},sent:{bg:'#DBEAFE',fg:'#1E40AF'},viewed:{bg:'#EDE9FE',fg:'#5B21B6'},
    confirmed:{bg:'#CCFBF1',fg:'#0F766E'},invoiced:{bg:'#FEF3C7',fg:'#92400E'},completed:{bg:'#D1FAE5',fg:'#065F46'},cancelled:{bg:'#FEE2E2',fg:'#991B1B'}
  }

  return (
    <div style={{minHeight:'100vh',background:'#F7F4EF',fontFamily:'Inter,sans-serif'}}>
      <header style={{height:56,background:'#1C1C1E',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 22px'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:30,height:30,background:'#C9A84C',borderRadius:7,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>🪟</div>
          <span style={{fontFamily:'Playfair Display,serif',fontSize:16,color:'#fff'}}>🛡 CEB_Admin Panel</span>
        </div>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <a href="/admin/home" style={{fontSize:12,color:'#C9A84C',textDecoration:'none',padding:'5px 12px',border:'1px solid rgba(201,168,76,.3)',borderRadius:6,background:'rgba(201,168,76,.08)'}}>📋 Project Home</a>
          <a href="/admin" style={{fontSize:12,color:'rgba(255,255,255,.5)',textDecoration:'none',padding:'5px 12px',border:'1px solid rgba(255,255,255,.15)',borderRadius:6}}>🏠 Home</a>
        </div>
      </header>
      <main style={{maxWidth:1000,margin:'0 auto',padding:'28px 20px'}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:28}}>
          {[['Total Projects',allProjs.length,'#C9A84C'],['Deposit Paid',depPaid,'#27AE60'],['Fully Paid',fullyPaid,'#7C3AED'],['Awaiting Deposit',allProjs.length-depPaid,'#E53E3E']].map(([l,v,c]:any)=>(
            <div key={l} style={{background:'#fff',borderRadius:12,padding:'18px 20px',border:'1px solid #E2DDD6',borderTop:`3px solid ${c}`}}>
              <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.6px',color:'#9AA5B4',marginBottom:8}}>{l}</div>
              <div style={{fontSize:28,fontWeight:700}}>{v}</div>
            </div>
          ))}
        </div>
        {invoices.length>0&&(
          <div style={{background:'#fff',borderRadius:12,border:'1px solid #E2DDD6',padding:20,marginBottom:24}}>
            <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>All Invoices</div>
            {invoices.map(inv=>(
              <div key={inv.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:'#F7F4EF',borderRadius:8,marginBottom:6}}>
                <span>🧾</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,fontSize:13}}>{inv.invoice_number}</div>
                  <div style={{fontSize:11,color:'#9AA5B4'}}>{inv.projects?.customers?.name} — {inv.projects?.name}</div>
                </div>
                <div style={{fontSize:13,fontWeight:700,color:'#8B6914'}}>{fmt(inv.total_amount||0)}</div>
                <span style={{fontSize:10,fontWeight:700,padding:'3px 8px',borderRadius:8,background:inv.status==='paid'?'#D1FAE5':'#FEF3C7',color:inv.status==='paid'?'#065F46':'#92400E'}}>{inv.status}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{fontSize:13,fontWeight:700,marginBottom:12,color:'#4A5568'}}>All Customers & Projects</div>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {customers.map(c=>{
            const isExpC=!!expandedCust[c.id]
            return (
              <div key={c.id} style={{background:'#fff',borderRadius:12,border:'1px solid #E2DDD6',overflow:'hidden'}}>
                <div onClick={()=>setExpandedCust(p=>({...p,[c.id]:!p[c.id]}))}
                  style={{display:'flex',alignItems:'center',gap:12,padding:'14px 18px',cursor:'pointer',background:isExpC?'#F8F5FF':'#fff'}}>
                  <span style={{fontSize:11,color:'#9AA5B4',transform:isExpC?'rotate(90deg)':'none',display:'inline-block',transition:'.15s'}}>▶</span>
                  <span style={{fontSize:18}}>👤</span>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:14}}>{c.name}</div>
                    <div style={{fontSize:11,color:'#9AA5B4'}}>{c.email} · {c.projects?.length||0} project(s)</div>
                  </div>
                  <span style={{fontSize:10,fontWeight:700,padding:'3px 9px',borderRadius:10,background:c.status==='active'?'#D1FAE5':'#FEF3C7',color:c.status==='active'?'#065F46':'#92400E'}}>{c.status}</span>
                </div>
                {isExpC&&(c.projects||[]).map((p:any)=>{
                  const isExpP=!!expandedProj[p.id]
                  const inv=getInvoice(p.id)
                  const dep=(inv?.total_amount||0)*((p.deposit_pct||30)/100)
                  return (
                    <div key={p.id} style={{borderTop:'1px solid #E2DDD6'}}>
                      <div onClick={()=>setExpandedProj(prev=>({...prev,[p.id]:!prev[p.id]}))}
                        style={{display:'flex',alignItems:'center',gap:10,padding:'11px 18px 11px 46px',cursor:'pointer',background:isExpP?'#EDE9FF':'#FAFAFA'}}>
                        <span style={{fontSize:10,color:'#9AA5B4',transform:isExpP?'rotate(90deg)':'none',display:'inline-block',transition:'.15s'}}>▶</span>
                        <span>📋</span>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:600,fontSize:13}}>{p.name}</div>
                          <div style={{fontSize:10,color:'#9AA5B4'}}>{p.address||p.email}</div>
                        </div>
                        <span style={{fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:8,background:statusColors[p.status]?.bg||'#F0EBE6',color:statusColors[p.status]?.fg||'#4A5568'}}>{p.status}</span>
                        <span style={{fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:8,background:p.deposit_paid?'#D1FAE5':'#FEE2E2',color:p.deposit_paid?'#065F46':'#991B1B'}}>{p.deposit_pct||30}% {p.deposit_paid?'✓':'pending'}</span>
                        <button onClick={e=>{e.stopPropagation();router.push(`/admin/panel/project/${p.id}`)}}
                          style={{background:'#7C3AED',color:'#fff',border:'none',padding:'5px 12px',borderRadius:6,fontSize:11,fontWeight:700,cursor:'pointer'}}>
                          Manage →
                        </button>
                      </div>
                      {isExpP&&(
                        <div style={{padding:'14px 18px 14px 66px',background:'#F5F0FF',borderTop:'1px solid #EDE9FF'}}>
                          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:12}}>
                            {[['Project Total',p.grand_total?fmt(parseFloat(p.grand_total)):'Not pushed','#8B6914'],['Invoice',inv?inv.invoice_number:'Not generated','#7C3AED'],['Deposit',inv?fmt(dep)+(p.deposit_paid?' ✓':'  pending'):'—',p.deposit_paid?'#27AE60':'#E53E3E']].map(([l,v,c])=>(
                              <div key={l as string} style={{background:'#fff',borderRadius:8,padding:'10px 12px'}}>
                                <div style={{fontSize:9,color:'#9AA5B4',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:4}}>{l}</div>
                                <div style={{fontSize:13,fontWeight:700,color:c as string}}>{v}</div>
                              </div>
                            ))}
                          </div>
                          <div style={{display:'flex',gap:8}}>
                            <a href={`/admin/project/${p.id}`} style={{fontSize:11,color:'#7C3AED',textDecoration:'none',padding:'6px 12px',border:'1px solid #EDE9FF',borderRadius:6,background:'#fff',fontWeight:600}}>📋 Spreadsheet</a>
                            <a href={`/admin/panel/project/${p.id}`} style={{fontSize:11,color:'#fff',textDecoration:'none',padding:'6px 12px',borderRadius:6,background:'#7C3AED',fontWeight:600,marginLeft:0}}>🛡 Invoice & Payments</a>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
                {isExpC&&!c.projects?.length&&(
                  <div style={{padding:'10px 18px 10px 46px',fontSize:11,color:'#9AA5B4',background:'#FAFAFA',borderTop:'1px solid #E2DDD6'}}>No projects yet</div>
                )}
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
