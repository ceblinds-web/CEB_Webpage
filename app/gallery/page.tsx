'use client'
import AdminNavLinks from '@/components/AdminNavLinks'

const PRODUCTS = [
  { icon:'🦓', name:'Zebra Blinds', desc:'Dual-layer sheer/solid fabric bands for adjustable light control.' },
  { icon:'🍯', name:'Honey Comb Shades', desc:'Cellular insulating structure — energy efficient, clean lines.' },
  { icon:'🪵', name:'Wooden Flux', desc:'Natural wood-look horizontal slats, classic and warm.' },
  { icon:'🎪', name:'Dream Curtains', desc:'Soft flowing drapery with motorized or chain control.' },
  { icon:'🪟', name:'Roller Shades', desc:'Minimalist single-fabric roll, inside or outside mount.' },
  { icon:'⚙️', name:'Motorized Roller', desc:'App/remote-controlled roller shade with quiet motor.' },
  { icon:'🎛️', name:'Motors & Controls', desc:'Cordless, chain, remote, Alexa hub and outdoor-rated motors.' },
]

export default function GalleryPage() {
  return (
    <div style={{minHeight:'100vh',background:'#1C1C1E',fontFamily:'Inter,sans-serif'}}>
      <header style={{padding:'18px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,background:'#1C1C1E',borderBottom:'1px solid rgba(255,255,255,.08)',zIndex:5}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <a href="/admin" title="Home"><img src="/ceb-logo.jpg" alt="CEB" style={{width:32,height:32,objectFit:'contain',cursor:'pointer'}}/></a>
          <span style={{fontFamily:'Playfair Display,serif',fontSize:16,color:'#fff'}}>Custom Elegant Blinds — Product Gallery</span>
        </div>
        <AdminNavLinks active="gallery"/>
      </header>
      <div style={{padding:'28px 24px',maxWidth:1100,margin:'0 auto'}}>
        <p style={{color:'rgba(255,255,255,.55)',fontSize:13,marginBottom:20}}>Zebra Blinds · Honey Comb · Dream Curtain — browse our product lines.</p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(230px,1fr))',gap:18}}>
          {PRODUCTS.map(p=>(
            <div key={p.name} style={{background:'#242424',borderRadius:12,overflow:'hidden',border:'1px solid rgba(255,255,255,.06)'}}>
              <div style={{height:130,display:'flex',alignItems:'center',justifyContent:'center',fontSize:48,background:'linear-gradient(135deg,#2A2826,#1C1C1E)'}}>{p.icon}</div>
              <div style={{padding:'14px 16px'}}>
                <div style={{color:'#fff',fontSize:14,fontWeight:700,marginBottom:4}}>{p.name}</div>
                <div style={{color:'rgba(255,255,255,.5)',fontSize:12,lineHeight:1.6}}>{p.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{marginTop:40,textAlign:'center',color:'#C9A84C',fontSize:11,letterSpacing:'1px'}}>ceblinds.click · Monroe, WA</div>
      </div>
    </div>
  )
}
