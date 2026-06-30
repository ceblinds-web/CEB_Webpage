'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ProjectHome() {
  const router = useRouter()
  const [customers, setCustomers] = useState<any[]>([])
  const [expanded, setExpanded] = useState<Record<string,boolean>>({})
  const [quickForm, setQuickForm] = useState<Record<string,{open:boolean;name:string;email:string;addr:string;phone:string}>>({})
  const [saving, setSaving] = useState<string|null>(null)

  const load = () => fetch('/api/customers',{cache:'no-store'}).then(r=>r.json()).then(d=>{
    setCustomers(d)
    // auto-expand all customers that have projects
    const exp: Record<string,boolean> = {}
    d.forEach((c:any) => { if (c.projects?.length) exp[c.id] = true })
    setExpanded(exp)
  })
  useEffect(()=>{ load() },[])

  const statusColor: Record<string,string> = {
    draft:'#E8C96B',sent:'#93C5FD',viewed:'#D8B4FE',confirmed:'#5EEAD4',invoiced:'#FCD34D',completed:'#6EE7A0',cancelled:'#FCA5A5'
  }

  const quickCreate = async (custId: string, custEmail: string) => {
    const qf = quickForm[custId]
    if (!qf?.name?.trim()) return alert('Enter a project name')
    setSaving(custId)
    const res = await fetch('/api/projects', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ customer_id:custId, name:qf.name.trim(), email:qf.email||custEmail, phone:qf.phone||null, address:qf.addr||null, status:'draft' })
    })
    setSaving(null)
    if (!res.ok) { alert('Could not create project — try again'); return }
    const newProj = await res.json()
    setQuickForm(p=>({...p,[custId]:{open:false,name:'',email:'',addr:'',phone:''}}))
    router.push(`/admin/project/${newProj.id}`)
  }

  const allProjects = customers.flatMap(c=>(c.projects||[]).map((p:any)=>({...p,customerName:c.name}))).sort((a,b)=>new Date(b.created_at||0).getTime()-new Date(a.created_at||0).getTime())

  return (
    <div style={{display:'flex',height:'100vh',fontFamily:'Inter,sans-serif',background:'#F7F4EF'}}>
      {/* SIDEBAR */}
      <aside style={{width:272,background:'#1C1C1E',display:'flex',flexDirection:'column',flexShrink:0,overflowY:'auto'}}>
        <div style={{padding:'14px 14px 10px',borderBottom:'1px solid rgba(255,255,255,.08)'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
            <div style={{width:28,height:28,background:'#C9A84C',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13}}>🪟</div>
            <span style={{fontFamily:'Playfair Display,serif',fontSize:14,color:'#fff'}}>Project Home</span>
          </div>
          <div style={{display:'flex',gap:8}}>
            <a href="/admin" style={{fontSize:10,color:'#9AA5B4',textDecoration:'none'}}>← Home</a>
            <span style={{color:'rgba(255,255,255,.1)'}}>·</span>
            <a href="/admin/panel" style={{fontSize:10,color:'#C084FC',textDecoration:'none'}}>🛡 Admin Panel</a>
          </div>
        </div>

        <div style={{padding:'10px 12px 0',flex:1}}>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:'1.2px',textTransform:'uppercase',color:'#9AA5B4',marginBottom:8}}>Customers</div>
          {customers.map(c=>{
            const isExp = !!expanded[c.id]
            const qf = quickForm[c.id]||{open:false,name:'',email:'',addr:'',phone:''}
            return (
              <div key={c.id} style={{marginBottom:2}}>
                {/* Customer header row */}
                <div style={{display:'flex',alignItems:'center',gap:6,padding:'7px 8px',borderRadius:7,cursor:'pointer',background:isExp?'rgba(255,255,255,.05)':'transparent'}}
                  onClick={()=>setExpanded(p=>({...p,[c.id]:!p[c.id]}))}>
                  <span style={{fontSize:9,color:'#9AA5B4',transform:isExp?'rotate(90deg)':'none',display:'inline-block',transition:'.15s',flexShrink:0}}>▶</span>
                  <span style={{fontSize:12}}>👤</span>
                  <span style={{flex:1,color:'rgba(255,255,255,.7)',fontSize:12,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.name}</span>
                  <span style={{fontSize:9,background:'rgba(255,255,255,.08)',color:'#9AA5B4',padding:'1px 5px',borderRadius:8,flexShrink:0}}>{c.projects?.length||0}</span>
                  {/* ＋ add project button right on the customer row */}
                  <button
                    onClick={e=>{ e.stopPropagation(); setExpanded(p=>({...p,[c.id]:true})); setQuickForm(p=>({...p,[c.id]:{open:true,name:'',email:c.email,addr:'',phone:c.phone||''}})) }}
                    title="Add project" style={{background:'none',border:'none',color:'rgba(201,168,76,.7)',cursor:'pointer',fontSize:14,padding:'0 2px',flexShrink:0,lineHeight:1}}>＋</button>
                </div>

                {/* Expanded: project list + quick-add form */}
                {isExp && (
                  <div style={{paddingLeft:20,paddingBottom:4}}>
                    {c.projects?.map((p:any)=>(
                      <div key={p.id} onClick={()=>router.push(`/admin/project/${p.id}`)}
                        style={{display:'flex',alignItems:'center',gap:5,padding:'5px 8px',borderRadius:5,cursor:'pointer',color:'rgba(255,255,255,.5)',fontSize:11,marginBottom:1}}>
                        <span style={{fontSize:10,flexShrink:0}}>📋</span>
                        <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}</span>
                        <span style={{fontSize:8,fontWeight:700,padding:'1px 5px',borderRadius:6,background:'rgba(255,255,255,.08)',color:statusColor[p.status]||'#E8C96B',flexShrink:0}}>{p.status}</span>
                      </div>
                    ))}
                    {!c.projects?.length && !qf.open && (
                      <div style={{fontSize:10,color:'#9AA5B4',padding:'3px 8px'}}>No projects yet</div>
                    )}
                    {/* Quick-add inline form */}
                    {qf.open ? (
                      <div style={{margin:'6px 4px 8px',padding:'10px',background:'rgba(201,168,76,.08)',borderRadius:7,border:'1px solid rgba(201,168,76,.2)'}}>
                        <div style={{fontSize:10,fontWeight:700,color:'#C9A84C',marginBottom:7}}>New Project</div>
                        <input autoFocus placeholder="Project name *" value={qf.name}
                          onChange={e=>setQuickForm(p=>({...p,[c.id]:{...qf,name:e.target.value}}))}
                          onKeyDown={e=>{ if(e.key==='Enter') quickCreate(c.id,c.email) }}
                          style={{width:'100%',padding:'5px 7px',border:'1px solid rgba(201,168,76,.3)',borderRadius:4,fontSize:11,background:'#2a2a2a',color:'#fff',marginBottom:5,outline:'none',boxSizing:'border-box'}}/>
                        <input placeholder={`Email (${c.email})`} value={qf.email}
                          onChange={e=>setQuickForm(p=>({...p,[c.id]:{...qf,email:e.target.value}}))}
                          style={{width:'100%',padding:'5px 7px',border:'1px solid rgba(255,255,255,.1)',borderRadius:4,fontSize:11,background:'#2a2a2a',color:'#fff',marginBottom:5,outline:'none',boxSizing:'border-box'}}/>
                        <input placeholder="Address" value={qf.addr}
                          onChange={e=>setQuickForm(p=>({...p,[c.id]:{...qf,addr:e.target.value}}))}
                          style={{width:'100%',padding:'5px 7px',border:'1px solid rgba(255,255,255,.1)',borderRadius:4,fontSize:11,background:'#2a2a2a',color:'#fff',marginBottom:7,outline:'none',boxSizing:'border-box'}}/>
                        <div style={{display:'flex',gap:5}}>
                          <button onClick={()=>quickCreate(c.id,c.email)} disabled={saving===c.id}
                            style={{flex:1,background:'#C9A84C',color:'#1C1C1E',border:'none',padding:'6px',borderRadius:5,fontSize:11,fontWeight:700,cursor:'pointer'}}>
                            {saving===c.id?'Creating…':'✓ Create'}
                          </button>
                          <button onClick={()=>setQuickForm(p=>({...p,[c.id]:{...qf,open:false}}))}
                            style={{background:'transparent',color:'#9AA5B4',border:'1px solid rgba(255,255,255,.1)',padding:'6px 10px',borderRadius:5,fontSize:11,cursor:'pointer'}}>✕</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={()=>setQuickForm(p=>({...p,[c.id]:{open:true,name:'',email:c.email,addr:'',phone:c.phone||''}}))}
                        style={{background:'none',border:'none',color:'rgba(201,168,76,.5)',fontSize:11,padding:'4px 8px',cursor:'pointer',fontFamily:'Inter,sans-serif',textAlign:'left'}}>
                        ＋ Add project
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <button onClick={()=>router.push('/admin/customers')}
          style={{margin:'8px 12px 12px',background:'rgba(201,168,76,.1)',border:'1px dashed rgba(201,168,76,.3)',color:'#C9A84C',padding:8,borderRadius:7,fontSize:12,cursor:'pointer',fontFamily:'Inter,sans-serif',flexShrink:0}}>
          ＋ New Customer
        </button>
      </aside>

      {/* MAIN */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <header style={{height:52,background:'#fff',borderBottom:'1px solid #E2DDD6',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 24px',flexShrink:0}}>
          <div style={{fontFamily:'Playfair Display,serif',fontSize:18}}>All Projects</div>
          <div style={{fontSize:11,color:'#9AA5B4'}}>{allProjects.length} project{allProjects.length!==1?'s':''} across {customers.length} customer{customers.length!==1?'s':''}</div>
        </header>
        <div style={{flex:1,overflow:'auto',padding:20}}>
          <div style={{maxWidth:780,margin:'0 auto'}}>
            {allProjects.length===0 ? (
              <div style={{textAlign:'center',padding:'60px 20px',color:'#9AA5B4'}}>
                <div style={{fontSize:40,marginBottom:12}}>📋</div>
                <p style={{fontSize:14}}>No projects yet.</p>
                <p style={{fontSize:12}}>Expand a customer in the sidebar and click ＋ to add one.</p>
              </div>
            ) : (
              <div style={{background:'#fff',borderRadius:10,border:'1px solid #E2DDD6',overflow:'hidden'}}>
                {allProjects.map((p,i)=>(
                  <a key={p.id} href={`/admin/project/${p.id}`}
                    style={{display:'flex',alignItems:'center',gap:12,padding:'14px 18px',borderBottom: i<allProjects.length-1?'1px solid #E2DDD6':'none',textDecoration:'none',color:'#1C1C1E',background:'#fff'}}>
                    <span style={{fontSize:18,flexShrink:0}}>📋</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:600,fontSize:13}}>{p.name}</div>
                      <div style={{fontSize:11,color:'#9AA5B4',marginTop:1}}>{p.customerName}{p.address?' · '+p.address:''}</div>
                    </div>
                    <span style={{fontSize:9,fontWeight:700,padding:'3px 9px',borderRadius:10,background:statusColor[p.status]||'#FEF3C7',color:'#1C1C1E',flexShrink:0}}>{p.status}</span>
                    <span style={{color:'#C9A84C',fontSize:13}}>→</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
