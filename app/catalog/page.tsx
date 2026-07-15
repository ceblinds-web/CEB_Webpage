'use client'
import { useEffect, useState } from 'react'
import SessionBar from '@/components/SessionBar'

type Fabric = { code:string; series:string; category:string }
type VendorRow = { vendor:string; product_category:string; subcategory:string|null; series:string; fabric_codes:string }

const CATEGORIES = [
  { key:'zebra', name:'Zebra Blinds', cover:'/catalog/_covers/zebra-collection-cover.jpg', ready:true,
    desc:'Dual-layer sheer/solid fabric bands for adjustable light control.' },
  { key:'honeycomb', name:'Honey Comb Shades', cover:'/catalog/_covers/honeycomb-collection-cover.jpg', ready:true,
    desc:'Cellular insulating structure — energy efficient, clean lines.' },
  { key:'dream_curtain', name:'Dream Curtains', cover:'/catalog/_covers/dream-curtain-collection-cover-v2.jpg', ready:false,
    desc:'Soft flowing drapery with motorized or chain control.' },
  { key:'roller', name:'Roller Shades', cover:null, ready:false,
    desc:'Minimalist single-fabric roll, inside or outside mount.' },
]

// Confirmed real photo matches so far, keyed by category so zebra's numeric
// series (e.g. '83046') can never collide with honeycomb's ('HC-1' etc).
// More series will be added here as photo-matching continues.
const CONFIRMED_SERIES: Record<string,{image:string}> = {
  'zebra-83046': { image:'/catalog/zebra/zstarr/series-83046.jpg' },
  'zebra-83059': { image:'/catalog/zebra/zstarr/series-83059.jpg' },
  'zebra-83066': { image:'/catalog/zebra/zstarr/series-83066.jpg' },
  'zebra-83061': { image:'/catalog/zebra/zstarr/series-83061.jpg' },
  'zebra-83071': { image:'/catalog/zebra/zstarr/series-83071.jpg' },
  'zebra-83062': { image:'/catalog/zebra/zstarr/series-83062.jpg' },
  'zebra-83064': { image:'/catalog/zebra/zstarr/series-83064.jpg' },
  'zebra-83070': { image:'/catalog/zebra/zstarr/series-83070.jpg' },
  'zebra-83042': { image:'/catalog/zebra/zstarr/series-83042.jpg' },
  'zebra-83043': { image:'/catalog/zebra/zstarr/series-83043.jpg' },
  'zebra-83044': { image:'/catalog/zebra/zstarr/series-83044.jpg' },
  'zebra-83045': { image:'/catalog/zebra/zstarr/series-83045.jpg' },
  'zebra-83058': { image:'/catalog/zebra/zstarr/series-83058.jpg' },
  'zebra-83048': { image:'/catalog/zebra/zstarr/series-83048.jpg' },
  'zebra-83049': { image:'/catalog/zebra/zstarr/series-83049.jpg' },
  'zebra-83047': { image:'/catalog/zebra/zstarr/series-83047.jpg' },
  'zebra-83050': { image:'/catalog/zebra/zstarr/series-83050.jpg' },
  'zebra-83054': { image:'/catalog/zebra/zstarr/series-83054.jpg' },
  'zebra-83055': { image:'/catalog/zebra/zstarr/series-83055.jpg' },
  'zebra-83056': { image:'/catalog/zebra/zstarr/series-83056.jpg' },
  'zebra-83065': { image:'/catalog/zebra/zstarr/series-83065.jpg' },
  'zebra-83040': { image:'/catalog/zebra/zstarr/series-83040.jpg' },
  'zebra-83011': { image:'/catalog/zebra/zstarr/series-83011.jpg' },
  'zebra-83013': { image:'/catalog/zebra/zstarr/series-83013.jpg' },
  'zebra-83012': { image:'/catalog/zebra/zstarr/series-83012.jpg' },
  'zebra-83039': { image:'/catalog/zebra/zstarr/series-83039.jpg' },
  'zebra-83014': { image:'/catalog/zebra/zstarr/series-83014.jpg' },
  'zebra-83015': { image:'/catalog/zebra/zstarr/series-83015.jpg' },
  'zebra-83051': { image:'/catalog/zebra/zstarr/series-83051.jpg' },
  'zebra-83060': { image:'/catalog/zebra/zstarr/series-83060.jpg' },
  'zebra-83019': { image:'/catalog/zebra/zstarr/series-83019.jpg' },
  'zebra-83020': { image:'/catalog/zebra/zstarr/series-83020.jpg' },
  'zebra-83003': { image:'/catalog/zebra/zstarr/series-83003.jpg' },
  'zebra-83009': { image:'/catalog/zebra/zstarr/series-83009.jpg' },
  'zebra-83032': { image:'/catalog/zebra/zstarr/series-83032.jpg' },
  'zebra-83038': { image:'/catalog/zebra/zstarr/series-83038.jpg' },
  'honeycomb-HC-1': { image:'/catalog/honeycomb/zstarr/HC-1.jpg' },
  'honeycomb-HC-2': { image:'/catalog/honeycomb/zstarr/HC-2.jpg' },
  'honeycomb-HC-3': { image:'/catalog/honeycomb/zstarr/HC-3.jpg' },
  'honeycomb-HC-4': { image:'/catalog/honeycomb/zstarr/HC-4.jpg' },
  'honeycomb-HC-6': { image:'/catalog/honeycomb/zstarr/HC-6.jpg' },
  'honeycomb-HC-8': { image:'/catalog/honeycomb/zstarr/HC-8.jpg' },
  'honeycomb-HC-9': { image:'/catalog/honeycomb/zstarr/HC-9.jpg' },
  'honeycomb-HC-10': { image:'/catalog/honeycomb/zstarr/HC-10.jpg' },
  'honeycomb-HC-11': { image:'/catalog/honeycomb/zstarr/HC-11.jpg' },
  'honeycomb-HC-12': { image:'/catalog/honeycomb/zstarr/HC-12.jpg' },
  'honeycomb-HC-13': { image:'/catalog/honeycomb/zstarr/HC-13.jpg' },
  'honeycomb-HC-14': { image:'/catalog/honeycomb/zstarr/HC-14.jpg' },
  'honeycomb-HC-15': { image:'/catalog/honeycomb/zstarr/HC-15.jpg' },
  'honeycomb-HC-16': { image:'/catalog/honeycomb/zstarr/HC-16.jpg' },
  'honeycomb-HC-17': { image:'/catalog/honeycomb/zstarr/HC-17.jpg' },
  'honeycomb-HC-18': { image:'/catalog/honeycomb/zstarr/HC-18.jpg' },
  'honeycomb-HC-19': { image:'/catalog/honeycomb/zstarr/HC-19.jpg' },
  'honeycomb-HC-20': { image:'/catalog/honeycomb/zstarr/HC-20.jpg' },
  'honeycomb-HC-21': { image:'/catalog/honeycomb/zstarr/HC-21.jpg' },
  'honeycomb-HC-22': { image:'/catalog/honeycomb/zstarr/HC-22.jpg' },
}

export default function CatalogPage() {
  const [fabrics, setFabrics] = useState<Fabric[]>([])
  const [vendorRows, setVendorRows] = useState<VendorRow[]>([])
  const [activeCategory, setActiveCategory] = useState<string|null>(null)
  const [lightbox, setLightbox] = useState<{src:string,title:string}|null>(null)
  const [zoomed, setZoomed] = useState(false)

  useEffect(()=>{
    fetch('/api/fabrics/public', { cache:'no-store' }).then(r=>r.json()).then(setFabrics).catch(()=>setFabrics([]))
    fetch('/api/vendor-catalog/public', { cache:'no-store' }).then(r=>r.json()).then(setVendorRows).catch(()=>setVendorRows([]))
  }, [])

  // Merge both data sources into one shape: { series, codes[] } per category.
  // Zebra comes from `fabrics` (one row per color code), honeycomb comes from
  // `vendor_catalog` (one row per series with a comma-list of codes).
  const seriesInCategory = (cat:string) => {
    const bySeries: Record<string,string[]> = {}
    fabrics.filter(f=>f.category===cat).forEach(f=>{
      if(!bySeries[f.series]) bySeries[f.series]=[]
      bySeries[f.series].push(f.code)
    })
    vendorRows.filter(v=>v.product_category.toLowerCase().replace(/\s+/g,'').includes(cat.replace(/_/g,''))).forEach(v=>{
      bySeries[v.series] = v.fabric_codes.split(',').map(c=>c.trim())
    })
    return bySeries
  }

  const openLightbox = (src:string, title:string) => { setLightbox({src,title}); setZoomed(false) }

  return (
    <div style={{minHeight:'100vh',background:'#F7F4EF',fontFamily:'Inter,sans-serif'}}>
      <header style={{height:64,background:'#1C1C1E',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 24px'}}>
        <a href="/catalog" style={{display:'flex',alignItems:'center',gap:10,textDecoration:'none'}}>
          <img src="/ceb-logo.jpg" alt="CEB" style={{width:36,height:36,objectFit:'contain'}}/>
          <span style={{fontFamily:'Playfair Display,serif',fontSize:17,color:'#fff'}}>Custom <span style={{color:'#C9A84C'}}>Elegant</span> Blinds</span>
        </a>
        <SessionBar variant="dark"/>
      </header>

      <div style={{textAlign:'center',padding:'48px 20px 32px'}}>
        <h1 style={{fontFamily:'Playfair Display,serif',fontSize:32,margin:'0 0 8px',color:'#1C1C1E'}}>Our Collection</h1>
        <p style={{fontSize:14,color:'#9AA5B4',maxWidth:520,margin:'0 auto'}}>Browse our fabrics and styles. Click any swatch photo to zoom in. Sign in or register to build a quote for your home.</p>
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
      {activeCategory && (() => {
        const grouped = seriesInCategory(activeCategory)
        const confirmedCount = Object.keys(grouped).filter(s=>CONFIRMED_SERIES[`${activeCategory}-${s}`]).length
        return (
          <div style={{maxWidth:1000,margin:'32px auto 0',padding:'0 20px 60px'}}>
            <h2 style={{fontFamily:'Playfair Display,serif',fontSize:20,marginBottom:6}}>
              {CATEGORIES.find(c=>c.key===activeCategory)?.name} — Fabrics
            </h2>
            <p style={{fontSize:12,color:'#9AA5B4',marginBottom:20}}>
              Showing {confirmedCount} of our fabric series with confirmed photos. A few remaining ones are still being photographed — ask your CEB advisor about any code not shown here yet.
            </p>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:16}}>
              {Object.entries(grouped).map(([series, codes])=>{
                const confirmed = CONFIRMED_SERIES[`${activeCategory}-${series}`]
                if (!confirmed) return null
                return (
                  <div key={series} style={{background:'#fff',borderRadius:12,overflow:'hidden',border:'1px solid #E2DDD6'}}>
                    <div onClick={()=>openLightbox(confirmed.image, `Series ${series}`)} style={{cursor:'zoom-in',position:'relative'}}>
                      <img src={confirmed.image} alt={`Series ${series}`} style={{width:'100%',display:'block'}}/>
                      <div style={{position:'absolute',bottom:8,right:8,background:'rgba(0,0,0,.6)',color:'#fff',fontSize:10,padding:'3px 8px',borderRadius:5}}>🔍 Click to zoom</div>
                    </div>
                    <div style={{padding:14}}>
                      <div style={{fontWeight:700,fontSize:13,marginBottom:4}}>Series {series}</div>
                      <div style={{fontSize:11,color:'#9AA5B4'}}>{codes.length} color option{codes.length!==1?'s':''}: {codes.join(', ')}</div>
                    </div>
                  </div>
                )
              })}
              {confirmedCount===0 && (
                <div style={{gridColumn:'1/-1',textAlign:'center',padding:30,color:'#9AA5B4',fontSize:13}}>
                  Photos for this category are still being added.
                </div>
              )}
            </div>
          </div>
        )
      })()}

      <div style={{textAlign:'center',padding:'0 20px 60px'}}>
        <a href="/auth/register" style={{display:'inline-block',background:'#1C1C1E',color:'#fff',textDecoration:'none',padding:'13px 32px',borderRadius:8,fontSize:14,fontWeight:700}}>
          Ready to start your project? Get Started →
        </a>
      </div>

      {/* LIGHTBOX / ZOOM */}
      {lightbox && (
        <div onClick={()=>setLightbox(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.9)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',zIndex:9998,padding:20}}>
          <div style={{position:'absolute',top:16,right:20,display:'flex',gap:10}}>
            <button onClick={e=>{e.stopPropagation(); setZoomed(z=>!z)}} style={{background:'rgba(255,255,255,.15)',color:'#fff',border:'1px solid rgba(255,255,255,.3)',padding:'8px 16px',borderRadius:6,fontSize:12,cursor:'pointer'}}>{zoomed?'🔍 Zoom Out':'🔍 Zoom In'}</button>
            <button onClick={()=>setLightbox(null)} style={{background:'rgba(255,255,255,.15)',color:'#fff',border:'1px solid rgba(255,255,255,.3)',padding:'8px 16px',borderRadius:6,fontSize:12,cursor:'pointer'}}>✕ Close</button>
          </div>
          <div style={{fontSize:13,color:'rgba(255,255,255,.7)',marginBottom:14}}>{lightbox.title}</div>
          <div style={{overflow:'auto',maxWidth:'92vw',maxHeight:'80vh'}} onClick={e=>e.stopPropagation()}>
            <img
              src={lightbox.src}
              alt={lightbox.title}
              onClick={()=>setZoomed(z=>!z)}
              style={{
                display:'block',
                cursor: zoomed?'zoom-out':'zoom-in',
                width: zoomed ? 'auto' : 'min(92vw,700px)',
                maxWidth: zoomed ? 'none' : '92vw',
                transform: zoomed ? 'scale(2)' : 'scale(1)',
                transformOrigin: 'top left',
                transition:'transform .15s',
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
