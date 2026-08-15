// Public quote page — accessible via email link, no auth required
import { createAdminClient } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'

const CONV = 0.00064516
function sqm(w: any, h: any) {
  const s = parseFloat(w || 0) * parseFloat(h || 0) * CONV
  return s > 0 ? Math.max(1, s) : 0
}

export default async function QuotePage({ params }: { params: { id: string } }) {
  const supabase = createAdminClient()
  const { data: project } = await supabase
    .from('projects')
    .select(`*, customers(*), project_rows(*), project_config(*), project_fees(*)`)
    .eq('id', params.id).single()

  if (!project) notFound()

  // Mark viewed + log email view event
  if (project.status === 'sent') {
    await supabase.from('projects').update({ status:'viewed', viewed_at:new Date().toISOString() }).eq('id', params.id)
    await supabase.from('email_events').update({ viewed_at:new Date().toISOString() })
      .eq('project_id', params.id).eq('event_type','quote_sent').is('viewed_at',null)
  }

  // Pricing MUST come from the actual products/motors config, the same way
  // the admin sheet computes it — the previous version hardcoded cost=16,
  // factor=5 for every row regardless of blind type, and never accounted for
  // motors at all, so this public-facing total could silently disagree with
  // what the project actually charges.
  const [{ data: products }, { data: motors }] = await Promise.all([
    supabase.from('products').select('name, my_cost_per_sqm, factor').eq('is_active', true),
    supabase.from('motors').select('name, my_cost_per_unit, factor').eq('is_active', true),
  ])
  const getProd = (name: string) => (products || []).find((p: any) => p.name === name) || { my_cost_per_sqm: 0, factor: 0 }
  const getMotor = (name: string) => (motors || []).find((m: any) => m.name === name) || { my_cost_per_unit: 0, factor: 0 }
  const blindsQ = (r: any) => Math.round(sqm(r.width_in, r.height_in) * getProd(r.blind_type).my_cost_per_sqm * getProd(r.blind_type).factor * 100) / 100 * (r.qty || 1)
  const motorQ = (r: any) => getMotor(r.control).my_cost_per_unit * getMotor(r.control).factor * (r.qty || 1)

  const rows = (project.project_rows||[]).sort((a:any,b:any)=>a.sort_order-b.sort_order)
  const cfg = project.project_config || {tax_pct:10,shipping_pct:18,discount_pct:0,installation:500}
  const fees = project.project_fees || []
  const fmt=(n:number)=>'$'+Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',')
  const dataRows=rows.filter((r:any)=>!r.is_section)
  const totBlind = dataRows.reduce((s:number,r:any)=>s+blindsQ(r),0)
  const totMotor = dataRows.reduce((s:number,r:any)=>s+motorQ(r),0)
  const sub=(totBlind+totMotor)*(1-cfg.discount_pct/100)
  const tax=sub*(cfg.tax_pct/100)
  const ship=sub*(cfg.shipping_pct/100)
  const extraTotal=fees.reduce((s:number,f:any)=>s+(f.fee_type==='pct'?sub*(f.value/100):f.value),0)
  const grand=sub+tax+ship+cfg.installation+extraTotal

  return (
    <div style={{minHeight:'100vh',background:'#F7F4EF',fontFamily:'Arial,sans-serif',padding:'32px 20px'}}>
      <div style={{maxWidth:900,margin:'0 auto'}}>
        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{fontSize:40,marginBottom:8}}>🪟</div>
          <h1 style={{fontFamily:'Georgia,serif',fontSize:24,color:'#8B6914',margin:0}}>Custom Elegant Blinds</h1>
          <p style={{color:'#9AA5B4',fontSize:13,marginTop:4}}>customelegantblinds.com · Monroe, WA</p>
        </div>
        <div style={{background:'#fff',borderRadius:10,padding:'20px 24px',marginBottom:20,border:'1px solid #E2DDD6'}}>
          <h2 style={{fontFamily:'Georgia,serif',fontSize:20,marginBottom:4}}>{project.name} — Quote</h2>
          <p style={{fontSize:12,color:'#9AA5B4',margin:0}}>Prepared for {project.customers?.name} · {new Date().toLocaleDateString()} · Valid 30 days</p>
        </div>
        <div style={{background:'#fff',borderRadius:10,border:'1px solid #E2DDD6',overflow:'hidden',marginBottom:20}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead><tr>
              {['#','Location','Type','Control','Fabric','W"','H"','Qty','Sq.M'].map(h=>(
                <th key={h} style={{background:'#1C1C1E',color:'#fff',padding:'8px 10px',textAlign:'left',fontSize:11}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {rows.map((r:any,idx:number)=>{
                if(r.is_section)return<tr key={r.id}><td colSpan={9} style={{background:'#2A2826',color:'rgba(255,255,255,.7)',fontSize:10,fontWeight:700,letterSpacing:'1px',padding:'5px 10px'}}>▸ {r.section_name}</td></tr>
                const vi=rows.slice(0,idx).filter((x:any)=>!x.is_section).length+1
                return<tr key={r.id} style={{borderBottom:'1px solid #E2DDD6',background:idx%2===0?'#fff':'#FAF8F5'}}>
                  <td style={{padding:'7px 10px',color:'#9AA5B4',fontSize:11}}>{vi}</td>
                  <td style={{padding:'7px 10px',fontSize:11}}>{r.location||'—'}</td>
                  <td style={{padding:'7px 10px'}}>{r.blind_type||'—'}</td>
                  <td style={{padding:'7px 10px'}}>{r.control||'—'}</td>
                  <td style={{padding:'7px 10px'}}>{r.fabric||'—'}</td>
                  <td style={{padding:'7px 10px',textAlign:'center'}}>{r.width_in||'—'}</td>
                  <td style={{padding:'7px 10px',textAlign:'center'}}>{r.height_in||'—'}</td>
                  <td style={{padding:'7px 10px',textAlign:'center'}}>{r.qty||1}</td>
                  <td style={{padding:'7px 10px'}}>{r.width_in&&r.height_in?sqm(r.width_in,r.height_in).toFixed(2):'—'}</td>
                </tr>
              })}
            </tbody>
          </table>
        </div>
        <div style={{display:'flex',justifyContent:'flex-end'}}>
          <div style={{width:300,background:'#fff',border:'1px solid #E2DDD6',borderRadius:10,padding:20}}>
            {[[`Discount (${cfg.discount_pct}%)`,cfg.discount_pct>0?'-'+fmt((totBlind+totMotor)*cfg.discount_pct/100):null],[`Tax @${cfg.tax_pct}%`,fmt(tax)],[`Shipping (${cfg.shipping_pct}%)`,fmt(ship)],['Installation',fmt(cfg.installation)],...fees.map((f:any)=>[f.label,fmt(f.fee_type==='pct'?sub*(f.value/100):f.value)])].filter(([,v])=>v).map(([l,v])=>(
              <div key={l as string} style={{display:'flex',justifyContent:'space-between',marginBottom:8,fontSize:13}}>
                <span style={{color:'#4A5568'}}>{l}</span>
                <span style={{fontWeight:600,color:String(l).includes('Discount')?'#27AE60':'#1C1C1E'}}>{v}</span>
              </div>
            ))}
            <div style={{borderTop:'2px solid #C9A84C',paddingTop:10,marginTop:6,display:'flex',justifyContent:'space-between'}}>
              <span style={{fontSize:16,fontWeight:700}}>GRAND TOTAL</span>
              <span style={{fontSize:18,fontWeight:700,color:'#8B6914'}}>{fmt(grand)}</span>
            </div>
          </div>
        </div>
        <div style={{textAlign:'center',marginTop:32,fontSize:11,color:'#9AA5B4',borderTop:'1px solid #E2DDD6',paddingTop:20}}>
          Custom Elegant Blinds LLC · customelegantblinds.com · Monroe, WA<br/>
          This is a computer-generated quote. Valid for 30 days from date issued.
        </div>
      </div>
    </div>
  )
}
