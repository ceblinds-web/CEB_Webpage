'use client'
import { useEffect, useState } from 'react'

type Fabric = { code:string; series:string; category:string }

const CATEGORIES = [
  { key:'zebra', name:'Zebra Blinds', cover:'/catalog/zebra-collection-cover.jpg', ready:true,
    desc:'Dual-layer sheer/solid fabric bands for adjustable light control.' },
  { key:'dream_curtain', name:'Dream Curtains', cover:'/catalog/dream-curtain-collection-cover.jpg', ready:false,
    desc:'Soft flowing drapery with motorized or chain control.' },
  { key:'honeycomb', name:'Honey Comb Shades', cover:null, ready:false,
    desc:'Cellular insulating structure — energy efficient, clean lines.' },
  { key:'roller', name:'Roller Shades', cover:null, ready:false,
    desc:'Minimalist single-fabric roll, inside or outside mount.' },
]

// Confirmed real photo matches so far — each catalog page shows all color
// codes for that series together, exactly as the manufacturer laid it out.
// More series will be added here as photo-matching continues.
const CONFIRMED_SERIES: Record<string,{image:string}> = {
  '83046': { image:'/catalog/series-83046.jpg' },
  '83059': { image:'/catalog/series-83059.jpg' },
}

export default function CatalogPage() {
  const [fabrics, setFabrics] = useState<Fabric[]>([])
  const [activeCategory, setActiveCategory] = useState<string|null>(null)

  useEffect(()=>{
    fetch('/api/fabrics/public', { cache:'no-store' }).then(r=>r.json()).then(setFabrics).catch(()=>setFabrics([]))
  }, [])

  const seriesInCategory = (cat:string) => {
    const codes = fabrics.filter(f=>f.category===cat)
    const bySeries: Record<string,string[]> = {}
    codes.forEach(f=>{ if(!bySeries[f.series]) bySeries[f.series]=[]; bySeries[f.series].push(f.code) })
    return bySeries
  }

  return (
    <div style={{minHeight:'100vh',background:'#F7F4EF',fontFamily:'Inter,sans-serif'}}>
      <header style={{height:64,background:'#1C1C1E',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 24px'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <img src="/ceb-logo.jpg" alt="CEB" style={{width:36,height:36,objectFit:'contain'}}/>
          <span style={{fontFamily:'Playfair Display,serif',fontSize:17,color:'#fff'}}>Custom <span style={{color:'#C9A84C'}}>Elegant</span> Blinds</span>
        </div>
        <div style={{display:'flex',gap:10}}>
          <a href="/auth/login" style={{fontSize:12,color:'#fff',textDecoration:'none',padding:'8px 16px',border:'1px solid rgba(255,255,255,.25)',borderRadius:6}}>Sign In</a>
          <a href="/auth/register" style={{fontSize:12,color:'#1C1C1E',background:'#C9A84C',textDecoration:'none',padding:'8px 16px',borderRadius:6,fontWeight:700}}>Get Started</a>
        </div>
      </header>

      <div style={{textAlign:'center',padding:'48px 20px 32px'}}>
        <h1 style={{fontFamily:'Playfair Display,serif',fontSize:32,margin:'0 0 8px',color:'#1C1C1E'}}>Our Collection</h1>
        <p style={{fontSize:14,color:'#9AA5B4',maxWidth:520,margin:'0 auto'}}>Browse our fabrics and styles. Sign in or register to build a quote for your home.</p>
      </div>

      {/* CATEGORY GRID */}
      <div style={{maxWidth:1000,margin:'0 auto',padding:'0 20px',display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:20}}>
        {CATEGORIES.map(cat=>(
          <div key={cat.key} onClick={()=>cat.ready && setActiveCategory(activeCategory===cat.key?null:cat.key)}
            style={{background:'#fff',borderRadius:14,overflow:'hidden',border:activeCategory===cat.key?'2px solid #C9A84C':'1px solid #E2DDD6',cursor:cat.ready?'pointer':'default',opacity:cat.ready?1:0.6,boxShadow:activeCategory===cat.key?'0 8px 24px rgba(201,168,76,.2)':'none'}}>
            <div style={{height:150,background:cat.cover?`url(${cat.cover}) center/cover`:'#F0EBE6',display:'flex',alignItems:'center',justifyContent:'center'}}>
              {!cat.cover && <span style={{fontSize:11,color:'#9AA5B4'}}>Photos coming soon</span>}
            </div>
            <div style={{padding:16}}>
              <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>{cat.name}</div>
              <div style={{fontSize:12,color:'#9AA5B4',lineHeight:1.5}}>{cat.desc}</div>
              {cat.ready && <div style={{fontSize:11,color:'#C9A84C',fontWeight:600,marginTop:8}}>{activeCategory===cat.key?'▲ Hide fabrics':'▼ View fabrics'}</div>}
              {!cat.ready && <div style={{fontSize:11,color:'#9AA5B4',fontWeight:600,marginTop:8}}>Ask your advisor for samples</div>}
            </div>
          </div>
        ))}
      </div>

      {/* FABRIC DETAIL */}
      {activeCategory && (
        <div style={{maxWidth:1000,margin:'32px auto 0',padding:'0 20px 60px'}}>
          <h2 style={{fontFamily:'Playfair Display,serif',fontSize:20,marginBottom:6}}>
            {CATEGORIES.find(c=>c.key===activeCategory)?.name} — Fabrics
          </h2>
          <p style={{fontSize:12,color:'#9AA5B4',marginBottom:20}}>
            We're still photographing our full range — the series below have confirmed photos. Ask your CEB advisor about additional fabric codes and colors not shown yet.
          </p>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:16}}>
            {Object.entries(seriesInCategory(activeCategory)).map(([series, codes])=>{
              const confirmed = CONFIRMED_SERIES[series]
              if (!confirmed) return null
              return (
                <div key={series} style={{background:'#fff',borderRadius:12,overflow:'hidden',border:'1px solid #E2DDD6'}}>
                  <img src={confirmed.image} alt={`Series ${series}`} style={{width:'100%',display:'block'}}/>
                  <div style={{padding:14}}>
                    <div style={{fontWeight:700,fontSize:13,marginBottom:4}}>Series {series}</div>
                    <div style={{fontSize:11,color:'#9AA5B4'}}>{codes.length} color option{codes.length!==1?'s':''}: {codes.join(', ')}</div>
                  </div>
                </div>
              )
            })}
            {Object.keys(seriesInCategory(activeCategory)).filter(s=>CONFIRMED_SERIES[s]).length===0 && (
              <div style={{gridColumn:'1/-1',textAlign:'center',padding:30,color:'#9AA5B4',fontSize:13}}>
                Photos for this category are still being added.
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{textAlign:'center',padding:'0 20px 60px'}}>
        <a href="/auth/register" style={{display:'inline-block',background:'#1C1C1E',color:'#fff',textDecoration:'none',padding:'13px 32px',borderRadius:8,fontSize:14,fontWeight:700}}>
          Ready to start your project? Get Started →
        </a>
      </div>
    </div>
  )
}
