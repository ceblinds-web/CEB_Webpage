import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'

export default async function AdminLanding() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/auth/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
  if (profile?.role !== 'admin') redirect('/customer')

  return (
    <div style={{minHeight:'100vh',background:'linear-gradient(145deg,#1C1C1E,#2d2d30)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontFamily:'Inter,sans-serif'}}>
      <div style={{textAlign:'center',marginBottom:48}}>
        <div style={{width:64,height:64,background:'#C9A84C',borderRadius:16,display:'flex',alignItems:'center',justifyContent:'center',fontSize:30,margin:'0 auto 16px'}}>🪟</div>
        <h1 style={{fontFamily:'Playfair Display,serif',fontSize:30,color:'#fff',margin:'0 0 8px'}}>Custom <span style={{color:'#C9A84C'}}>Elegant</span> Blinds</h1>
        <p style={{color:'rgba(255,255,255,.45)',fontSize:14,margin:0}}>Welcome back, CEB_Admin</p>
      </div>
      <div style={{display:'flex',gap:16}}>
        <a href="/admin/home" style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12,background:'#C9A84C',color:'#1C1C1E',textDecoration:'none',padding:'28px 36px',borderRadius:14,minWidth:180,fontWeight:700,fontSize:15,transition:'opacity .2s'}}>
          <span style={{fontSize:32}}>📋</span>
          <span>Project Home</span>
          <span style={{fontSize:11,fontWeight:400,opacity:.7}}>All projects & quotes</span>
        </a>
        <a href="/admin/panel" style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12,background:'rgba(124,58,237,.9)',color:'#fff',textDecoration:'none',padding:'28px 36px',borderRadius:14,minWidth:180,fontWeight:700,fontSize:15}}>
          <span style={{fontSize:32}}>🛡</span>
          <span>Admin Panel</span>
          <span style={{fontSize:11,fontWeight:400,opacity:.7}}>Invoices, payments, issues</span>
        </a>
      </div>
      <a href="/auth/logout" style={{color:'rgba(255,255,255,.3)',fontSize:12,textDecoration:'none',marginTop:32}}>Sign Out</a>
    </div>
  )
}
