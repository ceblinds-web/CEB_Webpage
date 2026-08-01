'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminNavLinks from '@/components/AdminNavLinks'
import CustomerProjectSidebar from '@/components/CustomerProjectSidebar'

export default function ProjectHome() {
  const router = useRouter()
  const [customers, setCustomers] = useState<any[]>([])
  const [folders, setFolders] = useState<any[]>([])
  const [projFolderMap, setProjFolderMap] = useState<Record<string,string>>({})
  const [mainExpanded, setMainExpanded] = useState<Record<string,boolean>>({})
  const [projForms, setProjForms] = useState<Record<string,any>>({})
  const [toast, setToast] = useState<{msg:string,type:'ok'|'err'}|null>(null)
  const [sbKey, setSbKey] = useState(0)

  const showToast = (msg:string, type:'ok'|'err'='ok') => { setToast({msg,type}); setTimeout(()=>setToast(null), type==='err'?6000:3000) }

  const load = () => {
    fetch('/api/customers',{cache:'no-store'}).then(r=>r.json()).then(d=>{ if(Array.isArray(d)) setCustomers(d) })
    fetch('/api/folders',{cache:'no-store'}).then(r=>r.json()).then(d=>{
      if (d?.folders) { setFolders(d.folders); setProjFolderMap(d.mapping||{}) }
    }).catch(()=>{})
  }
  useEffect(()=>{ load() },[])

  const exportExcel = (projId: string) => { window.location.href = `/api/projects/${projId}/export` }
  const duplicateProject = async (p: any) => {
    const name = prompt('Name for the copy:', `${p.name} (Copy)`)
    if (!name?.trim()) return
    const res = await fetch(`/api/projects/${p.id}/duplicate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name.trim()})})
    if (!res.ok) { const d = await res.json().catch(()=>({})); showToast(d.error||'Copy failed','err'); return }
    load(); setSbKey(k=>k+1)
    showToast('Project copied')
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
      load(); setSbKey(k=>k+1)
      showToast('Project created','ok')
    } catch (err:any) {
      showToast('Network error: '+err.message,'err')
    }
  }

  const allProjects = customers.flatMap(c=>(c.projects||[]).map((p:any)=>({...p,customerName:c.name})))

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',fontFamily:'Inter,sans-serif',background:'#F7F4EF'}}>
      <header style={{height:56,background:'#1C1C1E',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 20px',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <a href="/admin"><img src="/ceb-logo.jpg" alt="CEB" style={{width:32,height:32,objectFit:'contain',cursor:'pointer'}}/></a>
          <span style={{fontFamily:'Playfair Display,serif',fontSize:15,color:'#fff'}}>Project Home</span>
        </div>
        <AdminNavLinks active="home"/>
      </header>
      <div style={{display:'flex',flex:1,overflow:'hidden'}}>
      <aside style={{width:272,background:'#1C1C1E',display:'flex',flexDirection:'column',flexShrink:0,overflowY:'auto'}}>
        <div style={{padding:'14px 14px 10px',borderBottom:'1px solid rgba(255,255,255,.08)'}}>
          <div style={{fontFamily:'Playfair Display,serif',fontSize:11,color:'#9AA5B4',letterSpacing:'1px',textTransform:'uppercase'}}>Customers &amp; Projects</div>
        </div>
        <CustomerProjectSidebar refreshKey={sbKey} onChanged={load} />
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
                        {c.projects?.map((p:any)=>{
                          const fld = folders.find((f:any)=>f.id===projFolderMap[p.id])
                          return (
                          <div key={p.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'1px dashed #E2DDD6',fontSize:12}}>
                            <span>📋</span>
                            <span style={{flex:1,fontWeight:500}}>{p.name}{fld && <span style={{marginLeft:8,fontSize:10,color:'#9AA5B4'}}>📁 {fld.name}</span>}</span>
                            <span style={{fontSize:10,fontWeight:700,padding:'1px 7px',borderRadius:8,background:'rgba(201,168,76,.2)',color:'#8B6914'}}>{p.status}</span>
                            <button onClick={()=>duplicateProject(p)} style={{background:'#7C3AED',color:'#fff',border:'none',padding:'3px 10px',borderRadius:5,fontSize:11,cursor:'pointer'}}>⧉ Copy</button>
                            <button onClick={()=>exportExcel(p.id)} style={{background:'#0D9488',color:'#fff',border:'none',padding:'3px 10px',borderRadius:5,fontSize:11,cursor:'pointer'}}>⬇ Excel</button>
                            <button onClick={()=>router.push(`/admin/project/${p.id}`)} style={{background:'#1C1C1E',color:'#fff',border:'none',padding:'3px 10px',borderRadius:5,fontSize:11,cursor:'pointer'}}>Open →</button>
                          </div>
                        )})}
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
      </div>

      {toast && (
        <div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',background:toast.type==='err'?'#E53E3E':'#1C1C1E',color:'#fff',padding:'10px 18px',borderRadius:8,fontSize:12,fontWeight:500,boxShadow:'0 8px 24px rgba(0,0,0,.25)',zIndex:999,borderLeft:`3px solid ${toast.type==='err'?'#fff':'#C9A84C'}`}}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
