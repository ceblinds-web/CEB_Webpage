import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'

export default async function CustomerProjectPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/auth/login')

  const { data: project } = await supabase
    .from('projects')
    .select(`*, project_rows(*), project_config(*), project_fees(*)`)
    .eq('id', params.id).single()

  if (!project) redirect('/customer')

  // Mark as viewed if first time
  if (project.status === 'sent') {
    await supabase.from('projects').update({ status: 'viewed', viewed_at: new Date().toISOString() }).eq('id', params.id)
  }

  const rows = (project.project_rows || []).sort((a: any, b: any) => a.sort_order - b.sort_order)
  const cfg = project.project_config || { tax_pct:10, shipping_pct:18, discount_pct:0, installation:500 }
  const fees = project.project_fees || []

  const CONV = 0.00064516
  const sqm = (w: any, h: any) => parseFloat(w||0) * parseFloat(h||0) * CONV
  const fmt = (n: number) => '$' + Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const dataRows = rows.filter((r: any) => !r.is_section)
  // Use simple pricing approximation for customer view (actual pricing is pushed by admin)
  const totBlind = dataRows.reduce((s: number, r: any) => s + (r.width_in && r.height_in ? Math.round(sqm(r.width_in, r.height_in) * 16 * 5 * 100) / 100 * (r.qty||1) : 0), 0)
  const totMotor = 0
  const sub = (totBlind + totMotor) * (1 - cfg.discount_pct / 100)
  const tax = sub * (cfg.tax_pct / 100)
  const ship = sub * (cfg.shipping_pct / 100)
  const extraTotal = fees.reduce((s: number, f: any) => s + (f.fee_type === 'pct' ? sub * (f.value / 100) : f.value), 0)
  const grand = sub + tax + ship + cfg.installation + extraTotal

  const statusColor: Record<string, string> = { draft:'#E8C96B', sent:'#93C5FD', viewed:'#D8B4FE', confirmed:'#5EEAD4', invoiced:'#FCD34D', completed:'#6EE7A0', cancelled:'#FCA5A5' }

  return (
    <div style={{minHeight:'100vh',background:'#F7F4EF',fontFamily:'Inter,sans-serif'}}>
      <header style={{height:56,background:'#1C1C1E',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 20px'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:30,height:30,background:'#C9A84C',borderRadius:7,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>🪟</div>
          <span style={{fontFamily:'Playfair Display,serif',fontSize:15,color:'#fff'}}>Custom <span style={{color:'#C9A84C'}}>Elegant</span> Blinds</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{background:statusColor[project.status]||'#E8C96B',color:'#1C1C1E',padding:'2px 10px',borderRadius:10,fontSize:10,fontWeight:700}}>{project.status?.toUpperCase()}</span>
          <a href="/customer" style={{fontSize:11,color:'rgba(255,255,255,.5)',textDecoration:'none'}}>← My Projects</a>
          <a href="/auth/logout" style={{fontSize:11,color:'rgba(255,255,255,.5)',textDecoration:'none'}}>Sign Out</a>
        </div>
      </header>
      <main style={{maxWidth:1100,margin:'0 auto',padding:'24px 20px'}}>
        <div style={{marginBottom:20}}>
          <h1 style={{fontFamily:'Playfair Display,serif',fontSize:24,marginBottom:4}}>{project.name}</h1>
          <p style={{fontSize:12,color:'#9AA5B4'}}>{project.address} · {project.email}</p>
          {!project.is_pushed && <div style={{background:'#FEF3C7',border:'1px solid rgba(245,158,11,.3)',borderRadius:7,padding:'10px 14px',fontSize:12,color:'#92400E',marginTop:12}}>⚠ Pricing is being finalized by your advisor — prices shown are estimates. Final pricing will appear after confirmation.</div>}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:20,alignItems:'start'}}>
          {/* Sheet */}
          <div style={{background:'#fff',borderRadius:10,border:'1px solid #E2DDD6',overflow:'hidden'}}>
            <table style={{borderCollapse:'collapse',width:'100%',fontSize:12}}>
              <thead>
                <tr>
                  {['#','Blind Type','Control','Location','Fabric','Valance','Bottom Rail','Mount','W"','H"','Qty','Sq.M','Remarks'].map(h=>(
                    <th key={h} style={{background:'#EDEBE6',color:'#4A5568',fontSize:10,fontWeight:700,padding:'8px 7px',textAlign:'left',borderRight:'1px solid #E2DDD6',borderBottom:'2px solid #E2DDD6',whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any, idx: number) => {
                  if (r.is_section) return (
                    <tr key={r.id}><td colSpan={13} style={{background:'#2A2826',color:'rgba(255,255,255,.75)',fontSize:10,fontWeight:700,letterSpacing:'1.2px',padding:'5px 10px'}}>▸ {r.section_name}</td></tr>
                  )
                  const vi = rows.slice(0,idx).filter((x:any)=>!x.is_section).length + 1
                  return (
                    <tr key={r.id} style={{borderBottom:'1px solid #E2DDD6',background:idx%2===0?'#fff':'#FAF8F5'}}>
                      <td style={{padding:'8px 7px',color:'#9AA5B4',fontSize:10,borderRight:'1px solid #E2DDD6'}}>{vi}</td>
                      <td style={{padding:'8px 7px',borderRight:'1px solid #E2DDD6'}}>{r.blind_type||'—'}</td>
                      <td style={{padding:'8px 7px',borderRight:'1px solid #E2DDD6'}}>{r.control||'—'}</td>
                      <td style={{padding:'8px 7px',borderRight:'1px solid #E2DDD6',fontSize:11}}>{r.location||'—'}</td>
                      <td style={{padding:'8px 7px',borderRight:'1px solid #E2DDD6'}}>{r.fabric||'—'}</td>
                      <td style={{padding:'8px 7px',borderRight:'1px solid #E2DDD6'}}>{r.valance||'—'}</td>
                      <td style={{padding:'8px 7px',borderRight:'1px solid #E2DDD6'}}>{r.bottom_rail||'—'}</td>
                      <td style={{padding:'8px 7px',borderRight:'1px solid #E2DDD6'}}>{r.mount||'—'}</td>
                      <td style={{padding:'8px 7px',borderRight:'1px solid #E2DDD6',textAlign:'center'}}>{r.width_in||'—'}</td>
                      <td style={{padding:'8px 7px',borderRight:'1px solid #E2DDD6',textAlign:'center'}}>{r.height_in||'—'}</td>
                      <td style={{padding:'8px 7px',borderRight:'1px solid #E2DDD6',textAlign:'center'}}>{r.qty||1}</td>
                      <td style={{padding:'8px 7px',borderRight:'1px solid #E2DDD6'}}>{r.width_in&&r.height_in?sqm(r.width_in,r.height_in).toFixed(2):'—'}</td>
                      <td style={{padding:'8px 7px',fontSize:11,color:'#4A5568'}}>{r.remark||'—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {/* Totals sidebar */}
          <div>
            <div style={{background:'#1C1C1E',borderRadius:10,padding:'16px',color:'#fff',marginBottom:12}}>
              <div style={{fontSize:10,fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',color:'#9AA5B4',marginBottom:12}}>Project Totals</div>
              {[['Items',dataRows.length],['Blinds',fmt(totBlind)],['Motors',fmt(totMotor)],...(cfg.discount_pct>0?[[`Discount (${cfg.discount_pct}%)`,'-'+fmt((totBlind+totMotor)*cfg.discount_pct/100)]]:[[]]),[`Tax (${cfg.tax_pct}%)`,fmt(tax)],[`Shipping`,fmt(ship)],['Installation',fmt(cfg.installation)],...fees.map((f:any)=>[f.label,fmt(f.fee_type==='pct'?sub*(f.value/100):f.value)])].filter(r=>r.length===2).map(([l,v])=>(
                <div key={l as string} style={{display:'flex',justifyContent:'space-between',marginBottom:7}}>
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
              <div style={{background:'#D1FAE5',borderRadius:8,padding:'10px 14px',fontSize:12,color:'#065F46'}}>
                ✅ {cfg.discount_pct}% discount applied{cfg.discount_reason?` — ${cfg.discount_reason}`:''}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
