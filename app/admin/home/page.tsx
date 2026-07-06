'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ProjectHome() {
  const router = useRouter()
  const [customers, setCustomers] = useState<any[]>([])
  const [expanded, setExpanded] = useState<Record<string,boolean>>({})
  const [quickForm, setQuickForm] = useState<Record<string,{open:boolean;name:string;email:string;addr:string;phone:string}>>({})
  const [saving, setSaving] = useState<string|null>(null)
  const [toast, setToast] = useState<{msg:string,type:'ok'|'err'}|null>(null)

  const [mainExpanded, setMainExpanded] = useState<Record<string,boolean>>({})
  const [projForms, setProjForms] = useState<Record<string,any>>({})

  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [newCustForm, setNewCustForm] = useState({ name:'', email:'', phone:'', status:'active' })
  const [creatingCust, setCreatingCust] = useState(false)

  const showToast = (msg:string, type:'ok'|'err'='ok') => { setToast({msg,type}); setTimeout(()=>setToast(null), type==='err'?6000:3000) }

  const load = () => fetch('/api/customers',{cache:'no-store'}).then(r=>r.json()).then(d=>{
    setCustomers(d)
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
    if (!qf?.name?.trim()) return showToast('Enter a project name','err')
    setSaving(custId)
    try {
      const res = await fetch('/api/projects', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ customer_id:custId, name:qf.name.trim(), email:qf.email||custEmail, phone:qf.phone||null, address:qf.addr||null, status:'draft' })
      })
      const text = await res.text()
      let data:any = {}
      try { data = text?JSON.parse(text):{} } catch { showToast('Server returned an unexpected response','err'); return }
      if (!res.ok) { showToast(data.error||'Could not create project — try again','err'); return }
      setQuickForm(p=>({...p,[custId]:{open:false,name:'',email:'',addr:'',phone:''}}))
      router.push(`/admin/project/${data.id}`)
    } catch (err:any) {
      showToast('Network error: '+err.message,'err')
    } finally { setSaving(null) }
  }

  const deleteProject = async (projId: string, projName: string, e?:any) => {
    e?.stopPropagation?.()
    if (!confirm(`Delete project "${projName}"? This cannot be undone.`)) return
    await fetch(`/api/projects/${projId}`, { method:'DELETE' })
    load()
  }

  const createCustomer = async () => {
    if (!newCustForm.name.trim() || !newCustForm.email.trim()) return showToast('Name and email required','err')
    setCreatingCust(true)
    try {
      const res = await fetch('/api/customers', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(newCustForm) })
      const text = await res.text()
      let data:any = {}
      try { data = text?JSON.parse(text):{} } catch { showToast('Server returned an unexpected response','err'); return }
      if (!res.ok) { showToast(data.error||'Could not create customer','err'); return }
      setNewCustForm({name:'',email:'',phone:'',status:'active'})
      setShowNewCustomer(false)
      load()
      showToast('Customer created','ok')
    } catch (err:any) {
      showToast('Network error: '+err.message,'err')
    } finally { setCreatingCust(false) }
  }

  const createProjectMain = async (custId: string) => {
    const pf = projForms[custId]||{}
    if (!pf.name || !pf.email) return showToast('Project name and email required','err')
    try {
      const res = await fetch('/api/projects', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ customer_id:custId, ...pf }) })
      const text = await res.text()
      let data:any = {}
      try { data = text?JSON.parse(text):{} } catch { showToast('Server returned an unexpected response','err'); return }
      if (!res.ok) { showToast(data.error||'Could not create project — try again','err'); return }
      setProjForms(p=>({...p,[custId]:{}}))
      load()
      showToast('Project created','ok')
    } catch (err:any) {
      showToast('Network error: '+err.message,'err')
    }
  }

  const allProjects = customers.flatMap(c=>(c.projects||[]).map((p:any)=>({...p,customerName:c.name})))

  return (
    <div style={{display:'flex',height:'100vh',fontFamily:'Inter,sans-serif',background:'#F7F4EF'}}>
      <aside style={{width:272,background:'#1C1C1E',display:'flex',flexDirection:'column',flexShrink:0,overflowY:'auto'}}>
        <div style={{padding:'14px 14px 10px',borderBottom:'1px solid rgba(255,255,255,.08)'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
            <a href="/admin"><img src="/ceb-logo.jpg" alt="CEB" style={{width:32,height:32,objectFit:'contain',cursor:'pointer'}}/></a>
            <span style={{fontFamily:'Playfair Display,serif',fontSize:14,color:'#fff'}}>Project Home</span>
          </div>
          <div style={{display:'flex',gap:8}}>
            <a href="/admin" style={{fontSize:10,color:'#9AA5B4',textDecoration:'none'}}>← Home</a>
            <span style={{color:'rgba(255,255,255,.1)'}}>·</span>
            <a href="/admin/reports" style={{fontSize:10,color:'#C084FC',textDecoration:'none'}}>📈 Reports</a>
          </div>
        </div>

        <div style={{padding:'10px 12px 0',flex:1}}>
          <div style={{fontSize:11,fontWeight:700,letterSpacing:'1.2px',textTransform:'uppercase',color:'#9AA5B4',marginBottom:9}}>Customers</div>
          {customers.map(c=>{
            const isExp = !!expanded[c.id]
            const qf = quickForm[c.id]||{open:false,name:'',email:'',addr:'',phone:''}
            return (
              <div key={c.id} style={{marginBottom:2}}>
                <div style={{display:'flex',alignItems:'center',gap:7,padding:'8px 10px',borderRadius:7,cursor:'pointer',background:isExp?'rgba(255,255,255,.05)':'transparent'}}
                  onClick={()=>setExpanded(p=>({...p,[c.id]:!p[c.id]}))}>
                  <span style={{fontSize:11,color:'#9AA5B4',transform:isExp?'rotate(90deg)':'none',display:'inline-block',transition:'.15s',flexShrink:0}}>▶</span>
                  <span style={{fontSize:14}}>👤</span>
                  <span style={{flex:1,color:'rgba(255,255,255,.7)',fontSize:14,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.name}</span>
                  <span style={{fontSize:10,background:'rgba(255,255,255,.08)',color:'#9AA5B4',padding:'2px 6px',borderRadius:8,flexShrink:0}}>{c.projects?.length||0}</span>
                  <button
                    onClick={e=>{ e.stopPropagation(); setExpanded(p=>({...p,[c.id]:true})); setQuickForm(p=>({...p,[c.id]:{open:true,name:'',email:c.email,addr:'',phone:c.phone||''}})) }}
                    title="Add project" style={{background:'none',border:'none',color:'rgba(201,168,76,.7)',cursor:'pointer',fontSize:16,padding:'0 3px',flexShrink:0,lineHeight:1}}>＋</button>
                </div>

                {isExp && (
                  <div style={{paddingLeft:20,paddingBottom:4}}>
                    {c.projects?.map((p:any)=>(
                      <div key={p.id} style={{display:'flex',alignItems:'center',gap:6,padding:'7px 10px',borderRadius:5,fontSize:13,marginBottom:2}}>
                        <span onClick={()=>router.push(`/admin/project/${p.id}`)} style={{display:'flex',alignItems:'center',gap:5,flex:1,cursor:'pointer',color:'rgba(255,255,255,.5)'}}>
                          <span style={{fontSize:13,flexShrink:0}}>📋</span>
                          <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}</span>
                          <span style={{fontSize:9,fontWeight:700,padding:'2px 6px',borderRadius:6,background:'rgba(255,255,255,.08)',color:statusColor[p.status]||'#E8C96B',flexShrink:0}}>{p.status}</span>
                        </span>
                        <button onClick={e=>deleteProject(p.id, p.name, e)} title="Delete project"
                          style={{background:'none',border:'none',color:'rgba(239,68,68,.5)',cursor:'pointer',fontSize:12,padding:'2px 4px',flexShrink:0,lineHeight:1}}>✕</button>
                      </div>
                    ))}
                    {!c.projects?.length && !qf.open && (
                      <div style={{fontSize:11,color:'#9AA5B4',padding:'5px 10px'}}>No projects yet</div>
                    )}
                    {qf.open ? (
                      <div style={{margin:'6px 4px 8px',padding:'10px',background:'rgba(201,168,76,.08)',borderRadius:7,border:'1px solid rgba(201,168,76,.2)'}}>
                        <div style={{fontSize:11,fontWeight:700,color:'#C9A84C',marginBottom:8}}>New Project</div>
                        <input autoFocus placeholder="Project name *" value={qf.name}
                          onChange={e=>setQuickForm(p=>({...p,[c.id]:{...qf,name:e.target.value}}))}
                          onKeyDown={e=>{ if(e.key==='Enter') quickCreate(c.id,c.email) }}
                          style={{width:'100%',padding:'5px 7px',border:'1px solid rgba(201,168,76,.3)',borderRadius:4,fontSize:12,background:'#2a2a2a',color:'#fff',marginBottom:5,outline:'none',boxSizing:'border-box'}}/>
                        <input placeholder={`Email (${c.email})`} value={qf.email}
                          onChange={e=>setQuickForm(p=>({...p,[c.id]:{...qf,email:e.target.value}}))}
                          style={{width:'100%',padding:'5px 7px',border:'1px solid rgba(255,255,255,.1)',borderRadius:4,fontSize:12,background:'#2a2a2a',color:'#fff',marginBottom:5,outline:'none',boxSizing:'border-box'}}/>
                        <input placeholder="Address" value={qf.addr}
                          onChange={e=>setQuickForm(p=>({...p,[c.id]:{...qf,addr:e.target.value}}))}
                          style={{width:'100%',padding:'5px 7px',border:'1px solid rgba(255,255,255,.1)',borderRadius:4,fontSize:12,background:'#2a2a2a',color:'#fff',marginBottom:7,outline:'none',boxSizing:'border-box'}}/>
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

        <button onClick={()=>setShowNewCustomer(true)}
          style={{margin:'8px 12px 12px',background:'rgba(201,168,76,.1)',border:'1px dashed rgba(201,168,76,.3)',color:'#C9A84C',padding:8,borderRadius:7,fontSize:12,cursor:'pointer',fontFamily:'Inter,sans-serif',flexShrink:0}}>
          ＋ New Customer
        </button>
      </aside>

      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <header style={{height:52,background:'#fff',borderBottom:'1px solid #E2DDD6',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 24px',flexShrink:0}}>
          <div style={{fontFamily:'Playfair Display,serif',fontSize:18}}>All Customers</div>
          <div style={{fontSize:11,color:'#9AA5B4'}}>{allProjects.length} project{allProjects.length!==1?'s':''} across {customers.length} customer{customers.length!==1?'s':''}</div>
        </header>
        <div style={{flex:1,overflow:'auto',padding:20}}>
          <div style={{maxWidth:900,margin:'0 auto'}}>
            {customers.length===0 ? (
              <div style={{textAlign:'center',padding:'60px 20px',color:'#9AA5B4'}}>
                <div style={{fontSize:40,marginBottom:12}}>👤</div>
                <p style={{fontSize:14}}>No customers yet.</p>
                <p style={{fontSize:12}}>Click ＋ New Customer in the sidebar to add your first one.</p>
              </div>
            ) : (
              <div style={{background:'#fff',borderRadius:10,border:'1px solid #E2DDD6',overflow:'hidden'}}>
                {customers.map((c:any)=>(
                  <details key={c.id} style={{borderBottom:'1px solid #E2DDD6'}} open={mainExpanded[c.id]}>
                    <summary onClick={e=>{e.preventDefault(); setMainExpanded(p=>({...p,[c.id]:!p[c.id]}))}}
                      style={{display:'flex',alignItems:'center',gap:10,padding:'12px 16px',cursor:'pointer',listStyle:'none',userSelect:'none'}}>
                      <span style={{fontSize:16}}>👤</span>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:600}}>{c.name}</div>
                        <div style={{fontSize:11,color:'#9AA5B4'}}>{c.email}{c.phone?' · '+c.phone:''} · {c.projects?.length||0} project(s)</div>
                      </div>
                      <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:10,background:c.status==='active'?'#D1FAE5':'#FEF3C7',color:c.status==='active'?'#065F46':'#92400E'}}>{c.status}</span>
                    </summary>
                    {mainExpanded[c.id] && (
                      <div style={{padding:'0 16px 16px 44px',background:'#FAFAFA'}}>
                        {c.projects?.map((p:any)=>(
                          <div key={p.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'1px dashed #E2DDD6',fontSize:12}}>
                            <span>📋</span>
                            <span style={{flex:1,fontWeight:500}}>{p.name}</span>
                            <span style={{fontSize:10,fontWeight:700,padding:'1px 7px',borderRadius:8,background:'rgba(201,168,76,.2)',color:'#8B6914'}}>{p.status}</span>
                            <button onClick={()=>router.push(`/admin/project/${p.id}`)} style={{background:'#1C1C1E',color:'#fff',border:'none',padding:'3px 10px',borderRadius:5,fontSize:11,cursor:'pointer'}}>Open →</button>
                          </div>
                        ))}
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
                          <button onClick={()=>createProjectMain(c.id)} style={{background:'#7C3AED',color:'#fff',border:'none',padding:'6px 14px',borderRadius:6,fontSize:12,cursor:'pointer',fontWeight:600}}>
                            Create Project
                          </button>
                        </div>
                      </div>
                    )}
                  </details>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showNewCustomer && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:998}} onClick={()=>setShowNewCustomer(false)}>
          <div style={{background:'#fff',borderRadius:12,padding:24,width:380,maxWidth:'90vw',boxShadow:'0 24px 64px rgba(0,0,0,.25)'}} onClick={e=>e.stopPropagation()}>
            <div style={{fontFamily:'Playfair Display,serif',fontSize:17,marginBottom:16}}>New Customer</div>
            <label style={{display:'block',fontSize:11,fontWeight:700,color:'#4A5568',marginBottom:4}}>Name *</label>
            <input value={newCustForm.name} onChange={e=>setNewCustForm(p=>({...p,name:e.target.value}))} autoFocus
              style={{width:'100%',padding:'8px 10px',border:'1px solid #E2DDD6',borderRadius:6,fontSize:13,marginBottom:12}}/>
            <label style={{display:'block',fontSize:11,fontWeight:700,color:'#4A5568',marginBottom:4}}>Email *</label>
            <input value={newCustForm.email} onChange={e=>setNewCustForm(p=>({...p,email:e.target.value}))} type="email"
              style={{width:'100%',padding:'8px 10px',border:'1px solid #E2DDD6',borderRadius:6,fontSize:13,marginBottom:12}}/>
            <label style={{display:'block',fontSize:11,fontWeight:700,color:'#4A5568',marginBottom:4}}>Phone</label>
            <input value={newCustForm.phone} onChange={e=>setNewCustForm(p=>({...p,phone:e.target.value}))}
              style={{width:'100%',padding:'8px 10px',border:'1px solid #E2DDD6',borderRadius:6,fontSize:13,marginBottom:18}}/>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={()=>setShowNewCustomer(false)} style={{background:'#F7F4EF',border:'1px solid #E2DDD6',color:'#4A5568',padding:'8px 16px',borderRadius:6,fontSize:12,cursor:'pointer'}}>Cancel</button>
              <button disabled={creatingCust} onClick={createCustomer} style={{background:'#C9A84C',color:'#1C1C1E',border:'none',padding:'8px 16px',borderRadius:6,fontSize:12,fontWeight:700,cursor:'pointer'}}>{creatingCust?'Creating…':'Create Customer'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',background:toast.type==='err'?'#E53E3E':'#1C1C1E',color:'#fff',padding:'10px 18px',borderRadius:8,fontSize:12,fontWeight:500,boxShadow:'0 8px 24px rgba(0,0,0,.25)',zIndex:999,borderLeft:`3px solid ${toast.type==='err'?'#fff':'#C9A84C'}`}}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
