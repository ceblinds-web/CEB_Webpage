'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

type Tab = 'invoice'|'payments'|'grievances'|'email'

export default function ProjectAdminPage() {
  const { id } = useParams()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('invoice')
  const [project, setProject] = useState<any>(null)
  const [invoice, setInvoice] = useState<any>(null)
  const [grievances, setGrievances] = useState<any[]>([])
  const [emailForm, setEmailForm] = useState({to:'',subject:'',body:''})
  const [grievForm, setGrievForm] = useState({title:'',description:''})
  const [depositPct, setDepositPct] = useState(30)
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState<string|null>(null)

  const load = async () => {
    const [projRes, invRes, grievRes] = await Promise.all([
      fetch(`/api/projects/${id}`, {cache:'no-store'}),
      fetch(`/api/invoices?projectId=${id}`, {cache:'no-store'}),
      fetch(`/api/grievances?projectId=${id}`, {cache:'no-store'}),
    ])
    if (!projRes.ok) return
    const proj = await projRes.json()
    const invData = await invRes.json()
    const grievData = await grievRes.json()
    setProject(proj)
    setDepositPct(proj.deposit_pct || 30)
    if (invData.length) setInvoice(invData[0])
    setGrievances(grievData)
    setEmailForm(f => ({ ...f, to: proj.email || '' }))
  }
  useEffect(() => { load() }, [id])

  const grandTotal = project?.grand_total || 0
  const depositAmt = grandTotal * (depositPct / 100)
  const balanceAmt = grandTotal - depositAmt

  const fmt = (n: number) => '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

  const generateInvoice = async () => {
    if (!grandTotal) return alert('Push pricing first so the project total is saved, then generate the invoice.')
    const res = await fetch('/api/invoices', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ project_id:id, total_amount:grandTotal, deposit_pct:depositPct })
    })
    const inv = await res.json()
    setInvoice(inv)
    await fetch('/api/payments', {
      method: 'PATCH', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ project_id:id, deposit_pct:depositPct })
    })
    load()
  }

  const printInvoice = (type: 'deposit'|'full') => {
    if (!invoice || !project) return
    const total = invoice.total_amount || 0
    const dep = total * (depositPct / 100)
    const bal = total - dep
    const today = new Date(invoice.created_at).toLocaleDateString('en-US', {year:'numeric',month:'long',day:'numeric'})
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<!DOCTYPE html><html><head><title>Invoice ${invoice.invoice_number}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Helvetica Neue',Arial,sans-serif;color:#1C1C1E;background:#fff;padding:48px;max-width:760px;margin:0 auto}
.top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px;padding-bottom:20px;border-bottom:3px solid #C9A84C}
.logo{display:flex;align-items:center;gap:14px}
.logo-box{width:56px;height:56px;background:#1C1C1E;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:26px}
.co h1{font-family:Georgia,serif;font-size:22px;color:#1C1C1E;margin-bottom:2px}
.co p{font-size:11px;color:#9AA5B4;line-height:1.6}
.inv-badge{text-align:right}
.inv-num{font-family:Georgia,serif;font-size:22px;font-weight:700;color:#8B6914}
.inv-date{font-size:11px;color:#9AA5B4;margin-top:4px}
.badge{display:inline-block;margin-top:8px;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;background:${invoice.status==='paid'?'#D1FAE5':'#FEF3C7'};color:${invoice.status==='paid'?'#065F46':'#92400E'}}
.parties{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:36px}
.party-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9AA5B4;margin-bottom:8px}
.party-name{font-size:15px;font-weight:700;margin-bottom:4px}
.party-detail{font-size:12px;color:#4A5568;line-height:1.7}
table{width:100%;border-collapse:collapse;margin-bottom:24px}
thead tr{background:#1C1C1E}
thead th{color:#fff;padding:10px 14px;text-align:left;font-size:12px;font-weight:600}
tbody tr{border-bottom:1px solid #E2DDD6}
tbody td{padding:12px 14px;font-size:13px}
.right{text-align:right;font-variant-numeric:tabular-nums}
.totals{margin-left:auto;width:300px}
.trow{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #E2DDD6;font-size:13px}
.trow.grand{border-bottom:none;border-top:2px solid #C9A84C;padding-top:12px;font-weight:700;font-size:16px;color:#8B6914}
.due-box{margin-top:24px;padding:18px 20px;background:#FFFBF0;border:1px solid rgba(201,168,76,.35);border-radius:10px}
.due-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#8B6914;margin-bottom:6px}
.due-amount{font-size:28px;font-weight:700;color:#8B6914;font-variant-numeric:tabular-nums}
.due-sub{font-size:12px;color:#9AA5B4;margin-top:4px}
.footer{margin-top:48px;padding-top:16px;border-top:1px solid #E2DDD6;font-size:10px;color:#9AA5B4;text-align:center;line-height:1.8}
@media print{body{padding:24px}}
</style></head><body>
<div class="top">
  <div class="logo">
    <div class="logo-box">🪟</div>
    <div class="co">
      <h1>Custom Elegant Blinds</h1>
      <p>ceblinds.click<br>Edmonds, WA, USA</p>
    </div>
  </div>
  <div class="inv-badge">
    <div class="inv-num">INVOICE</div>
    <div class="inv-num" style="font-size:16px">${invoice.invoice_number}</div>
    <div class="inv-date">Date: ${today}</div>
    <span class="badge">${invoice.status?.toUpperCase()}</span>
  </div>
</div>

<div class="parties">
  <div>
    <div class="party-label">From</div>
    <div class="party-name">Custom Elegant Blinds LLC</div>
    <div class="party-detail">ceblinds.click<br>Edmonds, WA, USA<br>admin@ceblinds.click</div>
  </div>
  <div>
    <div class="party-label">Bill To</div>
    <div class="party-name">${project.customers?.name || project.email}</div>
    <div class="party-detail">${project.email}<br>${project.phone ? project.phone + '<br>' : ''}${project.address || ''}</div>
  </div>
</div>

<table>
  <thead><tr><th>Description</th><th>Project</th><th class="right">Amount</th></tr></thead>
  <tbody>
    <tr><td>Window Treatment — Supply &amp; Install</td><td>${project.name}</td><td class="right">${fmt(total)}</td></tr>
    ${project.address ? `<tr><td colspan="2" style="font-size:11px;color:#9AA5B4">Property: ${project.address}</td><td></td></tr>` : ''}
  </tbody>
</table>

<div class="totals">
  <div class="trow"><span>Subtotal</span><span>${fmt(total)}</span></div>
  ${type === 'deposit' ? `<div class="trow"><span>Balance on Completion</span><span style="color:#9AA5B4">- ${fmt(bal)}</span></div>` : ''}
  <div class="trow grand"><span>${type === 'deposit' ? `Deposit Due (${depositPct}%)` : 'Total Amount Due'}</span><span>${fmt(type === 'deposit' ? dep : total)}</span></div>
</div>

<div class="due-box">
  <div class="due-title">${type === 'deposit' ? `Deposit Required — ${depositPct}%` : 'Total Payment Due'}</div>
  <div class="due-amount">${fmt(type === 'deposit' ? dep : total)}</div>
  ${type === 'deposit' ? `<div class="due-sub">Remaining balance of ${fmt(bal)} is due upon completion of installation</div>` : ''}
</div>

<div class="footer">
  Custom Elegant Blinds LLC &nbsp;·&nbsp; ceblinds.click &nbsp;·&nbsp; Edmonds, WA<br>
  Thank you for choosing Custom Elegant Blinds. This is a computer-generated invoice.
</div>
</body></html>`)
    w.document.close()
    w.print()
  }

  const updatePayment = async (field: string, value: any) => {
    await fetch('/api/payments', { method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ project_id:id, [field]:value }) })
    load()
  }

  const addGrievance = async () => {
    if (!grievForm.title.trim()) return alert('Enter a title')
    await fetch('/api/grievances', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ project_id:id, ...grievForm }) })
    setGrievForm({title:'',description:''})
    load()
  }

  const updateGrievStatus = async (gid: string, status: string) => {
    await fetch(`/api/grievances/${gid}`, { method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ status }) })
    load()
  }

  const uploadPhoto = async (gid: string, file: File) => {
    setUploading(gid)
    const fd = new FormData(); fd.append('file', file); fd.append('grievanceId', gid)
    await fetch('/api/grievances/photos', { method:'POST', body:fd })
    setUploading(null); load()
  }

  const sendEmail = async () => {
    if (!emailForm.to || !emailForm.subject || !emailForm.body) return alert('Fill in To, Subject and Message')
    setSending(true)
    await fetch('/api/email/send-custom', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ projectId:id, ...emailForm }) })
    setSending(false)
    alert('✅ Email sent and logged!')
    setEmailForm(f => ({...f, subject:'', body:''}))
  }

  if (!project) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontFamily:'Inter,sans-serif',color:'#9AA5B4'}}>
      Loading…
    </div>
  )

  const inp: React.CSSProperties = {width:'100%',padding:'9px 11px',border:'1px solid #E2DDD6',borderRadius:7,fontSize:13,outline:'none',fontFamily:'Inter,sans-serif',boxSizing:'border-box'}
  const card: React.CSSProperties = {background:'#fff',borderRadius:12,border:'1px solid #E2DDD6',padding:22,marginBottom:18}
  const tabs: {v:Tab;icon:string;label:string}[] = [
    {v:'invoice',icon:'🧾',label:'Invoice'},
    {v:'payments',icon:'💳',label:'Payments'},
    {v:'grievances',icon:'📷',label:'Grievances'},
    {v:'email',icon:'📧',label:'Send Email'},
  ]

  return (
    <div style={{display:'flex',height:'100vh',fontFamily:'Inter,sans-serif',background:'#F7F4EF'}}>
      {/* SIDEBAR */}
      <aside style={{width:230,background:'#1C1C1E',display:'flex',flexDirection:'column',flexShrink:0}}>
        {/* Logo + back nav */}
        <div style={{padding:'16px 14px',borderBottom:'1px solid rgba(255,255,255,.08)'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
            <div style={{width:28,height:28,background:'#C9A84C',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13}}>🪟</div>
            <span style={{fontFamily:'Playfair Display,serif',fontSize:13,color:'#fff'}}>CEB Admin</span>
          </div>
          <a href="/admin" style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'#C9A84C',textDecoration:'none',padding:'6px 8px',borderRadius:6,background:'rgba(201,168,76,.1)',marginBottom:4}}>
            🏠 Home
          </a>
          <a href="/admin/home" style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'rgba(255,255,255,.6)',textDecoration:'none',padding:'6px 8px',borderRadius:6}}>
            📋 Project Home
          </a>
          <a href="/admin/panel" style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'rgba(255,255,255,.6)',textDecoration:'none',padding:'6px 8px',borderRadius:6}}>
            ← All Projects
          </a>
        </div>

        {/* Project info */}
        <div style={{padding:'12px 14px',borderBottom:'1px solid rgba(255,255,255,.08)',background:'rgba(201,168,76,.06)'}}>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',color:'#C9A84C',marginBottom:6}}>Current Project</div>
          <div style={{fontWeight:700,fontSize:13,color:'#fff',marginBottom:2}}>{project.name}</div>
          <div style={{fontSize:11,color:'#9AA5B4'}}>{project.customers?.name}</div>
          <div style={{fontSize:10,color:'#9AA5B4',marginTop:2}}>{project.email}</div>
          {grandTotal > 0 && (
            <div style={{marginTop:8,padding:'6px 8px',background:'rgba(201,168,76,.12)',borderRadius:6}}>
              <div style={{fontSize:9,color:'#9AA5B4',textTransform:'uppercase',letterSpacing:'.5px'}}>Project Total</div>
              <div style={{fontSize:16,fontWeight:700,color:'#C9A84C'}}>{fmt(grandTotal)}</div>
            </div>
          )}
        </div>

        {/* Tab nav */}
        <div style={{padding:'10px 10px',flex:1}}>
          {tabs.map(t => (
            <button key={t.v} onClick={() => setTab(t.v)} style={{
              display:'flex',alignItems:'center',gap:9,padding:'10px 12px',border:'none',
              borderRadius:7,cursor:'pointer',width:'100%',textAlign:'left',marginBottom:3,
              fontFamily:'Inter,sans-serif',fontWeight:tab===t.v?700:400,fontSize:12,
              background:tab===t.v?'#7C3AED':'transparent',
              color:tab===t.v?'#fff':'rgba(255,255,255,.55)',
            }}>
              {t.icon} {t.label}
            </button>
          ))}
          <div style={{marginTop:12,paddingTop:12,borderTop:'1px solid rgba(255,255,255,.07)'}}>
            <a href={`/admin/project/${id}`} style={{display:'flex',alignItems:'center',gap:6,fontSize:11,color:'#C9A84C',textDecoration:'none',padding:'7px 10px',borderRadius:6,border:'1px solid rgba(201,168,76,.2)'}}>
              📋 Open Spreadsheet →
            </a>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <header style={{height:52,background:'#fff',borderBottom:'1px solid #E2DDD6',display:'flex',alignItems:'center',padding:'0 24px',gap:10,flexShrink:0}}>
          <span style={{fontWeight:700,fontSize:15}}>{project.name}</span>
          <span style={{fontSize:12,color:'#9AA5B4'}}>— {project.customers?.name}</span>
          <span style={{marginLeft:'auto',fontSize:10,fontWeight:700,padding:'3px 9px',borderRadius:10,background:'#EDE9FF',color:'#7C3AED'}}>{project.status}</span>
          {grandTotal > 0 && <span style={{fontSize:12,fontWeight:700,color:'#8B6914'}}>{fmt(grandTotal)}</span>}
        </header>

        <div style={{flex:1,overflow:'auto',padding:24}}>
          <div style={{maxWidth:700}}>

            {/* INVOICE */}
            {tab==='invoice' && (<>
              <div style={{fontFamily:'Playfair Display,serif',fontSize:22,marginBottom:4}}>Invoice</div>
              <p style={{fontSize:12,color:'#9AA5B4',marginBottom:20}}>Generate, manage, and print the project invoice</p>

              {!grandTotal && (
                <div style={{background:'#FEF3C7',border:'1px solid rgba(245,158,11,.3)',borderRadius:8,padding:'12px 16px',fontSize:12,color:'#92400E',marginBottom:16}}>
                  ⚠ No project total found. Go to the <a href={`/admin/project/${id}`} style={{color:'#8B6914',fontWeight:700}}>Project Spreadsheet</a>, set your pricing in My Purchase, then click <strong>⬆ Push to Customer</strong> to save the total. Then come back here to generate the invoice.
                </div>
              )}

              {!invoice ? (
                <div style={card}>
                  <div style={{fontWeight:700,fontSize:14,marginBottom:16}}>Generate Invoice</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:20}}>
                    {[['Project Total',grandTotal?fmt(grandTotal):'Not set','#8B6914'],
                      [`Deposit (${depositPct}%)`,grandTotal?fmt(depositAmt):'—','#C9A84C'],
                      ['Balance on Completion',grandTotal?fmt(balanceAmt):'—','#7C3AED']
                    ].map(([l,v,c])=>(
                      <div key={l as string} style={{background:'#F7F4EF',borderRadius:8,padding:'12px 14px'}}>
                        <div style={{fontSize:10,color:'#9AA5B4',marginBottom:4}}>{l}</div>
                        <div style={{fontSize:16,fontWeight:700,color:c as string}}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{marginBottom:16}}>
                    <label style={{fontSize:11,fontWeight:700,color:'#4A5568',display:'block',marginBottom:6}}>Deposit % Required</label>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <input type="number" value={depositPct} step={5} min={0} max={100}
                        onChange={e=>setDepositPct(parseFloat(e.target.value)||0)}
                        style={{width:80,padding:'8px 10px',border:'1px solid #E2DDD6',borderRadius:6,fontSize:16,textAlign:'center',fontWeight:700}}/>
                      <span style={{fontSize:13,color:'#4A5568'}}>% upfront</span>
                    </div>
                  </div>
                  <button onClick={generateInvoice} disabled={!grandTotal}
                    style={{background:grandTotal?'#C9A84C':'#E2DDD6',color:grandTotal?'#1C1C1E':'#9AA5B4',border:'none',padding:'10px 22px',borderRadius:8,fontWeight:700,fontSize:13,cursor:grandTotal?'pointer':'not-allowed'}}>
                    Generate Invoice
                  </button>
                </div>
              ) : (
                <div style={card}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20}}>
                    <div>
                      <div style={{fontSize:20,fontWeight:700,color:'#8B6914',fontFamily:'Playfair Display,serif'}}>{invoice.invoice_number}</div>
                      <div style={{fontSize:11,color:'#9AA5B4',marginTop:2}}>Generated {new Date(invoice.created_at).toLocaleDateString()}</div>
                    </div>
                    <span style={{fontSize:11,fontWeight:700,padding:'4px 12px',borderRadius:10,background:invoice.status==='paid'?'#D1FAE5':'#FEF3C7',color:invoice.status==='paid'?'#065F46':'#92400E'}}>{invoice.status}</span>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:20}}>
                    {[['Project Total',fmt(invoice.total_amount||0),'#1C1C1E'],
                      [`Deposit (${depositPct}%)`,fmt(depositAmt),'#C9A84C'],
                      ['Balance Due',fmt(balanceAmt),'#7C3AED']
                    ].map(([l,v,c])=>(
                      <div key={l as string} style={{background:'#F7F4EF',borderRadius:8,padding:'12px 14px'}}>
                        <div style={{fontSize:10,color:'#9AA5B4',marginBottom:4}}>{l}</div>
                        <div style={{fontSize:18,fontWeight:700,color:c as string}}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{marginBottom:18}}>
                    <label style={{fontSize:11,fontWeight:700,color:'#4A5568',display:'block',marginBottom:6}}>Deposit %</label>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <input type="number" value={depositPct} step={5} min={0} max={100}
                        onChange={e=>setDepositPct(parseFloat(e.target.value)||0)}
                        style={{width:80,padding:'7px 10px',border:'1px solid #E2DDD6',borderRadius:6,fontSize:14,textAlign:'center',fontWeight:700}}/>
                      <button onClick={async()=>{
                        await fetch(`/api/invoices/${invoice.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({deposit_pct:depositPct,deposit_amount:invoice.total_amount*(depositPct/100)})})
                        await fetch('/api/payments',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({project_id:id,deposit_pct:depositPct})})
                        load()
                      }} style={{background:'#F7F4EF',border:'1px solid #E2DDD6',padding:'7px 14px',borderRadius:6,fontSize:12,cursor:'pointer',fontWeight:600}}>
                        Update
                      </button>
                    </div>
                  </div>
                  <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                    <button onClick={()=>printInvoice('deposit')} style={{background:'#C9A84C',color:'#1C1C1E',border:'none',padding:'9px 18px',borderRadius:7,fontWeight:700,fontSize:12,cursor:'pointer'}}>🖨 Deposit Invoice ({depositPct}%)</button>
                    <button onClick={()=>printInvoice('full')} style={{background:'#1C1C1E',color:'#fff',border:'none',padding:'9px 18px',borderRadius:7,fontWeight:700,fontSize:12,cursor:'pointer'}}>🖨 Full Invoice</button>
                  </div>
                </div>
              )}
            </>)}

            {/* PAYMENTS */}
            {tab==='payments' && (<>
              <div style={{fontFamily:'Playfair Display,serif',fontSize:22,marginBottom:4}}>Payment Status</div>
              <p style={{fontSize:12,color:'#9AA5B4',marginBottom:20}}>{project.name} — {project.customers?.name}</p>
              <div style={card}>
                <div style={{marginBottom:20}}>
                  <label style={{fontSize:11,fontWeight:700,color:'#4A5568',display:'block',marginBottom:8}}>Deposit % Required</label>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <input type="number" value={depositPct} step={5} min={0} max={100}
                      onChange={e=>setDepositPct(parseFloat(e.target.value)||0)}
                      style={{width:80,padding:'8px 10px',border:'1px solid #E2DDD6',borderRadius:6,fontSize:16,textAlign:'center',fontWeight:700}}/>
                    <span style={{fontSize:13,color:'#4A5568'}}>%</span>
                    <button onClick={()=>updatePayment('deposit_pct',depositPct)} style={{background:'#F7F4EF',border:'1px solid #E2DDD6',padding:'7px 14px',borderRadius:6,fontSize:12,cursor:'pointer',fontWeight:600}}>Save</button>
                    {grandTotal>0 && <span style={{fontSize:12,color:'#8B6914',fontWeight:600}}>{fmt(depositAmt)} upfront · {fmt(balanceAmt)} on completion</span>}
                  </div>
                </div>
                {[
                  {key:'deposit_paid',label:'Deposit Received',paidAt:project.deposit_paid_at,paid:project.deposit_paid,amt:grandTotal?fmt(depositAmt):'—'},
                  {key:'full_payment_paid',label:'Full Payment Received',paidAt:project.full_payment_paid_at,paid:project.full_payment_paid,amt:grandTotal?fmt(grandTotal):'—'},
                ].map(row=>(
                  <div key={row.key} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 0',borderTop:'1px solid #E2DDD6'}}>
                    <div>
                      <div style={{fontWeight:600,fontSize:14}}>{row.label}</div>
                      <div style={{fontSize:12,color:'#9AA5B4',marginTop:3}}>{row.amt}{row.paidAt?' · Paid '+new Date(row.paidAt).toLocaleDateString():''}</div>
                    </div>
                    <button onClick={()=>updatePayment(row.key,!row.paid)}
                      style={{background:row.paid?'#27AE60':'#E2DDD6',color:row.paid?'#fff':'#4A5568',border:'none',padding:'9px 20px',borderRadius:20,fontSize:12,fontWeight:700,cursor:'pointer',transition:'all .2s',minWidth:110}}>
                      {row.paid?'✓ Paid':'Mark Paid'}
                    </button>
                  </div>
                ))}
              </div>
            </>)}

            {/* GRIEVANCES */}
            {tab==='grievances' && (<>
              <div style={{fontFamily:'Playfair Display,serif',fontSize:22,marginBottom:4}}>Grievances & Photos</div>
              <p style={{fontSize:12,color:'#9AA5B4',marginBottom:20}}>Log issues, attach site photos, track resolution</p>
              <div style={card}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:12}}>＋ Log New Issue</div>
                <input placeholder="Title — e.g. Wrong fabric color, measurement issue" value={grievForm.title}
                  onChange={e=>setGrievForm(f=>({...f,title:e.target.value}))} style={{...inp,marginBottom:10}}/>
                <textarea placeholder="Description / details…" value={grievForm.description}
                  onChange={e=>setGrievForm(f=>({...f,description:e.target.value}))}
                  style={{...inp,minHeight:80,marginBottom:12,resize:'vertical'}}/>
                <button onClick={addGrievance} style={{background:'#E53E3E',color:'#fff',border:'none',padding:'8px 18px',borderRadius:7,fontSize:12,fontWeight:700,cursor:'pointer'}}>
                  Log Issue
                </button>
              </div>
              {grievances.length===0 ? (
                <div style={{textAlign:'center',padding:28,color:'#9AA5B4',background:'#fff',borderRadius:12,border:'1px solid #E2DDD6',fontSize:12}}>No issues logged for this project yet</div>
              ) : grievances.map((g:any)=>(
                <div key={g.id} style={{...card,marginBottom:12}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                    <div style={{flex:1,marginRight:12}}>
                      <div style={{fontWeight:700,fontSize:14}}>{g.title}</div>
                      {g.description && <div style={{fontSize:12,color:'#4A5568',marginTop:4,lineHeight:1.6}}>{g.description}</div>}
                      <div style={{fontSize:10,color:'#9AA5B4',marginTop:5}}>{new Date(g.created_at).toLocaleDateString()}</div>
                    </div>
                    <select value={g.status} onChange={e=>updateGrievStatus(g.id,e.target.value)}
                      style={{fontSize:11,fontWeight:700,padding:'5px 10px',borderRadius:8,border:'1px solid #E2DDD6',cursor:'pointer',
                        background:g.status==='resolved'?'#D1FAE5':g.status==='in_progress'?'#FEF3C7':'#FEE2E2',
                        color:g.status==='resolved'?'#065F46':g.status==='in_progress'?'#92400E':'#991B1B'}}>
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>
                  {g.grievance_photos?.length > 0 && (
                    <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:10}}>
                      {g.grievance_photos.map((ph:any)=>(
                        <a key={ph.id} href={ph.photo_url} target="_blank" rel="noreferrer">
                          <img src={ph.photo_url} alt="" style={{width:80,height:80,objectFit:'cover',borderRadius:8,border:'1px solid #E2DDD6'}}/>
                        </a>
                      ))}
                    </div>
                  )}
                  <label style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:11,color:'#7C3AED',cursor:'pointer',padding:'6px 12px',border:'1px solid #EDE9FF',borderRadius:7,background:'#F5F0FF',fontWeight:600}}>
                    📷 {uploading===g.id?'Uploading…':'Attach Photo'}
                    <input type="file" accept="image/*" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)uploadPhoto(g.id,f);e.target.value=''}}/>
                  </label>
                </div>
              ))}
            </>)}

            {/* EMAIL */}
            {tab==='email' && (<>
              <div style={{fontFamily:'Playfair Display,serif',fontSize:22,marginBottom:4}}>Send Email</div>
              <p style={{fontSize:12,color:'#9AA5B4',marginBottom:20}}>Send a direct message about this project to {project.customers?.name}</p>
              <div style={card}>
                <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
                  <button onClick={()=>{
                    if(!invoice) return alert('Generate an invoice first')
                    setEmailForm({
                      to:project.email,
                      subject:`Invoice ${invoice.invoice_number} — ${project.name}`,
                      body:`Dear ${project.customers?.name||'Customer'},\n\nThank you for choosing Custom Elegant Blinds.\n\nPlease find below your invoice details for ${project.name}:\n\nInvoice Number: ${invoice.invoice_number}\nProject Total: ${fmt(invoice.total_amount||0)}\nDeposit Required (${depositPct}%): ${fmt(depositAmt)}\nBalance on Completion: ${fmt(balanceAmt)}\n\nPlease confirm your order and arrange the deposit payment to get started.\n\nBest regards,\nCustom Elegant Blinds\nceblinds.click`
                    })
                  }} style={{background:'#FEF9EC',border:'1px solid rgba(201,168,76,.35)',color:'#8B6914',padding:'7px 14px',borderRadius:7,fontSize:11,cursor:'pointer',fontWeight:700}}>
                    📋 Invoice Template
                  </button>
                  <button onClick={()=>setEmailForm({
                    to:project.email,
                    subject:`Update on ${project.name}`,
                    body:`Dear ${project.customers?.name||'Customer'},\n\nI'm reaching out regarding your ${project.name} project.\n\n\n\nBest regards,\nCustom Elegant Blinds\nceblinds.click`
                  })} style={{background:'#F5F0FF',border:'1px solid rgba(124,58,237,.25)',color:'#7C3AED',padding:'7px 14px',borderRadius:7,fontSize:11,cursor:'pointer',fontWeight:700}}>
                    💬 General Update
                  </button>
                </div>
                <label style={{fontSize:11,fontWeight:700,color:'#4A5568',display:'block',marginBottom:5}}>To</label>
                <input value={emailForm.to} onChange={e=>setEmailForm(f=>({...f,to:e.target.value}))} style={{...inp,marginBottom:12}}/>
                <label style={{fontSize:11,fontWeight:700,color:'#4A5568',display:'block',marginBottom:5}}>Subject</label>
                <input value={emailForm.subject} onChange={e=>setEmailForm(f=>({...f,subject:e.target.value}))} style={{...inp,marginBottom:12}}/>
                <label style={{fontSize:11,fontWeight:700,color:'#4A5568',display:'block',marginBottom:5}}>Message</label>
                <textarea value={emailForm.body} onChange={e=>setEmailForm(f=>({...f,body:e.target.value}))}
                  style={{...inp,minHeight:180,resize:'vertical',marginBottom:16}}/>
                <button onClick={sendEmail} disabled={sending}
                  style={{background:'#7C3AED',color:'#fff',border:'none',padding:'10px 24px',borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer'}}>
                  {sending?'Sending…':'📧 Send Email'}
                </button>
              </div>
            </>)}

          </div>
        </div>
      </div>
    </div>
  )
}
