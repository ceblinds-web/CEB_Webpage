import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'

const statusColor: Record<string,{bg:string,fg:string}> = {
  draft:{bg:'#FEF3C7',fg:'#92400E'}, sent:{bg:'#DBEAFE',fg:'#1E40AF'}, viewed:{bg:'#EDE9FE',fg:'#5B21B6'},
  confirmed:{bg:'#CCFBF1',fg:'#0F766E'}, invoiced:{bg:'#FEF3C7',fg:'#92400E'}, completed:{bg:'#D1FAE5',fg:'#065F46'}, cancelled:{bg:'#FEE2E2',fg:'#991B1B'},
}

export default async function CustomerDashboard() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/auth/login')

  const { data: customer } = await supabase
    .from('customers').select('*').eq('profile_id', session.user.id).single()

  const { data: projects } = customer
    ? await supabase.from('projects').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false })
    : { data: [] }

  return (
    <div style={{minHeight:'100vh',background:'#F7F4EF',fontFamily:'Inter,sans-serif'}}>
      <header style={{height:56,background:'#1C1C1E',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 20px'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <img src="/ceb-logo.jpg" alt="CEB" style={{width:32,height:32,objectFit:'contain'}}/>
          <span style={{fontFamily:'Playfair Display,serif',fontSize:15,color:'#fff'}}>Custom <span style={{color:'#C9A84C'}}>Elegant</span> Blinds</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          {customer?.name && <span style={{fontSize:12,color:'#fff'}}>{customer.name}</span>}
          <a href="/auth/logout" style={{fontSize:11,color:'rgba(255,255,255,.5)',textDecoration:'none',border:'1px solid rgba(255,255,255,.15)',padding:'5px 12px',borderRadius:6}}>Sign Out</a>
        </div>
      </header>

      <main style={{maxWidth:820,margin:'0 auto',padding:'40px 20px'}}>
        <h1 style={{fontFamily:'Playfair Display,serif',fontSize:28,marginBottom:4,color:'#1C1C1E'}}>My Projects</h1>
        <p style={{fontSize:13,color:'#9AA5B4',marginBottom:32}}>Your window treatment quotes and orders</p>

        {!customer && (
          <div style={{background:'#FEF3C7',border:'1px solid rgba(245,158,11,.3)',borderRadius:9,padding:'16px 20px',fontSize:13,color:'#92400E'}}>
            We couldn't find a customer profile linked to this account yet. Please contact your CEB advisor to get set up.
          </div>
        )}

        {customer && (
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {(projects || []).map((p: any) => (
              <a key={p.id} href={`/customer/project/${p.id}`}
                style={{background:'#fff',borderRadius:12,padding:'20px 22px',border:'1px solid #E2DDD6',textDecoration:'none',color:'#1C1C1E',display:'flex',alignItems:'center',justifyContent:'space-between',transition:'border-color .15s, box-shadow .15s'}}>
                <div>
                  <div style={{fontWeight:700,fontSize:16}}>{p.name}</div>
                  <div style={{fontSize:12,color:'#9AA5B4',marginTop:3}}>{p.address || p.email}</div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  <span style={{fontSize:10,fontWeight:700,padding:'4px 12px',borderRadius:10,background:statusColor[p.status]?.bg||'#F0EBE6',color:statusColor[p.status]?.fg||'#4A5568'}}>{p.status?.toUpperCase()}</span>
                  <span style={{color:'#C9A84C',fontSize:16}}>→</span>
                </div>
              </a>
            ))}
            {!projects?.length && (
              <div style={{textAlign:'center',padding:'56px 20px',color:'#9AA5B4'}}>
                <div style={{fontSize:38,marginBottom:12}}>📋</div>
                <p style={{fontSize:13}}>No projects yet. Your CEB advisor will create one for you.</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
