'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [form, setForm] = useState({ name:'', email:'', phone:'', status:'active' })
  const [projForms, setProjForms] = useState<Record<string,any>>({})
  const [expanded, setExpanded] = useState<Record<string,boolean>>({})
  const router = useRouter()

  const load = () => fetch('/api/customers').then(r=>r.json()).then(setCustomers)
  useEffect(()=>{ load() },[])

  const createCustomer = async () => {
    if (!form.name || !form.email) return alert('Name and email required')
    await fetch('/api/customers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)})
    setForm({name:'',email:'',phone:'',status:'active'}); load()
  }
  const createProject = async (custId: string) => {
    const pf = projForms[custId]||{}
    if (!pf.name || !pf.email) return alert('Project name and email required')
    await fetch('/api/projects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customer_id:custId,...pf})})
    setProjForms(p=>({...p,[custId]:{}})); load()
  }

  return (
    <div style={{minHeight:'100vh',background:'#F7F4EF',fontFamily:'Inter,sans-serif'}}>
      <header style={{height:56,background:'#1C1C1E',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 18px'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <button onClick={()=>router.push('/admin')} style={{background:'rgba(255,255,255,.1)',border:'none',color:'#fff',padding:'5px 12px',borderRadius:6,cursor:'pointer',fontSize:12}}>← Admin</button>
          <span style={{fontFamily:'Playfair Display,serif',fontSize:15,color:'#fff'}}>Manage Customers</span>
        </div>
      </header>
      <main style={{maxWidth:900,margin:'0 auto',padding:'24px 20px'}}>
        {/* New Customer Form */}
        <div style={{background:'#fff',borderRadius:10,border:'1px solid #E2DDD6',padding:20,marginBottom:24}}>
          <h2 style={{fontSize:14,fontWeight:700,marginBottom:14}}>＋ New Customer</h2>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
            {[['name','Full Name'],['email','Email'],['phone','Phone (optional)']].map(([k,l])=>(
              <div key={k}>
                <label style={{display:'block',fontSize:11,fontWeight:600,color:'#4A5568',marginBottom:3}}>{l}</label>
                <input value={(form as any)[k]} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))}
                  style={{width:'100%',padding:'8px 10px',border:'1px solid #E2DDD6',borderRadius:6,fontSize:13,outline:'none'}}/>
              </div>
            ))}
          </div>
          <button onClick={createCustomer} style={{background:'#C9A84C',border:'none',color:'#1C1C1E',padding:'8px 18px',borderRadius:7,fontWeight:700,fontSize:13,cursor:'pointer'}}>
            Create Customer
          </button>
        </div>
        {/* Customer List */}
        <div style={{background:'#fff',borderRadius:10,border:'1px solid #E2DDD6',overflow:'hidden'}}>
          {customers.map((c:any)=>(
            <details key={c.id} style={{borderBottom:'1px solid #E2DDD6'}} open={expanded[c.id]}>
              <summary style={{display:'flex',alignItems:'center',gap:10,padding:'12px 16px',cursor:'pointer',listStyle:'none',userSelect:'none'}}>
                <span style={{fontSize:16}}>👤</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600}}>{c.name}</div>
                  <div style={{fontSize:11,color:'#9AA5B4'}}>{c.email}{c.phone?' · '+c.phone:''} · {c.projects?.length||0} project(s)</div>
                </div>
                <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:10,background:c.status==='active'?'#D1FAE5':'#FEF3C7',color:c.status==='active'?'#065F46':'#92400E'}}>{c.status}</span>
              </summary>
              <div style={{padding:'0 16px 16px 44px',background:'#FAFAFA'}}>
                {c.projects?.map((p:any)=>(
                  <div key={p.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'1px dashed #E2DDD6',fontSize:12}}>
                    <span>📋</span>
                    <span style={{flex:1,fontWeight:500}}>{p.name}</span>
                    <span style={{fontSize:10,fontWeight:700,padding:'1px 7px',borderRadius:8,background:'rgba(201,168,76,.2)',color:'#8B6914'}}>{p.status}</span>
                    <button onClick={()=>router.push(`/admin/project/${p.id}`)} style={{background:'#1C1C1E',color:'#fff',border:'none',padding:'3px 10px',borderRadius:5,fontSize:11,cursor:'pointer'}}>Open →</button>
                  </div>
                ))}
                {/* Add project form */}
                <div style={{marginTop:12,padding:12,background:'#fff',borderRadius:7,border:'1px solid #E2DDD6'}}>
                  <div style={{fontSize:11,fontWeight:700,color:'#4A5568',marginBottom:8}}>＋ Add Project</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                    {[['name','Project Name'],['email','Email'],['phone','Phone'],['address','Address']].map(([k,l])=>(
                      <div key={k}>
                        <label style={{display:'block',fontSize:10,color:'#4A5568',marginBottom:2}}>{l}</label>
                        <input value={projForms[c.id]?.[k]||''} onChange={e=>setProjForms(p=>({...p,[c.id]:{...p[c.id],[k]:e.target.value}}))}
                          style={{width:'100%',padding:'5px 8px',border:'1px solid #E2DDD6',borderRadius:5,fontSize:12,outline:'none'}}/>
                      </div>
                    ))}
                  </div>
                  <button onClick={()=>createProject(c.id)} style={{background:'#7C3AED',color:'#fff',border:'none',padding:'6px 14px',borderRadius:6,fontSize:12,cursor:'pointer',fontWeight:600}}>
                    Create Project
                  </button>
                </div>
              </div>
            </details>
          ))}
          {!customers.length && <div style={{padding:24,textAlign:'center',color:'#9AA5B4',fontSize:13}}>No customers yet — add your first one above</div>}
        </div>
      </main>
    </div>
  )
}
