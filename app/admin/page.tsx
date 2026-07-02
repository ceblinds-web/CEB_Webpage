import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'

export default async function AdminLanding() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/auth/login')
  const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', session.user.id).single()
  if (profile?.role !== 'admin') redirect('/customer')

  const navBtn = { display:'flex', alignItems:'center', gap:8, background:'linear-gradient(135deg,#8B1A1A,#C9A84C)', color:'#fff', padding:'12px 22px', borderRadius:9, textDecoration:'none', fontSize:13, fontWeight:700, boxShadow:'0 6px 20px rgba(139,26,26,.25)' }

  return (
    <div style={{minHeight:'100vh',background:'#1C1C1E',fontFamily:'Inter,sans-serif',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',inset:0,background:'radial-gradient(circle at 30% 20%, rgba(201,168,76,.08), transparent 50%), radial-gradient(circle at 80% 80%, rgba(139,26,26,.12), transparent 50%)'}}/>
      <a href="/admin"><img src="/ceb-logo.jpg" alt="CEB" style={{width:110,height:110,objectFit:'contain',marginBottom:22,position:'relative'}}/></a>
      <div style={{fontFamily:'Playfair Display,serif',fontSize:30,color:'#fff',marginBottom:6,position:'relative'}}>Custom Elegant Blinds</div>
      <div style={{fontSize:12,color:'#C9A84C',letterSpacing:'1.5px',textTransform:'uppercase',marginBottom:36,position:'relative'}}>Business Portal</div>
      <div style={{fontSize:13,color:'rgba(255,255,255,.5)',marginBottom:22,position:'relative'}}>Welcome back{profile?.full_name?`, ${profile.full_name}`:''}</div>
      <a href="/admin/home" style={{...navBtn, position:'relative', marginBottom:22}}>
        Enter Portal →
      </a>
      <div style={{display:'flex',gap:12,flexWrap:'wrap',justifyContent:'center',position:'relative'}}>
        <a href="/admin/home" style={navBtn}>📋 Project Home</a>
        <a href="/admin/reports" style={navBtn}>📈 Reports</a>
        <a href="/gallery" style={navBtn}>🖼 Gallery</a>
      </div>
      <div style={{marginTop:56,display:'flex',alignItems:'center',gap:14,color:'rgba(255,255,255,.3)',fontSize:11,position:'relative'}}>
        <span>Interior Design</span><span>·</span><span>Design &amp; Build</span><span>·</span><span>Procurement</span>
      </div>
      <div style={{fontSize:10,color:'#8B6914',marginTop:6,letterSpacing:'1px',position:'relative'}}>ceblinds.click · Monroe, WA</div>
    </div>
  )
}
